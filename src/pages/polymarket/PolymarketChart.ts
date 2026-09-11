import type { Market } from '@/lib/polymarket/types';
import PolymarketApi from './PolymarketApi'
import moment from 'moment';

const isElectron = window?.navigator.userAgent.includes('Electron')
const fs = isElectron ? (window as any)?.require?.('fs') : null
const fsPromises = isElectron ? (window as any)?.require?.('fs/promises') : null
// const path = isElectron ? (window as any)?.require?.('path') : null;

let isRunning = false
let tickerDataCache: any = {} // ticker data cache

export const preOffset = 40000		//get tickerdata 40 seconds before startTimestamp
export const postOffset = 20000	//get tickerdata 20 seconds after endTimestamp
const chartDataVersion = 6


// ---------------------------------------------------------------------------- fixingClobData
export const fixingClobData = async (type: string = 'updown-5m') => {
	if (isRunning){
		console.log('fixingClobData canceled!')
		isRunning = false
		return
	}
	isRunning = true

	console.log('\n--- fixingClobData running', type, '...')
	const marketKeys = await PolymarketApi.cache.keys()
	const updateKeys = marketKeys.filter((key: string) => key.includes(type))

const openMarkets: string[] = []

	console.log('updateKeys:', updateKeys.length, 'from', marketKeys.length, type, 'markets ...')

	let count = 0
	let index = 0
	for (const key of updateKeys) {		
		index++
		if (!isRunning) break

		const market = await PolymarketApi.cache.getItem(key)

		// const updated = await update_1(market)
		const marketIsOpen = marketIsOpenCheck(market || null)

		if (marketIsOpen) {
			count++
			openMarkets.push(market.slug)
			// await PolymarketApi.cacheMarket(market)
			// await PolymarketApi.saveMarket(market, true)
		}

		if (index % 10000 === 0){
			// console.clear()
			console.log('market updated:', count, index, '/', updateKeys.length, market.slug)
		}
		// console.log('')
	}

// update open markets in store
await PolymarketApi.store.setItem('openMarkets', openMarkets)

	console.log('fixing clob data complete!', count, 'markets updated')
	isRunning = false
}


// ---------------------------------------------------------------------------- fixingMarketData
export const fixingMarketData = async () => {
	console.log('\n--- fixing market data...')

	// 10.09.2026 first: 1788998400, last: 1789084500
	const list = indexList.filter((item: any) => item.symbol === 'sol' && item.type === 'updown-5m' && item.timestamp >= 1788998400 && item.timestamp <= 1789084500)

	console.log('update markets:', list.length, '...')

	for (const item of list) {	
		const market = await PolymarketApi.cache.getItem(item.name)
		if (market && market.closed) {
			const eventMetadata = market.marketData?.sourceData?.events[0]?.eventMetadata
			const outcome = eventMetadata?.finalPrice >= eventMetadata?.priceToBeat ? 'up' : 'down'

			if (!eventMetadata || !eventMetadata.priceToBeat || !eventMetadata.finalPrice) {
				console.log('update market:', market.slug)
				market.openPrice = null
				market.closePrice = null
			}else if (market.openPrice !== eventMetadata.priceToBeat || market.closePrice !== eventMetadata.finalPrice || market.outcome !== outcome){
				console.log('update market:', market.slug)
				market.openPrice = eventMetadata.priceToBeat
				market.closePrice = eventMetadata.finalPrice
				market.outcome = outcome
			}else continue

			await updateMarketData_clob(item.name, item.filePath, false)
		}
	}

	console.log('fixing market data complete!')
}


// ---------------------------------------------------------------------------- marketIsOpenCheck
export const marketIsOpenCheck = (market: Market | null) => {
	if (!market) return false
	if (market.state === 'failed') return false
	if (market.state === 'init' || market.state === 'pending') return true
	if (!market.closed) return true
	// market is closed
	if (market.chartData?.version !== chartDataVersion) return true
	if (!market.chartData._complete) return true
	if (market.chartData?.ticker?.chainlink && market.chartData.ticker.chainlink._complete === undefined) return true
	if (market.chartData?.ticker?.coinbase && market.chartData.ticker.coinbase._complete === undefined) return true
	if (market.chartData?.ticker?.binance && market.chartData.ticker.binance._complete === undefined) return true

	return false
}

// ---------------------------------------------------------------------------- update_1
const update_1 = async (market: Market) => {
	let updated = false
	if (!market?.chartData?.clob) return updated

	//--- update ticker data complete state
	const timeLimit = market.duration / 5 * 60 * 1000
	const firstTimestamp = market.startTimestamp + timeLimit
	const lastTimestamp = market.endTimestamp - timeLimit
	for (const source of Object.keys(tickerDataSources)) {
		if (source === 'clob') continue
		const tickerData = market.chartData.ticker[source]
	
		if (tickerData && tickerData._complete === undefined){
			tickerData._complete = tickerData.length > 20
				&& tickerData[0][0] < firstTimestamp
				&& tickerData[tickerData.length-1][0] > lastTimestamp
	
			updated = true
		}
	}
	if (updated){
		console.log('update ticker data complete state:')
		market.chartData._complete = true
	}
	
	//--- update chartData version
	if (market.closed && market.chartData?.version !== chartDataVersion) {
// console.log('update chartData version:', market.slug, market.chartData?.version, 'to', chartDataVersion)
		market.chartData.clob._complete = updateClobDataComplete(market)
		market.chartData._complete = true
		market.chartData.version = chartDataVersion
		updated = true
	}

	//--- fixing openPrice from Gamma eventMetadata (authoritative after TWAP switch)
	const settlement = PolymarketApi.getGammaSettlement(market.marketData)
	const priceToBeat = settlement.priceToBeat
	if (priceToBeat && market.openPrice && (priceToBeat / market.openPrice > 1.0001 || market.openPrice / priceToBeat > 1.0001)) {
		market.openPrice = null
		const upd = await updatePriceData(market)
		if (upd) {
			console.log('update openPrice:', market.slug, priceToBeat, 'market.openPrice:', market.openPrice)
			updated = true
		}
	}
	return updated
}



// ---------------------------------------------------------------------------- dataTest
export const dataTest_3 = async (symbol: string, source: string = 'coinbase') => {
	console.log('dataTest_3 running', symbol, '...')

	const _symbol = symbol !== 'all'? symbol + '-updown-15m' : 'updown-15m'
	const markets = await PolymarketApi.getAllMarkets(_symbol, new Date('2026-01-01').getTime())
	if (!markets.length) return

	const heatmap = await PolymarketApi.store.getItem('heatmap') || {}
	console.log('heatmap:', heatmap)

	const steps = 40

	const s2 = steps / 2
	const map = Array.from({ length: 15 }, (_, t) =>
		Array.from({ length: steps }, (_, v) => ({ t, value:(v-s2)/20, count:0, c_up:0, c_down:0, up:0, down:0, weight:0 }))
	)
	const stats = {
		map,
		total: markets.length,
		inValid: 0,
		valid: 0,
		timestamp: new Date().getTime(),
	} as any

	for (const market of markets) {
		const tickerData = market.chartData?.ticker?.[source]
		if (!tickerData?._complete) continue

		stats.valid++

		const basePrice = tickerData[0][1]
		const baseGrid = Array.from({ length: 15 }, () => Array(steps).fill(0))
		// console.log('baseGrid:', baseGrid)

		for (const item of tickerData) {
			const t = Math.floor((item[0] - market.startTimestamp) / 60000)	//minute value (0-14)
			if (t < 0 || t > 14) continue

			const ratio = Math.floor(((item[1] / basePrice) - 1) * 1000 * 2) + s2	//+- 1%
			const value = Math.max(Math.min(ratio, steps-1), 0)	//min:0, max:19, med:10
			baseGrid[t][value] = 1
		}

		for (let t = 0; t < 15; t++) {
			for (let value = 0; value < steps; value++) {
				if (baseGrid[t][value] === 0) continue

				map[t][value].count++
				if (market.outcome === 'up') map[t][value].c_up++
				else map[t][value].c_down++
			}
		}
	}

	// smoothValues(ranges[t])

	for (let t = 0; t < 15; t++) {
		for (let value = 0; value < steps; value++) {
			const cell = map[t][value]
			if (cell.c_up === 0 && cell.c_down === 0){
				cell.up = 0
				cell.down = 0
			}else if (cell.c_up === 0){
				cell.up = 0
				cell.down = 1
			}else if (cell.c_down === 0){
				cell.up = 1
				cell.down = 0
			}else{
				const ratio = cell.c_up / cell.c_down
				cell.up = ratio > 1 ? ratio / (ratio + 1) : 1 / ((1 / ratio) + 1)
				cell.up = parseFloat(cell.up.toFixed(2))
				cell.down = parseFloat((1 - cell.up).toFixed(2))
			}
			cell.weight = cell.count === 0 ? 0 : cell.count / stats.valid 
		}
	}

	stats.inValid = stats.total - stats.valid

	console.log(stats)

	heatmap[_symbol] = stats
	await PolymarketApi.store.setItem('heatmap', heatmap)
}


