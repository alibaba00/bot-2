/**
 * Market Data Service
 * Handles fetching and caching market data from Polymarket
 */

import { getOrInitializeClient } from './client'
import type { Market } from './types'
import { db } from '../db'
import type { MarketRecord } from '../db'

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const GAMMA_API_BASE = 'https://gamma-api.polymarket.com'

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
 * Fetch a single market from Gamma API by slug
 */
export async function fetchMarketBySlugFromGamma(slug: string): Promise<Market | null> {
	try {
		const url = `${GAMMA_API_BASE}/markets/slug/${slug}`
		console.log(`Fetching market by slug from Gamma API: ${url}`)
		
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
			},
		})

		if (!response.ok) {
			if (response.status === 404) {
				console.log(`Market not found in Gamma API for slug: ${slug}`)
				return null
			}
			throw new Error(`Gamma API error: ${response.status} ${response.statusText}`)
		}

		const marketData = await response.json()
		
		if (!marketData || !marketData.id) {
			console.log(`Invalid market data from Gamma API for slug: ${slug}`)
			return null
		}

		// Parse JSON strings from Gamma API
		let outcomesArray: string[] = []
		let outcomePricesArray: string[] = []
		let clobTokenIdsArray: string[] = []
		
		try {
			if (typeof marketData.outcomes === 'string') {
				outcomesArray = JSON.parse(marketData.outcomes)
			} else if (Array.isArray(marketData.outcomes)) {
				outcomesArray = marketData.outcomes
			}
		} catch (e) {
			console.warn('Failed to parse outcomes:', e)
		}
		
		try {
			if (typeof marketData.outcomePrices === 'string') {
				outcomePricesArray = JSON.parse(marketData.outcomePrices)
			} else if (Array.isArray(marketData.outcomePrices)) {
				outcomePricesArray = marketData.outcomePrices
			}
		} catch (e) {
			console.warn('Failed to parse outcomePrices:', e)
		}
		
		try {
			if (typeof marketData.clobTokenIds === 'string') {
				clobTokenIdsArray = JSON.parse(marketData.clobTokenIds)
			} else if (Array.isArray(marketData.clobTokenIds)) {
				clobTokenIdsArray = marketData.clobTokenIds
			}
		} catch (e) {
			console.warn('Failed to parse clobTokenIds:', e)
		}

		// Create outcomes array with token IDs and prices
		const outcomes = outcomesArray.map((outcomeTitle: string, index: number) => ({
			id: clobTokenIdsArray[index] || String(Math.random()), // Use CLOB token ID
			title: outcomeTitle,
			price: parseFloat(outcomePricesArray[index] || '0'),
			volume: 0, // Not available in this response
		}))

		// Transform Gamma API response to our Market type
		const market: Market = {
			id: marketData.id || marketData.conditionId || '',
			question: marketData.question || marketData.title || '',
			slug: marketData.slug || slug,
			description: marketData.description,
			image: marketData.image || marketData.icon,
			active: marketData.active !== false,
			closed: marketData.closed === true,
			volume: parseFloat(marketData.volume || marketData.volumeNum || '0'),
			liquidity: parseFloat(marketData.liquidity || marketData.liquidityNum || '0'),
			endDate: marketData.endDate || marketData.endDateIso,
			startDate: marketData.startDate || marketData.startDateIso,
			conditionId: marketData.conditionId || marketData.id || '',
			marketMakerAddress: marketData.marketMakerAddress || marketData.market_maker_address || '',
			outcomes: outcomes,
			createdAt: marketData.createdAt,
			updatedAt: marketData.updatedAt,
		}
		
		console.log('Parsed market from Gamma API:', {
			id: market.id,
			conditionId: market.conditionId,
			question: market.question,
			outcomesCount: market.outcomes.length,
			tokenIds: clobTokenIdsArray,
			prices: outcomes.map(o => `${o.title}: ${o.price}`)
		})

		// Cache the market
		await cacheMarkets([market])

		return market
	} catch (error: any) {
		console.error('Error fetching market by slug from Gamma API:', error)
		return null
	}
}

/**
 * Fetch a single market from Gamma API by condition ID
 */
