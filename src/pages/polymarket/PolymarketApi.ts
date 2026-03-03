import { fetchMarketBySlugFromGamma } from '@/lib/polymarket/markets'
import type { Market, MarketData, MarketState } from '@/lib/polymarket/types'
import localForage from 'localforage'
import moment from 'moment'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com'
const POLYMARKET_API_BASE = 'https://polymarket.com/api'

const isElectron = window?.navigator.userAgent.includes('Electron')
export const fs = isElectron ? (window as any)?.require?.('fs') : null
export const fsPromises = isElectron ? (window as any)?.require?.('fs/promises') : null


// create cache instance
const cache = localForage.createInstance({
	name: 'polymarket',
	storeName: 'polymarket-cache'
})
const store = localForage.createInstance({
	name: 'polymarket',
	storeName: 'polymarket-store'
})

interface CryptoPriceResponse {
	openPrice?: number
	closePrice?: number
	timestamp?: number
	completed?: boolean
	incomplete?: boolean
	cached?: boolean
}


// ---------------------------------------------------------------------------- useStore
export const useStore = create(() => ({
	isInit: false,
	status: 'initializing',
	marketActive: false,
	tradingActive: false,
	tickerActive: false,
	pollingActive: false,
	loggingActive: true,
	marketCompleted: false,
}))


// ============================================================================ PolymarketApi
class PolymarketApi {
	config: any = null
	cache: any = null
	store: any = null
	rootPath: string = ''
	clobPath: string = ''
	marketsPath: string = ''
	gammaApiBase: string = GAMMA_API_BASE
	polymarketApiBase: string = POLYMARKET_API_BASE
	tickerPrices: Map<string, {timestamp: number, price: number}> = new Map()
	
	set(state: any, value?: any){
		if (typeof state === 'string') state = { [state]: value }
		useStore.setState(state)
	}

	// get: useStore.getState,
	get(value?: string){
		return value ? useStore.getState()[value as any] : useStore.getState()
	}

	use(...keys: string[]){
		return useStore(
			useShallow((state: any) =>
				keys.length === 1 ? state[keys[0]] : keys.map((key) => state[key])
			)
		)
	}

	// ============================================================================ constructor
	constructor() {
		this.cache = cache
		this.store = store
		this.init()
	}

	// ---------------------------------------------------------------------------- loadConfig
	// load config from config.json and userConfig.json
	async loadConfig() {
		const configPath = './config.json'
		console.log('Loading config from:', configPath)

		const config = await fetch(configPath).then((res) => res.json())
		if (!config) return

		// try to load user config
		if (isElectron) {
			try {
				const userConfigPath = config.userConfig
				if (fs?.existsSync(userConfigPath)) {
					const userConfig = await fsPromises?.readFile(userConfigPath, 'utf8')
					// merge user config with app config
					Object.assign(config, JSON.parse(userConfig))
				}
			} catch (error) {
				console.log('---fs access error:', error)
			}
		}

		console.log('---config:', config)
		return config
	}


	// ---------------------------------------------------------------------------- init
	async init(): Promise<void> {
		console.log('-----------------------init PolymarketApi-----------------------')
		this.config = await this.loadConfig()
		this.rootPath = this.config.polymarket.rootPath
		this.clobPath = this.config.polymarket.clobPath
		this.marketsPath = this.config.polymarket.marketsPath
		console.log('PolymarketApi constructor:', this.rootPath, this.clobPath, this.marketsPath)
		this.gammaApiBase = GAMMA_API_BASE
		this.polymarketApiBase = POLYMARKET_API_BASE

		this.set('isInit', true)
	}


	// ---------------------------------------------------------------------------- getAllKeys
	// symbol: e.g. btc
	// fromDate: e.g. 1765406700 from btc-updown-15m-1765406700
	// return: string[]
	async getAllKeys(symbol: string, fromDate: number = 0): Promise<string[]> {
		if (fromDate && fromDate > 1e12) fromDate = Math.floor(fromDate / 1000)	//convert milliseconds to seconds
		const keys = await this.cache.keys()
		console.log('getAllKeys:', symbol, 'from', keys.length, '...')

		const out: string[] = []
		for (const key of keys) {
			if (!key.includes(symbol)) continue
			if (fromDate) {
				const keyDateString = parseInt(key.split('-')[3])	//e.g. 1765406700
				if (String(keyDateString).length !== 10) continue	//e.g. 1765406700 -> 10 digits
				if (keyDateString < fromDate) continue
			}
			out.push(key)
		}
		
		console.log('complete!', out.length)
		return out
	}


