import localForage from 'localforage'
import type { Market, MarketData, MarketState } from '@/lib/polymarket/types'

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com'
const POLYMARKET_API_BASE = 'https://polymarket.com/api'

// create cache instance
const cache = localForage.createInstance({
	name: 'polymarket',
	storeName: 'polymarket-cache'
})

interface CryptoPriceResponse {
	openPrice?: number
	closePrice?: number
	timestamp?: number
	completed?: boolean
	incomplete?: boolean
	cached?: boolean
}

interface MarketsMap {
	[marketName: string]: {
		[slug: string]: Market
	}
}

class PolymarketApi {
	gammaApiBase: string = GAMMA_API_BASE
	polymarketApiBase: string = POLYMARKET_API_BASE
	markets: MarketsMap = {}
	currentMarket: Market | null = null

	constructor() {
		this.gammaApiBase = GAMMA_API_BASE
		this.polymarketApiBase = POLYMARKET_API_BASE
		this.init()
	}

	async init(): Promise<void> {
		console.log('-----------------------init PolymarketApi-----------------------')
	}


	// from CryptoTickerPage
	async initMarkets(symbol: string, type: string): Promise<Market[]> {
		//symbol: btc, type: updown-15m
		const lastMarket = await this.getMarketFromDate(symbol, type, new Date(Date.now() - 15 * 60000), 15)
		const currentMarket = await this.getMarketFromDate(symbol, type, new Date(), 15)
		const nextMarket = await this.getMarketFromDate(symbol, type, new Date(Date.now() + 15 * 60000), 15)
		return [
			nextMarket as Market,
			currentMarket as Market,
			lastMarket as Market,
		]
	}


	async getMarketFromDate(symbol: string, type: string, date: Date, minutes: number): Promise<Market> {
		const timestamp = this.getUTCTimestamp(date, minutes)
		const marketName = `${symbol}-${type}`	//e.g. btc-updown-15m
		const marketSlug = `${marketName}-${timestamp}`	//e.g. btc-updown-15m-1765144800

		// if (this.markets?.[marketName]?.[marketSlug]) {
		// 	return this.markets[marketName][marketSlug]
		// }

		if (!this.markets?.[marketName]) this.markets[marketName] = {}

		// const cachedMarket = await cache.getItem<Market>(marketSlug)
		// if (cachedMarket) {
		// 	cachedMarket.state = 'init'
		// 	this.markets[marketName][cachedMarket.slug] = cachedMarket
		// 	return cachedMarket
		// }

		const market = this.createMarket(symbol, marketName, timestamp, marketSlug)
		this.markets[marketName][market.slug] = market
		await this.cacheMarket(market)

		return market as Market
	}


	createMarket(symbol: string, marketName: string, timestamp: number, marketSlug: string): Market {
		const startTimestamp = timestamp * 1000 // Convert to milliseconds
		const endTimestamp = startTimestamp + 15 * 60 * 1000 // Add 15 minutes

		// console.log('startTimestamp', new Date(startTimestamp).toISOString())
		// console.log('endTimestamp', new Date(endTimestamp).toISOString())

		const market: Market = {
			symbol: symbol.toUpperCase(),
			marketName: marketName,
			slug: marketSlug,
			timestamp,
			startTimestamp,
			endTimestamp,
			state: 'init',	//init, pending, started, running, stopped, completed
			marketData: null,
			openPrice: null,	// priceToBeat
			closePrice: null,	// finalPrice
		}

		return market
	}


	// Function to get the current 15-minute UTC timestamp (rounded down to nearest 15-minute interval)
	getUTCTimestamp(date: Date | number, minutes: number): number {
		const dateTime = date instanceof Date ? date.getTime() : date
		const dateTimeSeconds = Math.floor(dateTime / 1000) // Convert to seconds
		const minutesSeconds = minutes * 60 // minutes in seconds
		// Round down to the nearest minutes interval
		return Math.floor(dateTimeSeconds / minutesSeconds) * minutesSeconds
	}

