import type { Market } from '@/lib/polymarket/types';
import PolymarketApi from './PolymarketApi'

const isElectron = window?.navigator.userAgent.includes('Electron')
const fs = isElectron ? (window as any)?.require?.('fs') : null
const fsPromises = isElectron ? (window as any)?.require?.('fs/promises') : null
// const path = (window as any)?.require?.('path');

const tickerDataCache = {} // ticker data cache



// ---------------------------------------------------------------------------- dataTest
export const dataTest = async (symbol: string) => {
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


// ---------------------------------------------------------------------------- getGrid
const getGridData = (market: Market): any => {
	const tickerData = market.chartData.ticker
	const upData = market.chartData.up
	const downData = market.chartData.down
	if (!upData?.length || !downData?.length || !tickerData?.length) return null

	const startTime = market.startTimestamp
	const grid = {
		up: [] as any[],
		down: [] as any[],
	}
	let price: number
	let nextUp: number = parseNumber(Math.ceil(upData[0][1] * 10) / 10)
	let nextDown: number = parseNumber(nextUp - 0.1)
	let tickerIndex = 0

	for (const item of upData) {
		if (item[1] >= nextUp) {
			price = nextUp
			nextUp = parseNumber(nextUp + 0.1)
		}else if (item[1] <= nextDown) {
			price = nextDown
			nextDown = parseNumber(nextDown - 0.1)
		}else continue

		while (tickerData[tickerIndex][0] < item[0] && tickerIndex < tickerData.length-1) tickerIndex++

		grid.up.push([item[0] - startTime, parseNumber(price), tickerData[tickerIndex][1]] as any)
	}

	nextUp = parseNumber(Math.ceil(downData[0][1] * 10) / 10)
	nextDown = parseNumber(nextUp - 0.1)
	tickerIndex = 0

	for (const item of downData) {
		if (item[1] >= nextUp) {
			price = nextUp
			nextUp = parseNumber(nextUp + 0.1)
		}else if (item[1] <= nextDown) {
			price = nextDown
			nextDown = parseNumber(nextDown - 0.1)
		}else continue

		while (tickerData[tickerIndex][0] < item[0] && tickerIndex < tickerData.length-1) tickerIndex++

		grid.down.push([item[0] - startTime, parseNumber(price), tickerData[tickerIndex][1]] as any)
	}

	return grid
}


// ------------------------------------------------------------------------ parseNumber
// const parseNumber = (num: number, float: number | null = null) => {
// 	if (float) num = parseFloat(num.toFixed(float))
// 	return parseFloat(num.toPrecision(12))
// }
const parseNumber = (num: number) => {
	return parseFloat(num.toFixed(12))
}


// ---------------------------------------------------------------------------- getMarketsFiles
export const getMarketsFiles = async (symbol: string, date: Date) => {
	// const rootPath = PolymarketApi.rootPath + "markets";

	const files = await getAllMarkets(symbol, date)
	return files[symbol][date.toISOString().slice(0, 10)]
}


// ---------------------------------------------------------------------------- getAllMarketLogs
// get all existing market log files
//
export const getAllMarkets = async (symbol: string | null = null, date: Date | null = null) => {
	const rootPath = PolymarketApi.rootPath + "markets";

	async function walkDir(currentPath: string, symbol?: string, date?: string) {
		const result: any = {};
		let dirList: string[] = [];

		try {
			dirList = await fsPromises.readdir(currentPath, { withFileTypes: true });
		} catch (e) {
			return {};
		}

		for (const entry of dirList) {
			if (typeof entry === "string") {
				// Node < v10 fallback (should not happen)
				continue;
			}
			if ((entry as any).isDirectory()) {
				const dirName = (entry as any).name;
				// Symbol layer
				if (!symbol) {
					// Drill into the symbol
					result[dirName] = await walkDir(currentPath + '/' + dirName, dirName, undefined);
				} else if (!date) {
					// Date layer inside of Symbol
					result[dirName] = await walkDir(currentPath + '/' + dirName, symbol, dirName);
				}
			} else if ((entry as any).isFile() && (entry as any).name.endsWith('.json') && symbol && date) {
				// Only files of the relevant Symbol + Date
				if (!result[date]) result[date] = [];
				
				// result[date].push((entry as any).name);
				result[date].push(({
					file: (entry as any).name,
					filePath: currentPath + '/' + (entry as any).name,
					slug: (entry as any).name.replace('.json', ''),
					timestamp: parseInt((entry as any).name.replace('.json', '').split('-')[3]),
					date: date,
					symbol: symbol
				}));
			}
		}

		// Clean up empty keys
		if (Object.keys(result).length === 0 && symbol && date) return undefined;

		// On date level, we want an array rather than a subobject
		if (date && Array.isArray(result[date])) return result[date];

		// Remove keys with undefined values (empty)
		for (const k of Object.keys(result)) if (typeof result[k] === "undefined") delete result[k];

		return result;
	}

	let out: any = {};
	if (!symbol && !date) {
		// List all symbols and all files
		out = await walkDir(rootPath);
	} else if (symbol && !date) {
		// Only for the given symbol
		out[symbol] = await walkDir(rootPath + '/' + symbol);
	} else if (symbol && date) {
		// Only for given symbol & date
		const dateString = PolymarketApi.getUTCDateFormat(date)
		const files = await walkDir(rootPath + '/' + symbol + '/' + dateString, symbol, dateString);
		if (files && Array.isArray(files)) {
			out[symbol] = { [dateString as string]: files } as any;
		} else {
			out[symbol] = {} as any;
		}
	}
	return out;
}


// ---------------------------------------------------------------------------- updateAllMarketData
export const updateAllMarketData = async () => {
	console.log('Updating all market data...')

	const data = await getAllMarkets()
	console.log('data:', data)

	const stat = {
		totalFiles: 0,
		updatedFiles: 0,
	}
	for (const symbol of Object.keys(data)) {
		for (const date of Object.keys(data[symbol])) {
			stat.totalFiles += data[symbol][date].length
		}
	}

	console.log('checking data of', stat.totalFiles, 'markets ...')

	for (const symbol of Object.keys(data)) {
		for (const date of Object.keys(data[symbol])) {
			for (const node of data[symbol][date]) {
// if (updatedFiles >= 120) break
				if (await updateMarketData(node.filePath, node.slug)) stat.updatedFiles++
			}
		}
	}

	console.log('complete!', stat)
}


// ---------------------------------------------------------------------------- updateMarketData
export const updateMarketData = async (filePath: string, slug: string): Promise<boolean> => {
	let updated:boolean = false
	let market: Market | null = null

	// get market from cache ...
	market = await PolymarketApi.cache.getItem(slug)
	if (!market) {		//market not cached! load and update market from file
		if (fs.existsSync(filePath)) {
			const jsonFileContent = await fsPromises.readFile(filePath, 'utf8')
			market = JSON.parse(jsonFileContent) as Market
	
		}else{
			console.log('market file not found:', filePath)
			market = await PolymarketApi.createMarketFromSlug(slug)
		}
		updated = true
	}

	if (!market){
		console.log('market not exists!', slug)
		return false
	}

	if (market.state === 'failed') return false

	if (!fs.existsSync(filePath)) updated = true	//market file not saved

	if (!market.dayString) {
		market.dayString = PolymarketApi.getUTCDateFormat(new Date(market.startTimestamp))
		console.log('update dayString:', market.startTimestamp, market.dayString)
		updated = true
	}

	if (market.marketName === 'updown-15m') {		//old version
		market.marketName = market.symbol + '-updown-15m'
		updated = true
	}

	if (market.symbol === 'BTC' || market.symbol === 'ETH' || market.symbol === 'SOL' || market.symbol === 'XRP') {
		market.symbol = market.symbol
		updated = true
	}

	if (!market.marketData){
		market.marketData = await PolymarketApi.fetchMarketBySlug(slug)
		updated = true

	}else if (!market.marketData.closed && Date.parse(market.marketData.endDate || '') < Date.now()){
		market.marketData = await PolymarketApi.fetchMarketBySlug(slug)
		if (!market.marketData?.closed) return false
	}

	if (!market.marketData
		|| (!market.marketData.closed && Date.parse(market.marketData.endDate || '') < Date.now())) {

		const marketData = await PolymarketApi.fetchMarketBySlug(slug)
		if (marketData){
			if (!market.marketData){
				market.marketData = marketData
				updated = true
			}else if (!marketData.closed) return false

		}else{
			console.log('marketData not found:', slug, market)
			market.state = 'failed'
			updated = true
		}
	}

	if (market.marketData?.closed && (!market.openPrice || !market.closePrice)) {
		const priceData = await PolymarketApi.getCryptoPrice(market)
		console.log('update priceData:', priceData)
		if (priceData?.openPrice) {
			market.openPrice = priceData.openPrice
			market.openPriceTimestamp = priceData.timestamp || null
		}
		if (priceData?.closePrice) {
			// market is now closed!
			market.closePrice = priceData.closePrice
			market.closePriceTimestamp = priceData.timestamp || null
		}
		updated = true
	}

	const logFilePath = filePath.replace('.json', '.log')

	if (market.openPrice && market.closePrice) {
		if (!market.closed || market.state !== 'closed'){
			console.log('update market closed:', market.slug)
			market.closed = true
			market.state = 'closed'
			delete market.chartData		//force update chart data
			updated = true
		}
		const outcome = market.closePrice && market.openPrice ? (market.closePrice > market.openPrice ? 'up' : 'down') : null
		if (outcome !== market.outcome) {
			console.log('update outcome:', outcome)
			market.outcome = outcome
			updated = true
		}
	}

	if (market.closed){
		if (!market.chartData || !market.chartData.ticker_p) {
			market.chartData = await getChartData(market, logFilePath)
			updated = true
		}
	
		if (market.chartData && market.chartData.grid === undefined && market.outcome) {
			market.chartData.grid = getGridData(market) as any
			console.log('get-grid-data:', market.slug, market.chartData.grid)
			updated = true
		}
	}
	
	if (updated) {
		await PolymarketApi.cacheMarket(market)
		await PolymarketApi.saveMarket(market, true)
	}

	return updated
}


// ---------------------------------------------------------------------------- getChartData
// data sample: {
//     "timestamp": 1765406957241,
//     "direction": "Up",
//     "type": "SELL",
//     "price": 0.36,
//     "volume": 15
// }
export const getChartData = async (market: Market, logFilePath: string) => {
	console.log('getChartData from', logFilePath)
	if (!fs.existsSync(logFilePath)) {
		console.log('logFile not exists:', logFilePath)
		return {up: [], down: [], ticker: [], ticker_p: []}
	}
	const logData = await fsPromises.readFile(logFilePath, 'utf8')
	if (!logData) return {up: [], down: [], ticker: [], ticker_p: []}

	const lines = logData.split('\n')

	const data = lines.map((line) => {
		const [timestamp, direction, type, price, volume] = line.split(';')
		return { timestamp: parseInt(timestamp), direction, type, price: parseFloat(price), volume: parseFloat(volume) }
	}).filter((item) => item.timestamp > 0 && item.price > 0)

	const up: any = []
	const down: any = []
	const last: any = {up: null, down: null, ticker: null}

	data.forEach((item) => {
		if (item.direction === 'Up') {
			if (last.up !== item.price) {
				last.up = item.price
				up.push([item.timestamp, item.price] as any)
			}
		} else {
			if (last.down !== item.price) {
				last.down = item.price
				down.push([item.timestamp, item.price] as any)
			}
		}
	})

	const dateString = PolymarketApi.getUTCDateFormat(new Date(market.startTimestamp))
	const tickerData = await getChartTickerData(market.symbol, dateString)
	const ticker = tickerData
		.filter(item => item.timestamp >= market.startTimestamp && item.timestamp <= market.endTimestamp)
		.map((item) => [item.timestamp, item.price] as any)

	const tickerData_p = await getChartTickerData(market.symbol, dateString, 'polling')
	const ticker_p = tickerData_p
		.filter(item => item.timestamp >= market.startTimestamp && item.timestamp <= market.endTimestamp)
		.map((item) => [item.timestamp, item.price] as any)
	
	return {up, down, ticker, ticker_p} as any
}


// ---------------------------------------------------------------------------- DateFormat
// Format date to yyyy-mm-dd
// const DateFormat = (date: Date) => {
// 	const pad = (n: number) => n.toString().padStart(2, '0')
// 	const year = date.getFullYear()
// 	const month = pad(date.getMonth() + 1)
// 	const day = pad(date.getDate())
// 	return `${year}-${month}-${day}`
// }


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
	 _symbol: string | null = null, _date: string | null = null) => {
	filePath = filePath || 'A:/DATA/polymarket/markets/btc/2025-12-13/btc-updown-15m-1765584900.log'
		
	const fileContent = await fsPromises.readFile(filePath, 'utf8')
	const lines = fileContent.split('\n')
	const data = lines.map((line) => {
		const [timestamp, direction, type, price, volume] = line.split(';')
		return { timestamp: parseInt(timestamp), direction, type, price: parseFloat(price), volume: parseFloat(volume) }
	}).filter((item) => item.timestamp > 0 && item.price > 0)

	return data
}