	// ---------------------------------------------------------------------------- getAllMarkets
	// symbol: e.g. btc
	// dateString: e.g. 1765406700 from btc-updown-15m-1765406700
	// return: Market[]
	async getAllMarkets(symbol: string, fromDate: number = 0): Promise<Market[]> {
		if (fromDate && fromDate > 1e12) fromDate = Math.floor(fromDate / 1000)	//convert milliseconds to seconds
		const keys = await this.cache.keys()
		console.log('getAllMarkets:', symbol, 'from', keys.length, '...')
		const markets: Market[] = []

		for (const key of keys) {
			if (!key.includes(symbol)) continue
			if (fromDate) {
				const keyDateString = parseInt(key.split('-')[3])	//e.g. 1765406700
				if (String(keyDateString).length !== 10) continue	//e.g. 1765406700 -> 10 digits
				if (keyDateString < fromDate) continue
			}
			const market = await this.cache.getItem(key)
			if (market) markets.push(market)
		}

		console.log('getAllMarkets complete!', symbol, markets.length)
		return markets
	}


	// ---------------------------------------------------------------------------- getMarketTypeFromPath
	// path: e.g. A:/DATA/polymarket/markets/btc/2025-12-12/btc-updown-15m-1765584900.json
	getMarketTypeFromPath(path: string){
		if (path.includes('updown-5m')) return 'updown-5m'
		if (path.includes('updown-15m')) return 'updown-15m'
		if (path.includes('updown-1h')) return 'updown-1h'
		if (path.includes('updown-4h')) return 'updown-4h'
		if (path.includes('updown-1d')) return 'updown-1d'
		return null
	}


	// ---------------------------------------------------------------------------- getMarketDurationFromType
	// get market duration from type in minutes
	// type: e.g. updown-15m
	getMarketDurationFromType(type: string): number | null {
		if (type === 'updown-5m') return 5
		if (type === 'updown-15m') return 15
		if (type === 'updown-1h') return 60
		if (type === 'updown-4h') return 240
		if (type === 'updown-1d') return 1440
		return null
	}


	// ---------------------------------------------------------------------------- getMarketFromDate
	// symbol: e.g. btc
	// type: e.g. updown-15m
	// date: e.g. 2025-12-10
	// minutes: e.g. 15
	// return: Market
	async createMarketFromDate(symbol: string, type: string, date: Date, offset: number = 0): Promise<Market | null> {
		const duration = this.getMarketDurationFromType(type)
		if (!duration) return null

		const timestamp = this.getUTCTimestamp(date, duration, offset)	//e.g. 1765584900
		const marketSlug = `${symbol}-${type}-${timestamp}`	//e.g. btc-updown-15m-1765144800
		return await this.createMarket(symbol, type, marketSlug)
	}


	// ---------------------------------------------------------------------------- getSymbolFromSlug
	getSymbolFromSlug(slug: string): string {
		if (slug.includes('bitcoin')) return 'btc'
		if (slug.includes('ethereum')) return 'eth'
		if (slug.includes('solana')) return 'sol'
		if (slug.includes('xrp')) return 'xrp'
		return slug.split('-')[0]
	}


