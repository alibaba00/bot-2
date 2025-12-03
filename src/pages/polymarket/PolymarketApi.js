import { fetchCryptoPriceToBeat } from '@/lib/polymarket/markets'
import localForage from 'localforage'

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com'
const POLYMARKET_API_BASE = 'https://polymarket.com/api'

// create cache instance
const cache = localForage.createInstance({
	name: 'polymarket',
	storeName: 'polymarket-cache'
})

class PolymarketApi {
	gammaApiBase = GAMMA_API_BASE
	polymarketApiBase = POLYMARKET_API_BASE
	markets = []
	currentMarket = null

	constructor() {
		this.gammaApiBase = GAMMA_API_BASE
		this.polymarketApiBase = POLYMARKET_API_BASE
		this.init()
	}

	async init() {
		console.log('-----------------------init PolymarketApi-----------------------')
		const cachedMarkets = (await cache.getItem('markets')) || []
		console.log('cachedMarkets', cachedMarkets)
		this.markets = cachedMarkets

		return this.markets

		// this.currentMarket = new Market({
		// 	id: '1234567890123456789012345678901234567890123456789012345678901234',
		// 	question: 'What is the price of Bitcoin?',
		// 	slug: 'btc-updown-15m-12345678901234567890123456789012',
		// 	description: 'This is a test market',
		// 	image: 'https://polymarket.com/images/btc.png',
		// 	active: true,
		// 	closed: false,
		// 	outcomes: [
		// 		{
		// 			id: '12345678901234567890123456789012',
		// 			title: 'Yes',
		// 			price: 0.5,
		// 			volume: 100
		// 		}
		// 	]
		// })
	}


	initMarket(symbol) {		//e.g. btc-updown-15m
		const timestamp = this.getCurrent15MinuteUTCTimestamp()
		const marketSlug = `${symbol}-${timestamp}`
		if (this.markets?.[symbol]?.[marketSlug]) return this.markets[symbol][marketSlug]

		if (!this.markets?.[symbol]) this.markets[symbol] = {}
		const market = this.createMarket(timestamp, marketSlug)
		this.markets[symbol][market.slug] = market
		return market
	}


	createMarket(timestamp, marketSlug) {
		const startTimestamp = timestamp * 1000 // Convert to milliseconds
		const endTimestamp = startTimestamp + 15 * 60 * 1000 // Add 15 minutes

		console.log('marketSlug', marketSlug)

		console.log('startTimestamp', new Date(startTimestamp).toISOString())
		console.log('endTimestamp', new Date(endTimestamp).toISOString())

		// const priceToBeat = await this.getPriceToBeat('btc', new Date(startTimestamp).toISOString(), new Date(endTimestamp).toISOString())
		// console.log('priceToBeat', priceToBeat)

		const market = {
			success: true,
			message: 'Market created successfully',
			slug: marketSlug,
			timestamp,
			startTimestamp,
			endTimestamp,
			state: 'init',
			// priceToBeat: priceToBeat ? priceToBeat : null,
		}
		// this.setPriceToBeat(market)

		return market
	}

	// Function to get the current 15-minute UTC timestamp (rounded down to nearest 15-minute interval)
	getCurrent15MinuteUTCTimestamp() {
		const now = Date.now() // Current time in milliseconds
		console.log('Current 15-minute UTC timestamp:', now)
		const nowSeconds = Math.floor(now / 1000) // Convert to seconds
		const fifteenMinutes = 15 * 60 // 15 minutes in seconds (900)
		// Round down to the nearest 15-minute interval
		return Math.floor(nowSeconds / fifteenMinutes) * fifteenMinutes
	}

	// Default Bitcoin market slug - dynamically generated based on current 15-minute UTC timestamp
	// getDefaultBTCMarketSlug() {
	// 	const timestamp = this.getCurrent15MinuteUTCTimestamp()
	// 	console.log('Default Bitcoin market slug:', `btc-updown-15m-${timestamp}`)
	// 	return `btc-updown-15m-${timestamp}`
	// }

	// Get price to beat for a given symbol, event start time, and end date
	async getPriceToBeat(symbol, eventStartTime, endDate) {
		return await fetchCryptoPriceToBeat(symbol, eventStartTime, endDate, 'fifteen') || null
	}

}

export default new PolymarketApi()