	// Get price to beat for a given symbol, event start time, and end date
	async getCryptoPrice(market: Market): Promise<CryptoPriceResponse | null> {
		const symbol = market.symbol
		const eventStartTime = new Date(market.startTimestamp).toISOString()
		const endDate = new Date(market.endTimestamp).toISOString()

		const url = `${POLYMARKET_API_BASE}/crypto/crypto-price`
		const params = new URLSearchParams({
			symbol,
			eventStartTime,
			variant: 'fifteen',
			endDate
		})

		const fullUrl = `${url}?${params.toString()}`
		const response = await fetch(fullUrl, {
			method: 'GET',
			headers: {
				Accept: 'application/json'
			}
		})

		if (!response.ok) return null
		
		const data = await response.json() as CryptoPriceResponse
		return data
	}


	async fetchMarketBySlug(slug: string): Promise<MarketData | null> {
		const url = `${GAMMA_API_BASE}/markets/slug/${slug}`
		console.log(`Fetching market by slug from Gamma API: ${url}`)

		const response = await fetch(url, {
			method: 'GET',
			headers: {
				Accept: 'application/json'
			}
		})
		if (!response.ok) return null
		
		const data = await response.json() as MarketData
		return data
	}


	getMarketState(market: Market): MarketState | null {
		if (!market) return 'failed'

		if (market.closePrice) {
			market.state = 'closed'
			return market.state
		}
		const startTime = new Date(market.startTimestamp || '')
		const endTime = new Date(market.endTimestamp || '')
		const now = new Date()
		if (now > endTime) {		//polling for final price
			market.state = 'stopped'
			return market.state
		}
		if (now < startTime) return 'pending'
		if (market.openPrice) return 'running'
		return 'started'
	}


	onMarketTimer(
		_endDate: string,
		onTimer?: (t: { minutes: number; seconds: number; isExpired: boolean }) => void
	): void {
		const endDate = new Date(_endDate || "")
		let interval: NodeJS.Timeout | null = null

		const updateTimer = () => {
			if (!onTimer){
				if (interval) clearInterval(interval)
				return
			}
			const now = new Date()
			const diff = endDate.getTime() - now.getTime()
			if (diff <= 0) {
				onTimer?.({ minutes: 0, seconds: 0, isExpired: true })
				if (interval) clearInterval(interval)
				return
			}
			const minutes = Math.floor(diff / 60000)
			const seconds = Math.floor((diff % 60000) / 1000)
			onTimer?.({ minutes, seconds, isExpired: false })
		}

		updateTimer()
		interval = setInterval(updateTimer, 1000)
	}

/*
	useEffect(() => {
		if (interval) clearInterval(interval)

		if (!market?.endDate) {
			setTimeRemaining({ minutes: 0, seconds: 0, isExpired: true })
			return
		}

		const updateCountdown = () => {
			const endDate = new Date(market.endDate!)
			const now = new Date()
			const diff = endDate.getTime() - now.getTime()

			if (diff <= 0) {
				setTimeRemaining({ minutes: 0, seconds: 0, isExpired: true })
				if (interval) clearInterval(interval)
				return
			}

			const minutes = Math.floor(diff / 60000)
			const seconds = Math.floor((diff % 60000) / 1000)
			setTimeRemaining({ minutes, seconds, isExpired: false })
		}

		// Update immediately
		updateCountdown()

		// Update every second
		interval = setInterval(updateCountdown, 1000)

		return () => {
			if (interval) clearInterval(interval)
			interval = null
		}
	}, [market?.endDate])
*/

	async cacheMarket(market: Market): Promise<void> {
		await cache.setItem(market.slug, market)
	}


	async pollingMarketPrice(market: Market, type: 'openPrice' | 'closePrice'): Promise<CryptoPriceResponse | null> {
		const api = this
		return new Promise((resolve, reject) => {
			async function pollingMarketPrice() {
				const result = await api.getCryptoPrice(market)
				if (result?.[type]) {
					market[type] = result[type]
					await api.cacheMarket(market)
					resolve(result)
				}else{
					await new Promise(resolve => setTimeout(resolve, 5000))
					pollingMarketPrice()
				}
			}
			pollingMarketPrice()
		})
	}
}