export async function fetchMarketFromGamma(conditionId: string): Promise<Market | null> {
	try {
		const url = `${GAMMA_API_BASE}/markets/${conditionId}`
		console.log(`Fetching market from Gamma API: ${url}`)
		
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
			},
		})

		if (!response.ok) {
			if (response.status === 404) {
				console.log(`Market not found in Gamma API for condition ID: ${conditionId}`)
				return null
			}
			throw new Error(`Gamma API error: ${response.status} ${response.statusText}`)
		}

		const marketData = await response.json()
		
		if (!marketData || !marketData.id) {
			console.log(`Invalid market data from Gamma API for condition ID: ${conditionId}`)
			return null
		}

		// Parse JSON strings from Gamma API (same as slug function)
		let outcomesArray: string[] = []
		let outcomePricesArray: string[] = []
		let clobTokenIdsArray: string[] = []
		
		try {
			if (typeof marketData.outcomes === 'string') {
				outcomesArray = JSON.parse(marketData.outcomes)
			} else if (Array.isArray(marketData.outcomes)) {
				outcomesArray = marketData.outcomes
			}
		} catch (e) {
			console.warn('Failed to parse outcomes:', e)
		}
		
		try {
			if (typeof marketData.outcomePrices === 'string') {
				outcomePricesArray = JSON.parse(marketData.outcomePrices)
			} else if (Array.isArray(marketData.outcomePrices)) {
				outcomePricesArray = marketData.outcomePrices
			}
		} catch (e) {
			console.warn('Failed to parse outcomePrices:', e)
		}
		
		try {
			if (typeof marketData.clobTokenIds === 'string') {
				clobTokenIdsArray = JSON.parse(marketData.clobTokenIds)
			} else if (Array.isArray(marketData.clobTokenIds)) {
				clobTokenIdsArray = marketData.clobTokenIds
			}
		} catch (e) {
			console.warn('Failed to parse clobTokenIds:', e)
		}

		// Create outcomes array with token IDs and prices
		const outcomes = outcomesArray.map((outcomeTitle: string, index: number) => ({
			id: clobTokenIdsArray[index] || String(Math.random()), // Use CLOB token ID
			title: outcomeTitle,
			price: parseFloat(outcomePricesArray[index] || '0'),
			volume: 0, // Not available in this response
		}))

		// Transform Gamma API response to our Market type
		const market: Market = {
			id: marketData.id || marketData.conditionId || conditionId,
			question: marketData.question || marketData.title || '',
			slug: marketData.slug || '',
			description: marketData.description,
			image: marketData.image || marketData.icon,
			active: marketData.active !== false,
			closed: marketData.closed === true,
			volume: parseFloat(marketData.volume || marketData.volumeNum || '0'),
			liquidity: parseFloat(marketData.liquidity || marketData.liquidityNum || '0'),
			endDate: marketData.endDate || marketData.endDateIso,
			startDate: marketData.startDate || marketData.startDateIso,
			conditionId: marketData.conditionId || marketData.id || conditionId,
			marketMakerAddress: marketData.marketMakerAddress || marketData.market_maker_address || '',
			outcomes: outcomes,
			createdAt: marketData.createdAt,
			updatedAt: marketData.updatedAt,
		}
		
		console.log('Parsed market from Gamma API (by ID):', {
			id: market.id,
			conditionId: market.conditionId,
			question: market.question,
			outcomesCount: market.outcomes.length,
			tokenIds: clobTokenIdsArray
		})

		// Cache the market
		await cacheMarkets([market])

		return market
	} catch (error: any) {
		console.error('Error fetching market from Gamma API:', error)
		return null
	}
}

/**
 * Fetch current prices for a market from CLOB API
 * This provides real-time price data from the order book
 */
export async function fetchMarketPricesFromClob(conditionId: string): Promise<Record<string, number> | null> {
	try {
		const client = await getOrInitializeClient()
		const marketData = await client.getMarket(conditionId)
		
		if (!marketData || !marketData.outcomes) {
			return null
		}
		
		const prices: Record<string, number> = {}
		marketData.outcomes.forEach((outcome: any) => {
			const outcomeId = outcome.outcome_id || outcome.id || outcome.token_id
			if (outcomeId) {
				// Try to get price from various fields
				const price = parseFloat(outcome.price || outcome.last_price || outcome.mid_price || '0')
				if (price > 0) {
					prices[outcomeId] = price
				}
			}
		})
		
		return Object.keys(prices).length > 0 ? prices : null
	} catch (error) {
		console.error('Error fetching prices from CLOB API:', error)
		return null
	}
}

/**
 * Fetch a single market by condition ID
 * Tries Gamma API first, then falls back to CLOB API
 */
export async function fetchMarket(conditionId: string, useCache = false): Promise<Market | null> {
	try {
		// Optionally check cache first (but don't use stale data for direct API calls)
		if (useCache) {
			try {
				const cached = await getCachedMarkets(5 * 60 * 1000) // 5 minutes
				const cachedMarket = cached.find(m => 
					m.conditionId === conditionId || 
					m.id === conditionId ||
					String(m.conditionId) === String(conditionId) ||
					String(m.id) === String(conditionId)
				)
				if (cachedMarket) {
					console.log(`Using cached market for condition ID: ${conditionId}`)
					return cachedMarket
				}
			} catch (cacheError) {
				// Ignore cache errors, proceed with API call
			}
		}

		// Try Gamma API first (more reliable for market data)
		console.log(`Trying Gamma API for condition ID: ${conditionId}`)
		const gammaMarket = await fetchMarketFromGamma(conditionId)
		if (gammaMarket && gammaMarket.question && gammaMarket.question.trim() !== '') {
			console.log(`✅ Found market via Gamma API for condition ID: ${conditionId}`)
			return gammaMarket
		}

		// Fallback to CLOB API
		console.log(`Gamma API failed, trying CLOB API for condition ID: ${conditionId}`)
		const client = await getOrInitializeClient()
		const marketData = await client.getMarket(conditionId)
		
		if (!marketData) {
			console.log(`Market data is null for condition ID: ${conditionId}`)
			return null
		}

		// Validate that we have meaningful market data (not just an empty object with ID)
		const hasQuestion = marketData.question || marketData.title
		const hasOutcomes = marketData.outcomes && Array.isArray(marketData.outcomes) && marketData.outcomes.length > 0
		
		if (!hasQuestion && !hasOutcomes) {
			console.log(`Market data is incomplete for condition ID: ${conditionId} - missing question and outcomes`)
			return null
		}

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
	} catch (error: any) {
		// Check if it's a 404 or "market not found" error
		const isNotFound = 
			error?.status === 404 || 
			error?.response?.status === 404 ||
			error?.data?.error === 'market not found' ||
			error?.message?.includes('404') ||
			error?.message?.includes('not found')
		
		if (isNotFound) {
			console.log(`Market not found via API for condition ID: ${conditionId}`)
			return null // Return null instead of throwing for 404 errors
		}
		
		console.error('Error fetching market:', error)
		throw error // Re-throw other errors
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