// ---------------------------------------------------------------------------- dataTest
export const dataTest_2 = async (symbol: string, source: string = 'coinbase') => {
	console.log('dataTest_2 running', symbol, '...')

	const _symbol = symbol !== 'all'? symbol + '-updown-15m' : 'updown-15m'
	const markets = await PolymarketApi.getAllMarkets(_symbol, new Date('2026-02-07').getTime())
	if (!markets.length) return

	const stats = {
		source: source,		//coinbase, binance, etc.
		symbol: symbol,
		total: markets.length,
		inValid: 0,
		valid: 0,
		up: {
			limit: 1.002,
			priceLimit: 0.7,
			count: 0,
			won: 0,
			lost: 0,
			pnl: 0,
			value: 0,
			trades: [] as any[],
		},
		dn: {
			limit: 1.002,
			priceLimit: 0.7,
			count: 0,
			won: 0,
			lost: 0,
			pnl: 0,
			value: 0,
			trades: [] as any[],
		},
		count: 0,
		pnl: 0,
		value: 0,
	}

	for (const market of markets) {
		const tickerData = market.chartData?.ticker?.[source]
		if (tickerData) parseTickerData(tickerData, market, stats)
	}

	stats.inValid = stats.total - stats.valid
	stats.count = stats.up.count + stats.dn.count
	stats.pnl = parseNum(stats.up.pnl + stats.dn.pnl)
	stats.up.value = parseNum(100 * stats.up.pnl / stats.up.count)
	stats.dn.value = parseNum(100 * stats.dn.pnl / stats.dn.count)
	stats.value = parseNum(100 * stats.pnl / stats.count)

	console.table(stats)
}


// ---------------------------------------------------------------------------- parseTickerData
const parseTickerData = (tickerData: any[], market: Market, stats: any) => {
	if (!market.chartData?.clob?._complete) return null

	const ups = market.chartData.clob.up
	const downs = market.chartData.clob.down
	const startPrice = tickerData[0][1]
	const upPrice = startPrice * stats.up.limit
	const downPrice = startPrice / stats.dn.limit
	let pnl = 0
	let up: any = null
	let dn: any = null

	let item = tickerData.find((e: any) => e[1] >= upPrice)
	if (item){
		up = ups.find((e: any) => e[0] >= item[0] && e[1] <= stats.up.priceLimit)	//get up price at current timestamp  && e[1] <= 0.6
	}
	item = tickerData.find((e: any) => e[1] <= downPrice)
	if (item){
		dn = downs.find((e: any) => e[0] >= item[0] && e[1] <= stats.dn.priceLimit)	//get down price at current timestamp  && e[1] <= 0.6
	}

	// if (up && !dn?.[0] || (dn?.[0] > up?.[0])){
	if (up){
		stats.valid++
		stats.up.count++
		if (market.outcome === 'up'){
			pnl = parseNum((1 / up[1]) - 1)
			stats.up.won++
		}else{
			pnl = -1
			stats.up.lost++
		}
		stats.up.pnl = parseNum(stats.up.pnl + pnl)
		stats.up.trades.push([market.outcome, up[0], up[1], pnl, stats.up.pnl])
	}
	// }else if (dn){
	if (dn){
		stats.valid++
		stats.dn.count++
		if (market.outcome === 'down'){
			pnl = parseNum((1 / dn[1]) - 1)
			stats.dn.won++
		}else{
			pnl = -1
			stats.dn.lost++
		}
		stats.dn.pnl = parseNum(stats.dn.pnl + pnl)
		stats.dn.trades.push([market.outcome, dn[0], dn[1], pnl, stats.dn.pnl])
	}
}


const parseNum = (num: number, toFixed: number = 3) => {
	return parseFloat(num.toFixed(toFixed))
}


// ---------------------------------------------------------------------------- dataTest
export const dataTest = async (symbol: string) => {
	console.log('dataTest running', symbol, '...')

	const dataFiles = await getAllMarkets_clob(symbol)

	const stats = {
		total: 0,
		inValid: 0,
		valid: 0,
		up: 0,
		dn: 0,
		pnlUp: 0,
		pnlDn: 0,
	}

	// let count = 0
	for (const file of dataFiles) {
		// count++
// if (count > 100) continue

		const market = await getMarket(file.slug)
		if (!market || market.chartData?._incomplete) continue
		if (!market.chartData?.ticker?.binance?.length) continue
		// console.log('market:', market.slug)

		const binance = market.chartData.ticker.binance
		const ups = market.chartData.clob.up
		const downs = market.chartData.clob.down

		if (binance._incomplete) continue

		const first = binance[0]
		const last = binance[binance.length-1]
		if (first[0] - market.startTimestamp > 3 * 60 * 1000) continue
		if (market.endTimestamp - last[0] > 3 * 60 * 1000) continue

		stats.total++

		const startPrice = binance[0][1]
		const limitPrice = startPrice * 1.0002

		const item = binance.find((e: any) => e[1] >= limitPrice)
		if (!item){
			stats.inValid++
			continue
		}

		const up = ups.find((e: any) => e[0] >= item[0])		//get up price at current timestamp
		// if (up) up[1] = 0.58
		// if (up) up = ups.find((e: any) => e[0] > up[0] && e[1] <= up[1] / 0.99)		//limit price

		const down = downs.find((e: any) => e[0] >= item[0])
		if (!up && !down){
			stats.inValid++
			continue
		}

		stats.valid++
		if (market.outcome === 'up'){
			stats.up++
			if (up) stats.pnlUp += (1 / up[1]) - 1
			if (down) stats.pnlDn -= 1
			// stats.pnlUp += (1 / up[1]) - 1
			// stats.pnlDn -= 1
		}else{
			stats.dn++
			if (up) stats.pnlUp -= 1
			if (down) stats.pnlDn += (1 / down[1]) - 1
			// stats.pnlUp -= 1
			// stats.pnlDn += (1 / down[1]) - 1
		}
	}

	console.table(stats)
}