	// ---------------------------------------------------------------------------- createMarketFromSlug
	// slug: e.g. btc-updown-15m-1765584900
	// return: Market
	async createMarketFromSlug(slug: string, filePath: string = ''): Promise<Market | null> {
		const symbol = this.getSymbolFromSlug(slug)
		const marketType = this.getMarketTypeFromPath(filePath)
		if (!marketType) return null

		console.log('createMarketFromSlug:', symbol, marketType, slug, filePath)
		return await this.createMarket(symbol, marketType, slug, filePath)
	}

	
	// ---------------------------------------------------------------------------- createMarket
	// symbol: e.g. btc
	// marketName: e.g. btc-updown-15m
	// timestamp: e.g. 1765584900
	// marketSlug: e.g. btc-updown-15m-1765584900
	// return: Market
	//
	async createMarket(symbol: string, marketType: string, marketSlug: string, filePath: string = ''): Promise<Market | null> {
		const duration = this.getMarketDurationFromType(marketType)
		if (!duration) return null

		const marketData = await fetchMarketBySlugFromGamma(marketSlug)
		if (!marketData?.endDate){
			console.log('marketData not found:', marketSlug, marketData)
			return null
		}

		const endTimestamp = new Date(marketData.endDate).getTime()
		const startTimestamp = endTimestamp - duration * 60 * 1000
		const timestamp = Math.floor(startTimestamp / 1000)	//e.g. 1765584900

		const market: Market = {
			filePath: filePath,
			symbol: symbol.toLowerCase(),
			marketType: marketType,		//e.g. btc-updown-15m
			duration: duration,			//e.g. 15
			slug: marketSlug,			//e.g. btc-updown-15m-1765584900
			timestamp,					//e.g. 1765584900
			dayString: this.getUTCDateFormat(new Date(timestamp * 1000)),	//e.g. 2025-12-10
			startTimestamp,				//e.g. 1765584900000
			endTimestamp,				//e.g. 1765584900000 + 15 * 60 * 1000
			state: 'init',				//init, pending, started, running, completed, closed, failed
			closed: false,				//false: market is not closed, true: market is closed
			openPrice: null,			// priceToBeat
			openTicker: null,			// priceToBeat from ticker
			closePrice: null,			// finalPrice
			closeTicker: null,			// finalPrice from ticker
			openPriceTimestamp: null,	// timestamp of openPrice
			closePriceTimestamp: null,	// timestamp of closePrice
			closeMarketTimestamp: null,	// timestamp of closeMarket
			marketData: marketData,
			chartData: null,
			outcome: null
		}

		if (market.marketData?.closed) {
			market.closed = true
			const priceData = await this.getCryptoPrice(market)
			console.log('priceData:', priceData)
			if (priceData?.openPrice) {
				market.openPrice = priceData.openPrice
				market.openPriceTimestamp = priceData.timestamp || null
			}
			if (priceData?.closePrice) {
				market.closePrice = priceData.closePrice
				market.closePriceTimestamp = priceData.timestamp || null
			}
			const outcome = market.closePrice && market.openPrice ? (market.closePrice > market.openPrice ? 'up' : 'down') : null
			if (outcome !== market.outcome) {
				market.outcome = outcome
			}
		}

		await this.cacheMarket(market)
		await this.saveMarket(market)

		console.log('--------> market created:', market.slug, market)
		return market
	}


	// ---------------------------------------------------------------------------- getUTCTimestamp
	// Function to get the current 15-minute UTC timestamp (rounded down to nearest 15-minute interval)
	// date: e.g. 2025-12-10
	getUTCTimestamp(date: Date | number | null, duration: number = 15, offset: number = 0): number {
		if (!date) date = new Date()
		const dateTime = date instanceof Date ? date.getTime() : date
		const dateTimeSeconds = Math.floor(dateTime / 1000) + offset // Convert to seconds
		const minutesSeconds = duration * 60 // minutes in seconds
		// Round down to the nearest minutes interval
		const utcTimestamp = Math.floor(dateTimeSeconds / minutesSeconds) * minutesSeconds - offset

// const past = dateTime % (minutes * 60 * 1000)
// const maxTime = Math.ceil(minutes * 60)
// let timeoutMinutes = maxTime - Math.ceil(past / 1000)
// console.log('--------- timeoutMinutes:', timeoutMinutes / 60, 'utcTimestamp', utcTimestamp,  'offset:', offset, 'minutes:', minutes)

		return utcTimestamp
	}


	getCryptoPriceVariant(market: Market): string {
		if (market.marketType === 'updown-5m') return 'five'
		if (market.marketType === 'updown-15m') return 'fifteen'
		if (market.marketType === 'updown-1h') return 'hourly'
		if (market.marketType === 'updown-4h') return 'four-hourly'
		if (market.marketType === 'updown-1d') return 'daily'
		return 'fifteen'
	}