// ---------------------------------------------------------------------------- getChartData
// const filePath = 'A:/DATA/polymarket/tickers/xrp/xrp-2025-12-11.log'
export const getChartTickerData = async (symbol: string, dateString: string, source: string = 'tickers'): Promise<any[]> => {
	const dataString = symbol + '-' + dateString
	if (tickerDataCache[source + '-' + dataString]) return tickerDataCache[source + '-' + dataString]

	const rootPath = PolymarketApi.rootPath
	const dirPath = `${rootPath}${source}/${symbol}`
	const filePath = `${dirPath}/${dataString}.log`
	if (!fs.existsSync(filePath)) return []

	const fileContent = await fsPromises.readFile(filePath, 'utf8')
	const lines = fileContent.split('\n')
	console.log('getChartTickerData:', symbol, dateString, filePath, lines.length)

	const data = lines.map((line) => {
		const [timestamp, price] = line.split(';')
		return { timestamp: parseInt(timestamp), price: parseFloat(price) }
	}).filter((item) => item.timestamp > 0 && item.price > 0)

	tickerDataCache[source + '-' + dataString] = data

	return data
}


// ---------------------------------------------------------------------------- getChartMinuteData
// get chart data by minute. price is average of the minute.
export const getChartMinuteData = async (data: { timestamp: number, price: number }[]):
	Promise<{ timestamp: number, price: number }[]> => {
	let min = 60000
	let currentMinute = Math.floor(data[0].timestamp / min) * min
	let nextMinute = currentMinute + min
	let candle = {
		timestamp: currentMinute,
		price: 0,
		count: 0,
	}
	let chart = [candle]
	let lastTimestamp = data[0].timestamp

	data.forEach((item) => {
		const diff = item.timestamp - lastTimestamp
		if (diff > 30000) {		//there is a gap of 30 seconds
			console.log('gap:',
				chart.length - 1,
				new Date(lastTimestamp).toISOString().substring(11, 19),
				'to',
				new Date(item.timestamp).toISOString().substring(11, 19),
				(diff / min).toFixed(2), 'minutes')
		}
		lastTimestamp = item.timestamp

		if (item.timestamp < nextMinute) {
			candle.price += item.price
			candle.count ++
		} else {
			candle.price /= candle.count
			nextMinute = Math.floor(item.timestamp / min) * min
			candle = {
				timestamp: nextMinute,
				price: item.price,
				count: 1,
			}
			chart.push(candle)
			nextMinute += min
		}
	})
	candle.price /= candle.count

	return chart
}


