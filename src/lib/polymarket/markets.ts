/**
 * Market Data Service
 * Handles fetching and caching market data from Polymarket
 */

import { getOrInitializeClient } from './client'
import type { Market } from './types'
import { db } from '../db'
import type { MarketRecord } from '../db'

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch markets from Polymarket API
 */
export async function fetchMarkets(limit = 100): Promise<Market[]> {
	try {
		const client = await getOrInitializeClient()
		
		// Fetch simplified markets (lighter weight)
		const response = await client.getSimplifiedMarkets()
		
		// Handle pagination response
		const marketsData = response.data || response.results || []
		
		// Transform API response to our Market type
		const markets: Market[] = marketsData
			.filter((m: any) => {
				// Filter out markets without a valid ID
				const id = m.condition_id || m.id || m.conditionId
				return id && typeof id === 'string' && id.trim() !== ''
			})
			.map((m: any) => {
				const id = m.condition_id || m.id || m.conditionId || String(Date.now() + Math.random())
				return {
					id: id,
					question: m.question || m.title || '',
					slug: m.slug || '',
					description: m.description,
					image: m.image,
					active: m.active !== false,
					closed: m.closed === true,
					volume: parseFloat(m.volume || '0'),
					liquidity: parseFloat(m.liquidity || '0'),
					endDate: m.end_date_iso || m.endDate,
					startDate: m.start_date_iso || m.startDate,
					conditionId: id,
					marketMakerAddress: m.market_maker_address,
					outcomes: (m.outcomes || []).map((o: any) => ({
						id: o.outcome_id || o.id || String(Math.random()),
						title: o.title || o.outcome || '',
						price: parseFloat(o.price || '0'),
						volume: parseFloat(o.volume || '0'),
					})),
					createdAt: m.created_at,
					updatedAt: m.updated_at,
				}
			})

		// Cache markets
		await cacheMarkets(markets)

		return markets.slice(0, limit)
	} catch (error) {
		console.error('Error fetching markets:', error)
		throw error
	}
}

/**
 * Fetch a single market by condition ID
 */
export async function fetchMarket(conditionId: string): Promise<Market | null> {
	try {
		const client = await getOrInitializeClient()
		const marketData = await client.getMarket(conditionId)
		
		if (!marketData) return null

		const id = marketData.condition_id || marketData.id || conditionId
		if (!id || typeof id !== 'string' || id.trim() === '') {
			throw new Error(`Invalid market ID for condition: ${conditionId}`)
		}

		const market: Market = {
			id: id,
			question: marketData.question || marketData.title || '',
			slug: marketData.slug || '',
			description: marketData.description,
			image: marketData.image,
			active: marketData.active !== false,
			closed: marketData.closed === true,
			volume: parseFloat(marketData.volume || '0'),
			liquidity: parseFloat(marketData.liquidity || '0'),
			endDate: marketData.end_date_iso || marketData.endDate,
			startDate: marketData.start_date_iso || marketData.startDate,
			conditionId: id,
			marketMakerAddress: marketData.market_maker_address,
			outcomes: (marketData.outcomes || []).map((o: any) => ({
				id: o.outcome_id || o.id || String(Math.random()),
				title: o.title || o.outcome || '',
				price: parseFloat(o.price || '0'),
				volume: parseFloat(o.volume || '0'),
			})),
			createdAt: marketData.created_at,
			updatedAt: marketData.updated_at,
		}

		// Cache the market
		await cacheMarkets([market])

		return market
	} catch (error) {
		console.error('Error fetching market:', error)
		throw error
	}
}

/**
 * Cache markets in the database
 */
async function cacheMarkets(markets: Market[]): Promise<void> {
	try {
		const now = Date.now()
		// Filter out markets with invalid IDs before caching
		const validMarkets = markets.filter(market => {
			if (!market.id || typeof market.id !== 'string' || market.id.trim() === '') {
				console.warn('Skipping market with invalid ID:', market)
				return false
			}
			return true
		})

		if (validMarkets.length === 0) {
			return
		}

		const records: MarketRecord[] = validMarkets.map(market => ({
			...market,
			cachedAt: now,
		}))

		await db.markets.bulkPut(records)
	} catch (error) {
		console.error('Error caching markets:', error)
		// Don't throw - caching is optional
	}
}

/**
 * Get markets from cache
 */
export async function getCachedMarkets(maxAge = CACHE_DURATION): Promise<Market[]> {
	try {
		const cutoff = Date.now() - maxAge
		const records = await db.markets
			.where('cachedAt')
			.above(cutoff)
			.toArray()

		return records.map(r => {
			const { cachedAt, ...market } = r
			return market
		})
	} catch (error) {
		console.error('Error getting cached markets:', error)
		return []
	}
}

/**
 * Get markets (from cache if available, otherwise fetch)
 */
export async function getMarkets(forceRefresh = false): Promise<Market[]> {
	if (!forceRefresh) {
		const cached = await getCachedMarkets()
		if (cached.length > 0) {
			return cached
		}
	}

	return await fetchMarkets()
}

/**
 * Search markets by query
 */
export async function searchMarkets(query: string): Promise<Market[]> {
	const markets = await getMarkets()
	const lowerQuery = query.toLowerCase()
	
	return markets.filter(market => 
		market.question.toLowerCase().includes(lowerQuery) ||
		market.description?.toLowerCase().includes(lowerQuery) ||
		market.slug.toLowerCase().includes(lowerQuery)
	)
}

/**
 * Get active markets only
 */
export async function getActiveMarkets(): Promise<Market[]> {
	const markets = await getMarkets()
	return markets.filter(m => m.active && !m.closed)
}