	// ---------------------------------------------------------------------------- getCryptoPrice
	// Get price to beat for a given symbol, event start time, and end date
	async getCryptoPrice(market: Market): Promise<CryptoPriceResponse | null> {
		console.log('getCryptoPrice:', market.slug, moment(market.startTimestamp).format('YYYY-MM-DD HH:mm'), '->', moment(market.endTimestamp).format('HH:mm'))
		const symbol = market.symbol
		
		// Format dates without milliseconds (API expects format: 2025-12-12T08:45:00Z)
		const formatDateWithoutMs = (timestamp: number): string => {
			const date = new Date(timestamp)
			const hours = String(date.getUTCHours()).padStart(2, '0')
			const minutes = String(date.getUTCMinutes()).padStart(2, '0')
			const seconds = String(date.getUTCSeconds()).padStart(2, '0')
			const dayString = this.getUTCDateFormat(date)
			return `${dayString}T${hours}:${minutes}:${seconds}Z`
		}
		
		const eventStartTime = formatDateWithoutMs(market.startTimestamp)
		const endDate = formatDateWithoutMs(market.endTimestamp)

		const url = `${this.polymarketApiBase}/crypto/crypto-price`
		const variant = this.getCryptoPriceVariant(market)
		const params = new URLSearchParams({
			symbol,
			eventStartTime,
			variant,
			endDate
		})

		const fullUrl = `${url}?${params.toString()}`
		
		try {
			const response = await fetch(fullUrl, {
				method: 'GET',
				headers: {
					'Accept': 'application/json',
					'Accept-Language': 'en-US,en;q=0.9',
					'Cache-Control': 'no-cache'
				},
				credentials: 'omit' // Don't send cookies, but match browser behavior
			})

			if (!response.ok) {
				const errorText = await response.text().catch(() => '')
				console.warn(
					`❌ getCryptoPrice failed: ${response.status} ${response.statusText}`,
					`URL: ${fullUrl}`,
					errorText
				)
				// console.log('❌ getCryptoPrice failed:', market)
				return null
			}
			
			const data = await response.json() as CryptoPriceResponse
			return data
		} catch (error) {
			console.error('❌ getCryptoPrice error:', error)
			return null
		}
	}

// !!! use market.fetchMarketBySlugFromGamma instead !!!
	// ---------------------------------------------------------------------------- fetchMarketBySlug
	async fetchMarketBySlug(slug: string, forceLoading: boolean = false): Promise<MarketData | null> {
		const url = `${GAMMA_API_BASE}/markets/slug/${slug}`
		// console.log(`-----> Fetching market by slug from Gamma API: ${url}`)

		const cachedMarket = forceLoading ? null : await cache.getItem<MarketData>(slug)
		if (cachedMarket) return cachedMarket

		const response = await fetch(url, {
			method: 'GET',
			headers: {
				Accept: 'application/json'
			}
		})
		if (!response.ok) return null
		
		const data = await response.json() as MarketData
		// console.log('-----> fetchMarketBySlug: data:', data.sourceData)
		// await cache.setItem<MarketData>(slug, data)
		return data
	}