export const scatterData = async () => {
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


/*
// ---------------------------------------------------------------------------- testData
const testData = async () => {
	const data_ = await PolymarketApi.store.getItem('chartData') || await initData()

	const test = {
		up: {win: 0, lose: 0, total: 0},
		down: {win: 0, lose: 0, total: 0},
		all: {win: 0, lose: 0, total: 0}
	} as any

	for (const symbol of Object.keys(data_)) {

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

let el = item.hits.up['0.8']		
if (el && el[0] > 12 && el[0] < 15){
	test.up.total++
	if (outcome === 'up') test.up.win += ((1 / el[1]) - 1)
	else test.up.lose += 1
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

el = item.hits.down['0.8']		
if (el && el[0] > 12 && el[0] < 15){
	test.down.total++
	if (outcome === 'down') test.down.win += ((1 / el[1]) - 1)
	else test.down.lose += 1
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
}
*/


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

	for (const key of keys) {
		const market = await PolymarketApi.cache.getItem(key)

		if (market?.closed && market.chartData?.grid) {
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
	return data
}


// ---------------------------------------------------------------------------- getChartDistributionData
export const getChartDistributionData = async (symbol: string, dateString: string | null = null, range: number = 15) => {
	let data: any[] = []
	if (dateString) {
		data = await getChartTickerData(symbol, dateString)

	} else {
		const dirList = await fsPromises.readdir(PolymarketApi.rootPath + 'tickers/' + symbol, { withFileTypes: true });
		console.log('dirList:', dirList)
	
		for (const entry of dirList) {
			if (entry.isDirectory()) continue
			const dateString = entry.name.substring(symbol.length + 1, entry.name.length - 4)		//yyyy-mm-dd
			const data_ = await getChartTickerData(symbol, dateString)
			data.push(...data_ as any)
		}
		data.sort((a, b) => a.timestamp - b.timestamp)
		console.log('chartData:', data.length)
	}

	const minuteData = await getChartMinuteData(data)
	const normalizedData = normalizeData(minuteData)

	const values: number[] = []
	const ranges: number[] = []

	// only ranges with valid start and end data are considered
	for (let i = 0; i < normalizedData.length - range; i++) {
		if (!normalizedData[i].valid || !normalizedData[i + range].valid) continue
		
		const firstPrice = normalizedData[i].price			//first valid price of the range
		const lastPrice = normalizedData[i + range].price	//last valid price of the range
		const priceRatio = ((lastPrice / firstPrice) - 1) * 1000			//price change ratio in promilles 
		values.push(priceRatio)					
		const value = Math.floor(priceRatio * 60 / range)	//price change 2000 = 200%
		if (!ranges[value]) ranges[value] = 0
		ranges[value]++
	}

	values.sort((a, b) => a - b)

	const len = values.length
	const pos = [values[0]]
	for (let i = 1; i < 10; i++) {
		pos.push(values[Math.round(i * len / 10)])
	}
	pos.push(values[len - 1])

	console.log('values:', values.length, pos)

	const distribution = Object.entries(ranges).map(([value, count]) => ({
		value: parseInt(value),
		count: count,
	})).sort((a, b) => a.value - b.value)

	return distribution
}


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