export default new PolymarketApi()

/*
// https://polymarket.com/api/crypto/crypto-price?symbol=BTC
// 		&eventStartTime=2025-12-06T09:15:00Z&variant=fifteen&endDate=2025-12-06T09:30:00Z
{
    "openPrice": 89299.0560483538,
    "closePrice": 89530.1902704494,
    "timestamp": 1765012902842,
    "completed": true,
    "incomplete": false,
    "cached": true
}
*/

/*
// https://polymarket.com/api/crypto/crypto-price
// ?symbol=BTC&eventStartTime=2025-12-07T22%3A00%3A00.000Z&variant=fifteen&endDate=2025-12-07T22%3A15%3A00.000Z
	return await fetchCryptoPriceToBeat(symbol, eventStartTime, endDate, 'fifteen') || null

export async function fetchCryptoPriceToBeat(
	symbol: string,
	eventStartTime: string,
	endDate: string,
	variant: string = 'fifteen'
): Promise<CryptoPriceData | null> {
	try {
		const url = `${POLYMARKET_API_BASE}/crypto/crypto-price`
		const params = new URLSearchParams({
			symbol: symbol.toUpperCase(),
			eventStartTime,
			variant,
			endDate
		})

		const fullUrl = `${url}?${params.toString()}`
		console.log('🌐 Fetching price to beat from:', fullUrl)

		const response = await fetch(fullUrl, {
			method: 'GET',
			headers: {
				Accept: 'application/json'
			}
		})

		if (!response.ok) {
			const errorText = await response.text().catch(() => '')
			console.warn(
				`❌ Failed to fetch price to beat: ${response.status} ${response.statusText}`,
				errorText
			)
			return null
		}

		const data = await response.json()
		console.log('📦 Crypto price API response:', data)

		// The API returns openPrice (price at start of time window) and closePrice (price at end)
		// The "price to beat" is the openPrice - the reference price at the start of the event
		// The "final price" is the closePrice - the price at the end of the event
		const openPrice =
			data.openPrice ||
			data.price ||
			data.priceToBeat ||
			data.initialPrice ||
			data.startPrice ||
			data.value ||
			data.data?.openPrice ||
			data.data?.price ||
			data.data?.priceToBeat ||
			data.result?.openPrice ||
			data.result?.price ||
			data.result?.priceToBeat

		const closePrice =
			data.closePrice ||
			data.finalPrice ||
			data.endPrice ||
			data.data?.closePrice ||
			data.data?.finalPrice ||
			data.data?.endPrice ||
			data.result?.closePrice ||
			data.result?.finalPrice ||
			data.result?.endPrice

		let priceToBeatValue: number | null = null
		let finalPriceValue: number | null = null

		// Parse openPrice (price to beat)
		if (typeof openPrice === 'number') {
			priceToBeatValue = openPrice
		} else if (typeof openPrice === 'string') {
			const parsed = parseFloat(openPrice)
			if (!isNaN(parsed)) {
				priceToBeatValue = parsed
			}
		}

		// Parse closePrice (final price)
		if (typeof closePrice === 'number') {
			finalPriceValue = closePrice
		} else if (typeof closePrice === 'string') {
			const parsed = parseFloat(closePrice)
			if (!isNaN(parsed)) {
				finalPriceValue = parsed
			}
		}

		if (priceToBeatValue !== null || finalPriceValue !== null) {
			console.log('✅ Crypto price data found:', {
				priceToBeat: priceToBeatValue,
				finalPrice: finalPriceValue
			})
			return {
				priceToBeat: priceToBeatValue,
				finalPrice: finalPriceValue
			}
		}

		console.warn(
			'⚠️ Crypto price data format unexpected. Full response:',
			JSON.stringify(data, null, 2)
		)
		return null
	} catch (error) {
		console.error('❌ Error fetching crypto price to beat:', error)
		return null
	}
}

*/