// ---------------------------------------------------------------------------- dataTest
export const dataTest_1 = async (symbol: string) => {
	///

	const stats = {
		middleUp: {
			count: 0,
			up: 0,
			down: 0,
			trades: 0,
			pnl: 0
		},
		middleDown: {
			count: 0,
			up: 0,
			down: 0,
			trades: 0,
			pnl: 0
		},
		end: {
			count: 0,
			up: 0,
			down: 0,
		},
	} as any

	const keys = await PolymarketApi.cache.keys()
	console.log('dataTest running', symbol, keys.length, 'markets ...')

	const limit = 7.5 * 60 * 1000	//7.5 minutes
	const market = symbol !== 'all'? symbol + '-updown-15m' : 'updown-15m'

	for (const key of keys) {
		if (key.includes(market)) {
			const market = await PolymarketApi.cache.getItem(key)
			if (market && market.closed && market.chartData?.ticker?.length) {
				stats.end.count++

				const ticker = market.chartData.ticker

				const openPrice = market.openPrice
				const outcome = market.outcome
				const startTimestamp = market.startTimestamp
				const middleTimestamp = startTimestamp + limit

				if (outcome === 'up') {
					stats.end.up++
				}else {
					stats.end.down++
				}

				// if (ticker[ticker.length-1][1] > openPrice) {
				// 	stats.priceUp++
				// }else {
				// 	stats.priceDown++
				// }

				const middle = ticker.find((item: any) => item[0] >= middleTimestamp)
				if (middle) {
					if (middle[1] > openPrice) {
						stats.middleUp.count++

						const priceUp = market.chartData.up.find((item: any) => item[0] >= middleTimestamp && item[1] <= 0.5)
						if (priceUp){
							stats.middleUp.trades++
							stats.middleUp[outcome]++
							stats.middleUp.pnl += outcome === 'up' ? (1/0.5)-1 : -1
						}
					}else {
						stats.middleDown.count++

						const priceDown = market.chartData.down.find((item: any) => item[0] >= middleTimestamp && item[1] <= 0.5)
// if (stats.middleDown.count < 10){
// 	console.log('middleDown:', priceDown)
// }
						if (priceDown){
							stats.middleDown.trades++
							stats.middleDown[outcome]++
							stats.middleDown.pnl += outcome === 'down' ? (1/0.5)-1 : -1
						}
					}
				}
			}
		}
	}

	console.table(stats)
}


// ------------------------------------------------------------------------ parseNumber
// const parseNumber = (num: number, float: number | null = null) => {
// 	if (float) num = parseFloat(num.toFixed(float))
// 	return parseFloat(num.toPrecision(12))
// }
const parseNumber = (num: number) => {
	return parseFloat(num.toFixed(12))
}


// ---------------------------------------------------------------------------- getAllMarkets_clob_2
let indexList: any[] = []
// let completeList: any = {} as any	//.csv files alrey completed to ignore them


export const getAllMarkets_clob = async (
	symbol: string | null = null,
	date: Date | null = null,
	clearCache: boolean = false) => {
	console.log('getAllMarkets_clob', symbol || '', date || '', '... (clearCache:', clearCache, ')')

	// completeList = await PolymarketApi.store.getItem('completeList') as any || {} as any

	indexList = clearCache? [] : await PolymarketApi.store.getItem('indexCache') as any[] || []

	if (!indexList?.length){
		indexList = await PolymarketApi.createIndexCache()
	}
	if (!indexList?.length) return []

	const dateString = (date || new Date()).toISOString().substring(0, 10);		//e.g. 2026-04-02

	const fileList: any[] = indexList.filter((entry: any) =>
		(symbol ? entry.symbol === symbol : true)
		&& (date ? entry.dateString === dateString : true)
	).map((entry: any) => ({
		// folder: entry.parentPath.replaceAll('\\', '/'),
		// fileName: entry.name,
		filePath: entry.path,
		name: entry.name,
		slug: entry.name,
		timestamp: entry.timestamp,
		date: date,
		dateString: entry.dateString,
		symbol: entry.symbol,
		type: entry.type,
	}));

	return fileList;
}

// ---------------------------------------------------------------------------- getCustomDateString
// convert dateString like june-23-2026-10am to timestamp 1765406700
const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const getDateStringToTimestamp = (dateString: string): number => {
	dateString = dateString.replace('.csv', '')
	dateString = dateString.split('up-or-down-')[1] || dateString.split('-')[0];
	const [monthStr, dayStr, yearStr, hourStr] = dateString.split('-') as any;
	let hour = parseInt(hourStr.replace('am', '').replace('pm', ''));
	if (hour === 12) hour = 0;
	if (hourStr.includes('pm') && hour < 12) hour += 12;
	if (!monthStr || !dayStr || !yearStr || isNaN(hour)) return 0;
	const date = new Date(parseInt(yearStr), monthNames.indexOf(monthStr), parseInt(dayStr), hour, 0, 0, 0);
	return Math.floor(date.getTime() / 1000);
}

const tickerDataSources: any = {
	clob: {
		importPath: 'H:/DEV/TRADE/POLY/bot-3/logs/clob',
		exportPath: 'A:/DATA/polymarket/',
	},
	chainlink: {
		importPath: 'H:/DEV/PY/polymarket/chainlink_price_ticker/logs/chainlink',
		exportPath: 'A:/DATA/polymarket/chainlink/',
		symbols: {
			btc: 'btcusd',
			eth: 'ethusd',
			sol: 'solusd',
			xrp: 'xrpusd',
		}
	},
	'chainlink-twap': {
		importPath: 'H:/DEV/PY/polymarket/chainlink_twap_ticker/logs/chainlink',
		exportPath: 'A:/DATA/polymarket/chainlink-twap/',
		symbols: {
			btc: 'btcusd',
			eth: 'ethusd',
			sol: 'solusd',
			xrp: 'xrpusd',
		}
	},
	binance: {
		importPath: 'H:/DEV/PY/polymarket/binance_price_ticker/logs/binance',
		exportPath: 'A:/DATA/polymarket/binance/',
		symbols: {
			btc: 'btcusdt',
			eth: 'ethusdt',
			sol: 'solusdt',
			xrp: 'xrpusdt',
		}
	},
	polling: {
		importPath: 'H:/DEV/PY/polymarket/binance_polling_ticker/logs/binance',
		exportPath: 'A:/DATA/polymarket/binance-polling/',
		symbols: {
			btc: 'btcusdt',
			eth: 'ethusdt',
			sol: 'solusdt',
			xrp: 'xrpusdt',
		}
	},
	coinbase: {
		importPath: 'H:/DEV/PY/polymarket/coinbase_price_ticker/logs/coinbase',
		exportPath: 'A:/DATA/polymarket/coinbase/',
		symbols: {
			btc: 'btc-usd',
			eth: 'eth-usd',
			sol: 'sol-usd',
			xrp: 'xrp-usd',
		}
	},
	kraken: {
		importPath: 'H:/DEV/PY/polymarket/kraken_price_ticker/logs/kraken',
		exportPath: 'A:/DATA/polymarket/kraken/',
		symbols: {
			btc: 'xbtusd',	
			eth: 'ethusd',
			sol: 'solusd',
			xrp: 'xrpusd',
		}
	},
}


// ---------------------------------------------------------------------------- updateMarketData
export const getMarket = async (slug: string, filePath: string | null = null, useCache: boolean = true): Promise<Market | null> => {
	// get market from cache ...
	let market = useCache ? await PolymarketApi.cache.getItem(slug) as Market | null : null

	if (!market && filePath) {		//market not cached! load and update market from file
		const exists = fs.existsSync(filePath)
		if (exists && useCache) {
			console.log('reload market from file:', filePath)
			const jsonFileContent = await fsPromises.readFile(filePath, 'utf8')
			market = JSON.parse(jsonFileContent) as Market
			await PolymarketApi.cacheMarket(market)		//reload market cache
	
		}else{
			if (!exists) console.log('market file not found:', filePath)
			// Caller (updateMarketData_clob) persists once after chart/price updates
			market = await PolymarketApi.createMarketFromSlug(slug, filePath, false)
		}
	}

	return market
}