	// ---------------------------------------------------------------------------- getMarketState
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
			market.state = 'completed'
			return market.state
		}
		if (now < startTime) return 'pending'
		if (market.openPrice) return 'running'
		return 'started'
	}


	// ---------------------------------------------------------------------------- onMarketTimer
	onMarketTimer(endTimestamp: number,
		onTimer?: (t: { minutes: number; seconds: number; isExpired: boolean }) => void
	): void {
		let interval: NodeJS.Timeout | null = null

		const updateTimer = () => {
			if (!onTimer){
				if (interval) clearInterval(interval)
				return
			}
			const now = new Date()
			const diff = endTimestamp - now.getTime()
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


	// ---------------------------------------------------------------------------- cacheMarket
	async cacheMarket(market: Market): Promise<void> {
		console.log('market cached:', market.slug, 'openPrice:', market.openPrice, 'closePrice:', market.closePrice)
		await cache.setItem(market.slug, market)
	}


	// ---------------------------------------------------------------------------- openMarket
	async openMarket(market: Market): Promise<CryptoPriceResponse | null> {
		if (!this.get('marketActive')) return null

		const result = await this.getCryptoPrice(market)
		if (result?.openPrice) {
			market.openPrice = result.openPrice
			market.openPriceTimestamp = result.timestamp || null

			await this.cacheMarket(market)	//update market cache
			await this.saveMarket(market)	//save market to file
		}
		return result
	}


	// ---------------------------------------------------------------------------- pollingOpenPrice
	async pollingOpenPrice(market: Market): Promise<CryptoPriceResponse | null> {
		const api = this as PolymarketApi
		return new Promise(async (resolve, reject) => {
			if (!api.get('marketActive')) return reject('Market is not active')

			async function _pollingOpenPrice() {
				if (!api.get('marketActive')) return reject('Market is not active')
				// console.log('pollingMarketPrice:', type, market.slug, market.openPrice, market.closePrice, '...')

				const result = await api.getCryptoPrice(market)
				if (result?.openPrice) {
					market.openPrice = result.openPrice
					market.openPriceTimestamp = result.timestamp || null

					await api.cacheMarket(market)	//update market cache
					await api.saveMarket(market)	//save market to file
					resolve(result)

				}else{
					await new Promise(resolve => setTimeout(resolve, 5000))
					_pollingOpenPrice()
				}
			}

			await new Promise(resolve => setTimeout(resolve, 5000))	//wait 5 seconds before polling
			_pollingOpenPrice()
		})
	}


	// ---------------------------------------------------------------------------- closeMarket
	async closeMarket(market: Market): Promise<void> {
		if (!this.get('marketActive')) return

		const result = await this.getCryptoPrice(market)
		if (result?.openPrice){
			market.openPrice = result.openPrice 	//update missing openPrice
			market.openPriceTimestamp = result.timestamp || null
		}
		if (result?.closePrice) {
			market.closePrice = result.closePrice
			market.closePriceTimestamp = result.timestamp || null
			// return _pollingClosedMarket()	//not needed

			market.closeMarketTimestamp = Date.now()
			market.state = 'closed'
			market.closed = true
			console.log('market closed:', market.slug)
			
		}else{
			market.state = 'completed'

		}
		await this.cacheMarket(market)	//update market cache
		await this.saveMarket(market)
	}


	// ---------------------------------------------------------------------------- pollingClosePrice
	async pollingClosePrice(market: Market){
		const api = this
		if (!api.get('marketActive')) return
	
		async function _pollingClosePrice() {
			if (!api.get('marketActive')) return

			// console.log('pollingMarketPrice:', type, market.slug, market.openPrice, market.closePrice, '...')
			const result = await api.getCryptoPrice(market)
			if (result && !market.openPrice && result.openPrice){
				market.openPrice = result.openPrice 	//update missing openPrice
				market.openPriceTimestamp = result.timestamp || null
			}
			if (result?.closePrice) {
				market.closePrice = result.closePrice
				market.closePriceTimestamp = result.timestamp || null
				// return _pollingClosedMarket()	//not needed

				market.closeMarketTimestamp = Date.now()
				market.state = 'closed'
				market.closed = true

				await api.cacheMarket(market)	//update market cache
				await api.saveMarket(market)
				console.log('market closed:', market.slug)
				return

			}else{
				await new Promise(resolve => setTimeout(resolve, 15000))
				_pollingClosePrice()
				return
			}
		}

		// Function is called recursively but initial call is commented out
		// @ts-expect-error - Function is intentionally unused (initial call commented out)
		async function _pollingClosedMarket(): Promise<void> {
			if (!api.get('marketActive')) return

			const marketData = await fetchMarketBySlugFromGamma(market.slug || '')
			if (marketData?.closed){
				market.marketData = marketData
				market.closeMarketTimestamp = Date.now()
				market.state = 'closed'

				await api.cacheMarket(market)	//update market cache
				await api.saveMarket(market)
				console.log('market closed:', market.slug)
				return

			}else{
				await new Promise(resolve => setTimeout(resolve, 15000))	//wait 15 seconds before polling again
				_pollingClosedMarket()
				return
			}
		}

		await new Promise(resolve => setTimeout(resolve, 90000))	//wait 1:30 minute before start polling for closed price
		_pollingClosePrice()
	}


	// ---------------------------------------------------------------------------- setCurrentDay
	streams: Map<string, import('fs').WriteStream> = new Map()
	currentDay: {
		nextDay: number,
		dayString: string,
	} = { nextDay: 0, dayString: '' }

	setCurrentDay(timestamp: number) {
		const dateObj = new Date(timestamp)
		const nextDay = Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate() + 1, 0, 0, 0, 0)
		const dayString = this.getUTCDateFormat(dateObj)

		this.currentDay = {
			nextDay,
			dayString
		}
		console.log('setCurrentDay:', this.currentDay)
	}

	
	// ---------------------------------------------------------------------------- onTickerLog
	async onTickerLog(symbol: string, timestamp: number, price: number) {
		if (!this.get('loggingActive')) return
		if (!this.currentDay || timestamp >= this.currentDay.nextDay) this.setCurrentDay(timestamp)

		if (!this.streams.has(symbol + '-' + this.currentDay.dayString)){
			const dirPath = this.rootPath + 'tickers/' + symbol
			if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, {recursive: true})
			const filePath = dirPath + '/' + symbol + '-' + this.currentDay.dayString + '.log'
			console.log('createWriteStream:', filePath)
			this.streams.set(symbol + '-' + this.currentDay.dayString, fs.createWriteStream(filePath, {flags:'a'}))
		}

		this.streams.get(symbol + '-' + this.currentDay.dayString)?.write(timestamp + ';' + price + '\n')
	}


	// ---------------------------------------------------------------------------- onTickerLog
	async onPollingLog(symbol: string, timestamp: number, price: number) {
		this.set('pollingPrice-' + symbol, {timestamp: timestamp, price: price})

		if (!this.get('loggingActive')) return

		if (!this.currentDay || timestamp >= this.currentDay.nextDay) this.setCurrentDay(timestamp)

		if (!this.streams.has(symbol + '-polling-' + this.currentDay.dayString)){
			const dirPath = this.rootPath + 'polling/' + symbol
			if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, {recursive: true})
			const filePath = dirPath + '/' + symbol + '-' + this.currentDay.dayString + '.log'
			// console.log('createWriteStream:', filePath)
			this.streams.set(symbol + '-polling-' + this.currentDay.dayString, fs.createWriteStream(filePath, {flags:'a'}))
		}

		this.streams.get(symbol + '-polling-' + this.currentDay.dayString)?.write(timestamp + ';' + price + '\n')
	}


	// ---------------------------------------------------------------------------- onTradeLog
	async onTradeLog(symbol: string, slug: string, log: string) {
		if (!this.get('loggingActive')) return
		if (!this.streams.has(slug)) {
			const dirPath = this.rootPath + 'markets/' + symbol + '/' + this.currentDay.dayString
			if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, {recursive: true})
			const filePath = dirPath + '/' + slug + '.log'
			console.log('createWriteStream:', filePath)
			this.streams.set(slug, fs.createWriteStream(filePath, {flags:'a'}))
		}

		this.streams.get(slug)?.write(log + '\n')
	}


	// ---------------------------------------------------------------------------- saveMarket
	async saveMarket(market: Market, force: boolean = false): Promise<void> {
		if (!force && !this.get('loggingActive')) return

		let filePath: string = ''
		if (market.filePath) {
			filePath = market.filePath

		}else{
return
			let symbol = market.symbol.toLowerCase()
			// console.log('saveMarket:', market.slug, market.openPrice, market.closePrice)
			const dirPath = this.rootPath + 'markets/' + symbol + '/' + market.dayString
			if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, {recursive: true})
			filePath = dirPath + '/' + market.slug + '.json'
		}

		await fsPromises?.writeFile(filePath, JSON.stringify(market, null, '\t'))
		console.log('market saved to:', filePath)
	}


	// ---------------------------------------------------------------------------- getDateFormat
	// Format date to yyyy-mm-dd
	getUTCDateFormat(date: Date): string {
		return date.toISOString().substring(0, 10)		//yyyy-mm-dd
	}

	getUTCDateTime(date: Date): string {
		return date.toISOString().substring(0, 19)		//yyyy-mm-dd HH:MM:SS
	}

	getUTCTime(date: Date): string {
		return date.toISOString().substring(11, 19)		//HH:MM:SS
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