// ---------------------------------------------------------------------------- updateAllMarketData_clob
// updateClobData
export const updateAllMarketData_clob = async () => {
	if (isRunning){
		console.log('updateAllMarketData_clob canceled!')
		isRunning = false
		return
	}
	isRunning = true

	console.log('updateAllMarketData_clob ...')
	tickerDataCache = {} as any		//clear ticker data cache
	
	// get all existing open markets from store
	let openMarkets = await PolymarketApi.store.getItem('openMarkets') as string[]
	const all = openMarkets? false : true
	openMarkets = openMarkets || []


	console.log('openMarkets:', openMarkets.length)
	const openMarketsLookup = openMarkets.reduce((acc: any, slug: string) => {
		acc[slug] = true
		return acc
	}, {})

	const stat = {
		total: openMarkets.length,
		skipped: 0,
		new: 0,
		closed: 0,
		updated: 0,
		open: 0,
	}

	let count = 0
	for (const slug of openMarkets) {
		if (!isRunning) break

		// update cached market or create new market
		const {market, updated} = await updateMarketData_clob(slug, null, false)
		if (updated) stat.updated++

		const marketIsOpen = marketIsOpenCheck(market || null)
		if (!marketIsOpen) {
			delete openMarketsLookup[slug]
			stat.closed++
		}

		count++
		console.log('update open market:', count, '/', openMarkets.length, 'update:', stat.updated, 'closed:', stat.closed)
		// if (market && market.closed && (market.state === 'failed' || market.chartData._complete)){
		// 	delete openMarketsLookup[slug]
		// 	stat.closed++
		// }
	}

	// update open markets in store
	openMarkets = Object.keys(openMarketsLookup)
	console.log('save new openMarkets:', openMarkets.length)
	await PolymarketApi.store.setItem('openMarkets', openMarkets)

	const last = await PolymarketApi.store.getItem('lastUpdate_clobData') || 0
	const now = Date.now()
	await PolymarketApi.store.setItem('lastUpdate_clobData', now)

	// get all clob market data .csv files
	//clear cache if last update is more than 1 hour ago
	const dataFiles = await getAllMarkets_clob(null, null, now - last > 60 * 60 * 1000)
	console.log('Updating all market data from clob:', dataFiles.length, 'files ...')
	console.log('last:', moment(last).format('YYYY-MM-DD HH:mm:ss'), 'now:', moment(now).format('YYYY-MM-DD HH:mm:ss'))

	// get all existing market keys from cache
	const marketKeys = await PolymarketApi.cache.keys()
	const marketLookup = marketKeys.reduce((acc: any, key: string) => {
		acc[key] = true
		return acc
	}, {})

	for (const file of dataFiles) {
		if (!isRunning) break

		if (!all && marketLookup[file.slug]) {		//market is cached
			if (!openMarketsLookup[file.slug]){		//market is not open
				stat.skipped++
				continue
			}
		}else{
			stat.new++
		}

		// update cached market or create new market
		const {market, updated} = await updateMarketData_clob(file.slug, file.filePath)
		if (updated) stat.updated++

		const marketIsOpen = marketIsOpenCheck(market || null)
		if (marketIsOpen) {
			stat.open++
			openMarketsLookup[file.slug] = true
		}else{
			stat.closed++
			delete openMarketsLookup[file.slug]
		}

		// if (!market || !market.closed || market.state === 'init' || (market.state !== 'failed' && !market.chartData._complete)){
		// 	stat.open++
		// 	openMarketsLookup[file.slug] = true
		// }else{
		// 	delete openMarketsLookup[file.slug]
		// 	stat.closed++
		// }
	}

	// update open markets in store
	openMarkets = Object.keys(openMarketsLookup)
	console.log('save new openMarkets:', openMarkets.length)
	await PolymarketApi.store.setItem('openMarkets', openMarkets)

	console.log('complete!', stat)
	isRunning = false
}


// ---------------------------------------------------------------------------- updateMarketData
// from market list item "Update" button
// or updateAllMarketData_clob (Update clob data)
// csvPath sample: A:/DATA/polymarket/clob/btc-updown-5m/2026-04-02/btc-updown-5m-1775127000.csv
export const updateMarketData_clob = async (slug: string, csvPath: string | null = null, useCache: boolean = true)
	: Promise<{market: Market | null, updated: boolean}> => {
	let updated:boolean = false
	// let market: Market | null = null
	if (!csvPath) csvPath = PolymarketApi.getClobFileFromSlug(slug)
	if (!csvPath) return {market: null, updated: false}
	
	const filePath = csvPath.replace('.csv', '.json')

	if (!useCache) 	tickerDataCache = {} as any		//clear ticker data cache

	const market = await getMarket(slug, filePath, useCache)  //-> createMarketFromSlug or load from file
	if (!market){
		console.log('market not exists!', slug)
		return {market: null, updated: false}
	}
	if (market.state === 'failed'){
		console.log('market failed!', slug)
		await PolymarketApi.cacheMarket(market)
		await PolymarketApi.saveMarket(market, true)
		return {market: market, updated: false}
	}

	// if (market.state === 'failed') return {market: null, updated: false}

	if (!fs.existsSync(filePath)){
// console.log(1)
		updated = true	//market file not saved
	}

	if (!market.marketData || (!market.marketData.closed && Date.parse(market.marketData.endDate || '') < Date.now())) {
		market.marketData = await PolymarketApi.fetchMarketBySlug(slug, true)
		if (!market.marketData) market.state = 'failed'
// console.log(2)
		updated = true
	}

	if (market.symbol === 'bitcoin'){		//fixing wrong symbol
		market.symbol = 'btc'
// console.log(3)
		updated = true
	}

	if (!market.duration){
		if (market.marketData?.endDate){
			market.marketType = PolymarketApi.getMarketTypeFromPath(filePath) || ''
			delete market["marketName"]		//remove marketName from market object to prevent confusion
			market.duration = PolymarketApi.getMarketDurationFromType(market.marketType) || 0
			market.endTimestamp = new Date(market.marketData.endDate).getTime()
			market.startTimestamp = market.endTimestamp - market.duration * 60 * 1000
// console.log(4)
			updated = true
		}
	}

	if (market.marketData?.closed){
		updated = updated || await updatePriceData(market)
		
		// if (!useCache || !market.chartData?._complete || market.chartData?.version !== chartDataVersion) {
		if (!useCache || (market.state !== 'init' && market.state !== 'failed') && (!market.chartData?._complete || market.chartData?.version !== chartDataVersion)) {
			market.chartData = await getClobTickerData(market, csvPath)
			market.chartData.clob._complete = updateClobDataComplete(market)
			//market is complete if lastUpdate_logfiles is greater than or equal to market.endTimestamp
			// market.chartData._complete = lastUpdate_logfiles > market.endTimestamp
			market.chartData._complete = true
			market.chartData.version = chartDataVersion
			updated = true
		}
	}
	
	if (updated) {
		await PolymarketApi.cacheMarket(market)
		await PolymarketApi.saveMarket(market, true)
	}

	return {market, updated}
}


// ---------------------------------------------------------------------------- updatePriceData
const updatePriceData = async (market: Market) => {
	let updated: boolean = false

// console.log('updatePriceData:', market.slug, market.openPrice, market.closePrice)

	if (market.openPrice === null || market.closePrice === null) {
		// Prefer Gamma eventMetadata / outcomePrices; crypto-price+TWAP only as fallback
		await PolymarketApi.refreshGammaSettlement(market)

		if (market.openPrice === null || market.closePrice === null) {
			const priceData = await PolymarketApi.getCryptoPrice(market)
			if (!priceData) return false
			console.log('update priceData:', market.slug, priceData)

			if (priceData?.failed) {
				market.openPrice = 0
				market.closePrice = 0
				updated = true
				return updated
			}

			PolymarketApi.applyCryptoPriceResponse(market, priceData)
			updated = true
			await new Promise(resolve => setTimeout(resolve, 200))
		} else {
			console.log('update priceData (gamma):', market.slug, {
				openPrice: market.openPrice,
				closePrice: market.closePrice,
				outcome: market.outcome
			})
			updated = true
		}
	}

	if (market.openPrice && market.closePrice) {
		if (!market.closed || market.state !== 'closed') {
			console.log('update market closed:', market.slug)
			market.closed = true
			market.state = 'closed'
			updated = true
		}
		const settlement = PolymarketApi.getGammaSettlement(market.marketData)
		const outcome =
			settlement.outcome ||
			(market.closePrice >= market.openPrice ? 'up' : 'down')
		if (outcome !== market.outcome) {
			console.log('update outcome:', outcome)
			market.outcome = outcome
			updated = true
		}
	} else if (market.closed) {
		market.closed = false
		market.state = 'running'
		updated = true
	}

	return updated
}


// ---------------------------------------------------------------------------- getClobTickerData
export const getClobTickerData = async (market: Market, csvFilePath: string) => {
	// console.log('getChartData from', csvFilePath)
	const up: any = []
	const down: any = []
	const last: any = {up_ask: null, up_bid: null, down_ask: null, down_bid: null}

	const logData = fs.existsSync(csvFilePath) ? await fsPromises.readFile(csvFilePath, 'utf8') : null
	if (logData) {
		const lines = logData.split('\n')

		// timestamp,side,price,ticker_type,size,best_bid,best_ask
		lines.forEach((line) => {
			const [timestamp, side, priceStr, type, size, best_bid, best_ask] = line.split(',')
			const ts = parseInt(timestamp)
			const price = parseFloat(priceStr)
			const ask = parseFloat(best_ask) || price
			const bid = parseFloat(best_bid) || price
			if (ts <= market.endTimestamp && ask && bid && type) {
				if (type === 'UP') {
					if (ask !== last.up_ask || bid !== last.up_bid) {		//prevent duplicate entries
						last.up_ask = ask
						last.up_bid = bid
						up.push([ts, ask, bid] as any)
					}
				} else {
					if (bid !== last.down_bid || ask !== last.down_ask) {	//prevent duplicate entries
						last.down_bid = bid
						last.down_ask = ask
						down.push([ts, ask, bid] as any)
					}
				}
			}
		})
	}

	const dateString = PolymarketApi.getUTCDateFormat(new Date(market.startTimestamp))
	const timeLimit = market.duration / 5 * 60 * 1000
	const firstTimestamp = market.startTimestamp + timeLimit
	const lastTimestamp = market.endTimestamp - timeLimit
	const tickers: any = {} as any

	for (const source of Object.keys(tickerDataSources)) {
		if (source === 'clob') continue
		
		let tickerData: any = await getChartTickerData(market.symbol, dateString, source)
		if (!tickerData?.length) continue

		// Prevent duplicates from getting into the array based on timestamp and price
		tickerData = tickerData
			.filter((item: any) => item.timestamp >= market.startTimestamp - preOffset
				&& item.timestamp <= market.endTimestamp + postOffset)
			.reduce((acc: any[], item: any) => {		//prevent duplicates
				const last = acc.length > 0 ? acc[acc.length - 1] : null
				if (!last || last[0] !== item.timestamp || last[1] !== item.price) {
					acc.push([item.timestamp, item.price])
				}
				return acc
			}, [])

		tickerData._complete = tickerData.length > 20
			&& tickerData[0][0] < firstTimestamp
			&& tickerData[tickerData.length-1][0] > lastTimestamp

		tickers[source] = tickerData
	}

	return {
		version: chartDataVersion,
		clob: {up, down},
		ticker: tickers
	} as any
}


// ---------------------------------------------------------------------------- getClobGrid
const getClobGrid = (market: Market) => {
	const clob = market?.chartData?.clob
	if (!clob) return null

	const grid = {
		up_ask	: [] as any[],
		up_bid	: [] as any[],
		down_ask: [] as any[],
		down_bid: [] as any[],
	}

	// clob.up.forEach((item: any) => {
	// 	grid.up_ask.push(item[1])
	// 	grid.up_bid.push(item[2])
	// })
	// clob.down.forEach((item: any) => {
	// 	grid.down_ask.push(item[1])
	// 	grid.down_bid.push(item[2])
	// })

	market.chartData.grid = grid
}


// ---------------------------------------------------------------------------- getClobData
const getClobData = (market: Market) => {
	const clob = market?.chartData?.clob
	if (!clob) return null

	// const up = clob.up
	// const down = clob.down
	// return {up, down}
}


// ---------------------------------------------------------------------------- updateClobDataComplete
const updateClobDataComplete = (market: Market): number => {
	if (!market.marketData?.closed) return 0

	const clob = market?.chartData?.clob
	if (!clob) return -1

	const up = clob.up
	const down = clob.down
	const limit = parseNumber((market.duration / 5) * 60 * 1000)	//20% limit (e.g. limit for 5m-market = 1 Minute)

	if (!up || !down || up.length < 20 || down.length < 20) return -2
	// if (market.outcome === 'up' && (up[up.length-1][1] <= 0.95 || down[down.length-1][1] >= 0.05)) return -3
	// if (market.outcome === 'down' && (up[up.length-1][1] >= 0.05 || down[down.length-1][1] <= 0.95)) return -4
	if (up[0][0] - market.startTimestamp > limit) return -5
	if (market.endTimestamp - up[up.length-1][0] > limit
		&& (up[up.length-1][1] > 0.02 && up[up.length-1][1] < 0.98)) return -6
	if (down[0][0] - market.startTimestamp > limit) return -7
	if (market.endTimestamp - down[down.length-1][0] > limit
		&& (down[down.length-1][1] > 0.02 && down[down.length-1][1] < 0.98)) return -8

	//check if there is a gap, greater than limit in the data
	let test = up.find((e: any, i:number) => i > 0
	&& up[i-1][0] >= market.startTimestamp && e[0] <= market.endTimestamp
	&& (e[1] > 0.03 && e[1] < 0.97)
	&& e[0] - up[i-1][0] > limit)
	if (test){
		// console.log('gap found:', market.slug, test[0], test[1], limit, up[0], up[1])
		return -9
	}
	test = down.find((e: any, i:number) => i > 0
		&& down[i-1][0] >= market.startTimestamp && e[0] <= market.endTimestamp
		&& (e[1] > 0.03 && e[1] < 0.97)
		&& e[0] - down[i-1][0] > limit)
	if (test){
		// console.log('gap found:', market.slug, test[0], test[1], limit, down[0], down[1])
		return -10
	}
	return 1
}


// ---------------------------------------------------------------------------- updateMarketData
export const updateTestData = async (market: any): Promise<any> => {
	console.log('updateTestData:', market)
	if (!market) return

	const heatmap = await PolymarketApi.store.getItem('heatmap') || {}
	const map = heatmap[market.symbol + '-updown-15m']
	if (!map?.map) return
	const data = map.map
	console.log('data:', data)

	const tickerData = market.chartData?.ticker?.coinbase
	if (!tickerData?._complete) return

	const chartData: any[] = []
	let last: number | null = null

	const basePrice = tickerData[0][1]
	for (const item of tickerData) {
		const t = Math.floor((item[0] - market.startTimestamp) / 60000)	//minute value (0-14)
		if (t < 0 || t > 14) continue

		const value = Math.floor(((item[1] / basePrice) - 1) * 1000 * 2) + 20	//+- 1%
		const index = Math.max(Math.min(value, 39), 0)	//min:0, max:39, med:20
		const cell = data[t][index]
		if (cell){
			const up = cell.up
			if (up !== last){
				last = up
				chartData.push([item[0], up] as any)
			}
		}
	}

	market.chartData._grid = chartData

	///
}


// ---------------------------------------------------------------------------- getMarketDataFromDate
// Path should be like: A:/DATA/polymarket/markets/btc/2025-12-12
export const getMarketDataFromDate = (symbol: string, date: Date) => {
	const dateString = PolymarketApi.getUTCDateFormat(date)
	const rootPath = PolymarketApi.rootPath
	const symbolLower = symbol
	const dirPath = `${rootPath}/markets/${symbolLower}/${dateString}`

	let fileList: string[] = []

	// Only works if running in Electron or Node.js (fs available)
	if (typeof fs !== 'undefined' && fs?.readdirSync) {
		try {
			const files = fs.readdirSync(dirPath)
			// Only include .json files
			fileList = files.filter((f: string) => f.endsWith('.json')).map((f: string) => `${dirPath}/${f}`)
		} catch (e) {
			console.error(`Could not read directory: ${dirPath}`, e)
		}
	} else {
		console.warn('fs not available - cannot list files')
	}

	return fileList
}


// ---------------------------------------------------------------------------- getMarketChartData
// 1765497629036;Down;BUY;0.47;10
// 1765497629459;Down;SELL;0.46;6
// 1765497629467;Up;BUY;0.55;19.581817
// 1765497629473;Down;SELL;0.45;20
export const getMarketChartData = async (filePath: string | null = null,
	 // _symbol: string | null = null, _date: string | null = null
	) => {
	filePath = filePath || 'A:/DATA/polymarket/markets/btc/2025-12-13/btc-updown-15m-1765584900.log'
		
	const fileContent = await fsPromises.readFile(filePath, 'utf8')
	const lines = fileContent.split('\n')
	const data = lines.map((line) => {
		const [timestamp, direction, type, price, volume] = line.split(';')
		return { timestamp: parseInt(timestamp), direction, type, price: parseFloat(price), volume: parseFloat(volume) }
	}).filter((item) => item.timestamp > 0 && item.price > 0)

	return data
}



// ---------------------------------------------------------------------------- getChartTickerData
// get ticker data from 1 day cache or from file
// const filePath = 'A:/DATA/polymarket/tickers/xrp/xrp-2025-12-11.log'
// source: chainlink, binance, polling
// symbol: btc, xrp, etc.
// dateString: 2025-12-11
// return: { timestamp: number, price: number }[]
// example: getChartTickerData('btc', '2025-12-11', 'chainlink')
//
export const getChartTickerData = async (symbol: string, dateString: string, source: string = 'chainlink'): Promise<any[]> => {
	const dataString = symbol + '-' + dateString
	if (tickerDataCache[source + '-' + dataString]) return tickerDataCache[source + '-' + dataString]

	if (!tickerDataSources[source]) return []

	const dirPath = tickerDataSources[source].exportPath + tickerDataSources[source].symbols[symbol]
	const filePath = `${dirPath}/${dateString}.csv`

	if (!fs.existsSync(filePath)) return []

	const fileContent = await fsPromises.readFile(filePath, 'utf8')
	const lines = fileContent.split('\n')

	const data: any = lines.map((line) => {
		const [timestamp, price] = line.split(',')
		return { timestamp: parseInt(timestamp), price: parseFloat(price) }
	}).filter((item) => item.timestamp > 0 && item.price > 0)

	tickerDataCache[source + '-' + dataString] = data

	return data
}


// ---------------------------------------------------------------------------- scatterData
export const scatterData = async () => {
	
}


// ---------------------------------------------------------------------------- scatterData
export const scatterData_old = async () => {
	const data_ = await PolymarketApi.store.getItem('chartData') || await initData()
	// const data_ = await initData()

	const results = {
		all: {up: {win:[], lose: [], total: 0}, down: {win:[], lose: [], total: 0}} as any,
	} as any
	const count = {count:0, trades: 0, up: 0, down: 0, value: 0}

	for (const symbol of Object.keys(data_)) {
		results[symbol] = {up: {win:[], lose: [], total: 0}, down: {win:[], lose: [], total: 0}} as any
		for (const item of data_[symbol]) {
			if (!item.marketName.endsWith('-updown-15m')) continue
			
			item.hits = {up: {}, down: {}} as any
			count.count++

			item.grid.up.forEach((el: any) => {
				el[0] = parseNumber(el[0] / 60000)
				el[3] = parseNumber(((el[2] / item.openPrice) - 1) * 100)
				if (!item.hits.up[el[1]]) item.hits.up[el[1]] = el
			})
			item.grid.down.forEach((el: any) => {
				el[0] = parseNumber(el[0] / 60000)
				el[3] = parseNumber(((el[2] / item.openPrice) - 1) * 100)
				if (!item.hits.down[el[1]]) item.hits.down[el[1]] = el
			})

			const outcome = item.outcome as 'up' | 'down'

			Object.entries(item.hits.up).forEach(([price_, el]: [string, any]) => {
				if (el[0] > 0 && el[0] < 15){
					const price = parseFloat(price_)
					const node = {
						price: price,
						time: el[0],
						minute: Math.floor(el[0]),
						outcome: outcome,
						value: el[3],
						count: 1} as any	

					if (outcome === 'up') {
						results[symbol].up.win.push(node)
						results.all.up.win.push(node)
						results[symbol].up.total++
						results.all.up.total++
					}else{
						results[symbol].up.lose.push(node)
						results.all.up.lose.push(node)
						results[symbol].up.total++
						results.all.up.total++
					}
				}
			})
			Object.entries(item.hits.down).forEach(([price_, el]: [string, any]) => {
				if (el[0] > 0 && el[0] < 15){
					const price = parseFloat(price_)
					const node = {
						price: price,
						time: el[0],
						minute: Math.floor(el[0]),
						outcome: outcome,
						value: el[3],
						count: 1} as any	

					if (outcome === 'down') {
						results[symbol].down.win.push(node)
						results.all.down.win.push(node)
						results[symbol].down.total++
						results.all.down.total++
					}else{
						results[symbol].down.lose.push(node)
						results.all.down.lose.push(node)
						results[symbol].down.total++
						results.all.down.total++
					}
				}
			})
		}
	}

	// count.value = ((count.up / (0.6 * count.trades)) - 1) * 100

	console.log('complete! data:', data_, 'results:', results, 'count:', count)
	return results
}


// ---------------------------------------------------------------------------- 
// {
//     "file": "btc-updown-15m-1765406700.json",
//     "filePath": "A:/DATA/polymarket/markets//btc/2025-12-10/btc-updown-15m-1765406700.json",
//     "slug": "btc-updown-15m-1765406700",
//     "timestamp": 1765406700,
//     "date": "2025-12-10",
//     "symbol": "btc"
// }
export const heatmapData = async () => {
	const data_ = await PolymarketApi.store.getItem('chartData') || await initData()
	// const data_ = await initData()

	const test = {
		up: {result: 0, total: 0, up: 0, down: 0},
		down: {result: 0, total: 0, up: 0, down: 0},
		// all: {win: 0, lose: 0, total: 0, up: 0, down: 0}
	} as any
	let total = 0

	const results = {
		all: createMapData(),
	} as any
	// const count = {count:0, trades: 0, up: 0, down: 0, value: 0}

	for (const symbol of Object.keys(data_)) {
		results[symbol] = createMapData()

		for (const item of data_[symbol]) {
			if (!item.marketName.endsWith('-updown-15m')) continue
			
			item.hits = {up: {}, down: {}}
			item.grid.up.forEach((el: any) => {
				el[0] = parseNumber(el[0] / 60000)
				el[3] = parseNumber(((el[2] / item.openPrice) - 1) * 100)
				if (!item.hits.up[el[1]]) item.hits.up[el[1]] = el
			})
			item.grid.down.forEach((el: any) => {
				el[0] = parseNumber(el[0] / 60000)
				el[3] = parseNumber(((el[2] / item.openPrice) - 1) * 100)
				if (!item.hits.down[el[1]]) item.hits.down[el[1]] = el
			})

			const outcome = item.outcome as 'up' | 'down'

let el = item.hits.up['0.4']		
if (el && el[0] > 0 && el[0] < 3){
	test.up.total++
	test.up[outcome]++
	if (outcome === 'up') test.up.result += (1 / el[1])
	else test.up.result -= 1
}
			
			Object.entries(item.hits.up).forEach(([price_, el]: [string, any]) => {
// if (el[0] > 12 && el[0] < 15 && el[1] >= 0.6){
// 	test.up.total++
// 	if (outcome === 'up') test.up.win += ((1 / el[1]) - 1)
// 	else test.up.lose += 1
// }
				if (el[0] > 0 && el[0] < 15){
					const price = parseFloat(price_)
					const row = price * 10 - 1 //0 - 8
					const col = Math.floor(el[0] / 1) //0 - 4
					const index = col * 9 + row
					let item = results[symbol].up[index]

					item.price = price
					item[outcome]++
					item.count++

					item = results.all.up[index]
					item.price = price
					item[outcome]++
					item.count++
				}
			})

el = item.hits.down['0.4']		
if (el && el[0] > 0 && el[0] < 3){
	test.down.total++
	test.down[outcome]++
	if (outcome === 'down') test.down.result += (1 / el[1])
	else test.down.result -= 1
}
			
			Object.entries(item.hits.down).forEach(([price_, el]: [string, any]) => {
// if (el[0] > 12 && el[0] < 15 && el[1] >= 0.6){
// 	test.down.total++
// 	if (outcome === 'down') test.down.win += ((1 / el[1]) - 1)
// 	else test.down.lose += 1
// }
				if (el[0] > 0 && el[0] < 15){
					const price = parseFloat(price_)
					const row = price * 10 - 1 //0 - 8
					const col = Math.floor(el[0] / 1) //0 - 4
					const index = col * 9 + row
					let item = results[symbol].down[index]

					item.price = price
					item[outcome]++
					item.count++

					item = results.all.down[index]
					item.price = price
					item[outcome]++
					item.count++
				}
			})
		}

		results[symbol].up.forEach((item: any) => {
			item.value = (item.up / (item.count * item.price) - 1) * 100 * item.count / data_[symbol].length
			// item.value = ((item.up / item.down) - 1) * 100
		})
		results[symbol].down.forEach((item: any) => {
			item.value = (item.down / (item.count * item.price) - 1) * 100 * item.count / data_[symbol].length
			// item.value = ((item.down / item.up) - 1) * 100
		})

		total += data_[symbol].length
	}

	results.all.up.forEach((item: any) => {
		if (item.count)	item.value = (item.up / (item.count * item.price) - 1) * 100 * item.count / total
		// if (item.count)	item.value = ((item.up / item.down) - 1) * 100
	})
	results.all.down.forEach((item: any) => {
		if (item.count)	item.value = (item.down / (item.count * item.price) - 1) * 100 * item.count / total
		// if (item.count)	item.value = ((item.down / item.up) - 1) * 100
	})

	// count.value = ((count.up / (0.6 * count.trades)) - 1) * 100

	console.log('complete! data:', total, data_, 'results:', results)
console.log('test:', test)

	return results
}


// ---------------------------------------------------------------------------- createMapData
const createMapData = () => {
	const map = {up: [], down: []} as any
	for (let col = 0; col < 15; col++) {
		for (let row = 0; row < 9; row++) {
			map.up.push({col, row, value: 0, up: 0, down: 0, price: 1, count: 0} as any)
			map.down.push({col, row, value: 0, up: 0, down: 0, price: 1, count: 0} as any)
		}
	}
	return map
}


// ---------------------------------------------------------------------------- initData
const initData = async () => {
	const data = {}
	const keys = await PolymarketApi.cache.keys()	//e.g. [btc-updown-15m-1765406700, ...]
	console.log('---create chartData with grid:', keys.length, '...')

	let count = 0
	for (const key of keys) {
		const market = await PolymarketApi.cache.getItem(key)

		if (market?.closed && market.chartData?.grid) {
			count++
			const symbol = market.symbol
			data[symbol] = data[symbol] || []
			data[symbol].push({
				symbol: symbol,
				marketName: market.marketName,
				slug: market.slug,
				grid: market.chartData?.grid,
				openPrice: market.openPrice,
				closePrice: market.closePrice,
				outcome: market.outcome,
			})
		}
	}
	await PolymarketApi.store.setItem('chartData', data)
	console.log('---create chartData with grid:', count, 'complete!')
	return data
}


// ---------------------------------------------------------------------------- getChartDistributionData
// from dateString or all ticker data
/*
export const getChartDistributionData = async (symbol: string, dateString: string | null = null) => {
	// const source: string = 'binance'
	// const source: string = 'coinbase'
	const source: string = 'chainlink-twap'		//'chainlink'
	
	// e.g. A:/DATA/polymarket/coinbase/btc-usd
	if (!tickerDataSources[source]?.symbols[symbol]) return null

	const path: string = tickerDataSources[source].exportPath + tickerDataSources[source].symbols[symbol]
	console.log('getChartDistributionData:', symbol, dateString, source, '...')

// const cachedData = null
const cachedData = await PolymarketApi.store.getItem('distData-' + source + '-' + symbol)
	
	if (cachedData){
		console.log('chartDistributionData:', cachedData)
		return cachedData
	}

	let data: any[] = []
	if (dateString) {	//single date
		console.log('getChartTickerData:', symbol, dateString, source, '...')
		data = await getChartTickerData(symbol, dateString, source)

	} else {		//all ticker dat
		// const dirList = await fsPromises.readdir(PolymarketApi.rootPath + 'tickers/' + symbol, { withFileTypes: true });
console.log('------------------ load ticker data from:', path, '...')	//e.g. A:/DATA/polymarket/coinbase/btc-usd
		let dirList = await fsPromises.readdir(path, { withFileTypes: true });
		dirList = dirList.filter((entry) => entry.isFile() && entry.name.endsWith('.csv'))

const fromDate = new Date('2026-08-08').getTime()
const toDate = new Date('2026-08-10').getTime()

		for (const entry of dirList) {
			// const dateString = entry.name.substring(symbol.length + 1, entry.name.length - 4)		//yyyy-mm-dd
			const dateString = entry.name.split('.')[0]		//yyyy-mm-dd

const date = new Date(dateString)
// if (date.getTime() < new Date('2026-01-29 16:00:00').getTime()) continue
if (date.getTime() < fromDate) continue
if (date.getTime() > toDate) break

			const data_ = await getChartTickerData(symbol, dateString, source)
			console.log(entry.path + '/' + entry.name, data_.length)
			// data.push(...data_ as any)
			data = data.concat(data_ as any) || []
		}
		data.sort((a, b) => a.timestamp - b.timestamp)

		// await PolymarketApi.store.setItem(symbol + '-chartTickerData-' + source, data)
		// check if there are duplicate timestamps
		// data.forEach((item, index) => {
		// 	if (index > 0 && item.timestamp === data[index-1].timestamp) {
		// 		console.log('duplicate:', index, item.timestamp, item.price, data[index-1].price)
		// 	}
		// })

		console.log('chartData:', data.length)
	}

	if (!data.length) return [] as any
	const {ranges, chart} = await parseRangeData(data)

	await PolymarketApi.store.setItem('distData-' + source + '-' + symbol, ranges)
	console.log('chartDistributionData:', ranges)
	return ranges
}
*/


export type dayRangeType = {
	from: number,
	length: number,
	mirror: boolean,
	smooth: number,
}

// ---------------------------------------------------------------------------- parseChartDistributionData
export const parseChartDistributionData = async (symbol: string, dayRange: dayRangeType): Promise<any> => {
	console.log('parseChartDistributionData:', symbol, dayRange, '...')

	const source: string = 'chainlink-twap'		//'chainlink'
	const dirPath = tickerDataSources[source].exportPath + tickerDataSources[source].symbols[symbol]
	let ranges: any = null

	for (let i = 0; i < dayRange.length; i++) {
		const dayString = moment().subtract(dayRange.length + dayRange.from - i - 1, 'day').format("YYYY-MM-DD")
		const jsonFile = `${dirPath}/${dayString}.json`;
		if (fs.existsSync(jsonFile)){
			const data = JSON.parse(await fsPromises.readFile(jsonFile, 'utf8'))
			if (!ranges) ranges = data.ranges
			else mergeRanges(ranges, data.ranges, 0.2)
		}
	}

	if (ranges){
		for (let r = 0; r < 15; r++) {
			smoothValues(ranges[r].bars, dayRange.smooth, dayRange.mirror, 'value')
		}
	}

	return ranges
}


// ---------------------------------------------------------------------------- mergeRanges
const mergeRanges = (ranges: any[], data: any[], power: number = 0.5) => {
	if (!ranges || !data) return

	const p0 = 1 - power
	for (let r = 0; r < 15; r++) {
		for (let b = 0; b < 100; b++) {
			ranges[r].bars[b].value = ranges[r].bars[b].value * p0 + data[r].bars[b].value * power
		}
	}
}



// ---------------------------------------------------------------------------- parseChartData
// update all missing chart data json files for a given symbol
export const parseChartData = async (symbol: string): Promise<any> => {
	if (!symbol) return

	const source: string = 'chainlink-twap'		//'chainlink'
	console.log('parseChartData:', symbol, '...')

	const dirPath = tickerDataSources[source].exportPath + tickerDataSources[source].symbols[symbol]
	const dirFiles = fs.readdirSync(dirPath);

	const csvFiles = dirFiles
		.filter(name => name.endsWith('.csv'))
		.sort(); // sortiert alphanumerisch (aufsteigend, z.B. nach Datum, falls im Dateinamen YYYY-MM-DD)

	let dayString: string = ''
	for (const fileName of csvFiles) {
		dayString = fileName.replace(/\.csv$/, '');
		const jsonFile: string = `${dirPath}/${dayString}.json`;
		if (!fs.existsSync(jsonFile)) break; // das älteste fehlende .json gefunden
	}

	// Schleife pro Tag vom ältesten dayString bis gestern (yesterday)
	let loopDate = moment(dayString, "YYYY-MM-DD");
	const yesterdayDate = moment().subtract(1, 'day').utc().startOf('day');

	while (loopDate.isSameOrBefore(yesterdayDate)) {
		const dayString = loopDate.format("YYYY-MM-DD")
		const jsonFile = `${dirPath}/${dayString}.json`;	//e.g. A:/DATA/polymarket/chainlink/btc-usd/2026-08-28.json
		const csvFile = `${dirPath}/${dayString}.csv`;
		if (fs.existsSync(csvFile) && !fs.existsSync(jsonFile)) {
			const tickerData: any[] = await getChartTickerData(symbol, dayString, source);
			const rangeData = await parseRangeData(tickerData as any, 1, false);
			if (rangeData){
				console.log('rangeData:', dayString, rangeData);
				await fsPromises.writeFile(jsonFile, JSON.stringify(rangeData, null, '\t'));
			}
		}
		loopDate.add(1, "day"); // nächsten Tag iterieren
	}

	console.log('parseChartData complete!')
	return null
}


// ---------------------------------------------------------------------------- parseRangeData
// parse data by range
const parseRangeData = async (tickerData: { timestamp: number, price: number }[], smooth: number = 7, mirror: boolean = true) => {

	const unit = 6000 //10 seconds
	const chart = await getChartFrameData(tickerData as any, unit) as { timestamp: number, price: number, count: number }[]
	// const normalizedData = normalizeData(minuteData)

	const ranges: any = {} as any
	const steps = 100
	const frame = 15
	const range = 0.01	//price range in percent (0.01 = +/-0.5%)

	for (let f = 0; f < frame; f++) {
		// only ranges with valid start and end data are considered
		const r = Array(steps).fill(0) as any
		let total = 0
		let off = 0
		const width = Math.round((f + 1) * 60000 / unit)
		// for (let v = 0; v < steps; v++) r[v] = 0

		for (let i = 0; i < chart.length - width; i++) {
			if (!chart[i].count || !chart[i + width].count) continue
			
			const firstPrice = chart[i].price		//first valid price of the range
			const lastPrice = chart[i + width].price	//last valid price of the range
			const priceRatio = ((lastPrice / firstPrice) - 1) * 100 / range //price change ratio in percent per range
			const value = Math.floor(priceRatio) + steps / 2				//round to the nearest integer (-20 - 19)

			total++
			if (value < 0) off++
			if (value < 0 || value >= steps) continue	//ignore values outside the range

			r[value]++
		}

		const max = Math.max(...r)
		ranges[f] = {
			bars: r.map((count: number, index: number) => (
				{index: index - steps / 2, count: count, value: count / max})
			),
			count: total,
		}

		// smoothValues(ranges[f].bars, smooth, mirror)

		let volume = off
		ranges[f].bars.forEach((item: any) => {
			item.ratio = (volume + item.count / 2) / total
			volume += item.count
		})
	}
	return {ranges, chart}
}


// ---------------------------------------------------------------------------- getChartMinuteData
// aggregate daily data by minute with average price.
// if normalized is true, the data is normalized to the same time frame (every time frame is set)
export const getChartFrameData = async (data: { timestamp: number, price: number, count: number }[], timeFrame: number = 6000, normalized: boolean = true):
	Promise<{ timestamp: number, price: number, count: number }[]> => {

	const currentFrame = Math.floor(data[0].timestamp / 86400000) * 86400000		//start of the utc day in milliseconds
	const endOfDay = currentFrame + 86400000 - 1	//last millisecond of the utc day
	let nextFrame = currentFrame + timeFrame		//start of the next frame in milliseconds
	let candle = {
		timestamp: currentFrame,
		price: 0,
		count: 0,
	}
	const chart = [candle]
	let next: number

	for (const item of data) {
		if (item.timestamp < currentFrame) continue
		if (item.timestamp > endOfDay) break

		if (item.timestamp < nextFrame) {
			candle.price += item.price
			candle.count ++
		} else {
			if (candle.count) candle.price /= candle.count
			next = Math.floor(item.timestamp / timeFrame) * timeFrame
			if (normalized) {
				while (next > nextFrame) {
					chart.push({
						timestamp: nextFrame,
						price: candle.price,	//last valid price
						count: 0,
					})
					nextFrame += timeFrame
				}
			}
			nextFrame = next
			candle = {
				timestamp: nextFrame,
				price: item.price,
				count: 1,
			}
			chart.push(candle)
			nextFrame += timeFrame
		}
	}
	candle.price /= candle.count

	return chart
}


// ---------------------------------------------------------------------------- smoothRatios
// Funktion zur Glättung (Begradigung) der ratio-Werte in ranges[t]
const smoothValues = (arr: any[], smooth: number = 5, mirror: boolean = true, valueField: string = 'value'): void => {
	const len = mirror? arr.length / 2 : arr.length
	for (let i = 0; i < len; i++) {
		let sum = 0
		let count = 0
		// Glättung über das Fenster (z.B. 3er-Mittelwert)
		for (let j = -smooth; j <= smooth; j++) {
			const idx = i + j
			if (idx >= 0 && idx < arr.length) {
				sum += arr[idx][valueField]
				count++

				if (mirror) {
					sum += arr[arr.length-1-idx][valueField]	//add the value of the mirrored index
					count++
				}
			}
		}
		arr[i][valueField + '_s'] = sum / count
		if (mirror) arr[arr.length-1-i][valueField + '_s'] = sum / count
	}
}


/*
// ---------------------------------------------------------------------------- normalizeData
// normalize data to the same time frame
// fill gaps with the last valid price and set valid to false
export const normalizeData = (data: { timestamp: number, price: number }[], timeFrame:number = 60) => {	//size: 60000 = 1 minute
	const newData: { timestamp: number, price: number, valid: boolean }[] = []
	const timeFrameSize = timeFrame * 1000
	let nextTimestamp = data[0].timestamp

	data.forEach((item) => {
		while (nextTimestamp < item.timestamp) {
			newData.push({ timestamp: nextTimestamp, price: item.price, valid: false })
			nextTimestamp += timeFrameSize
		}
		newData.push({ timestamp: item.timestamp, price: item.price, valid: true })
		nextTimestamp += timeFrameSize
	})

	return newData
}
*/