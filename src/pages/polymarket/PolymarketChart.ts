import type { Market } from '@/lib/polymarket/types';
import PolymarketApi from './PolymarketApi'

const isElectron = window?.navigator.userAgent.includes('Electron')
const fs = isElectron ? (window as any)?.require?.('fs') : null
const fsPromises = isElectron ? (window as any)?.require?.('fs/promises') : null
// const path = (window as any)?.require?.('path');

const tickerData = {} // ticker data cache


// ---------------------------------------------------------------------------- 
// {
//     "file": "btc-updown-15m-1765406700.json",
//     "filePath": "A:/DATA/polymarket/markets//btc/2025-12-10/btc-updown-15m-1765406700.json",
//     "slug": "btc-updown-15m-1765406700",
//     "timestamp": 1765406700,
//     "date": "2025-12-10",
//     "symbol": "btc"
// }
export const testData = async () => {
	console.log('testing data...')
	const data = await getAllMarkets()
	console.log('data:', data)

	const results: any = {hit:0, ups:0, dns:0}
	let count = 0
	const up = {}

	const keys = {}
	for (const key of await PolymarketApi.cache.keys()) keys[key] = key

	for (const symbol of Object.keys(data)) {
		for (const date of Object.keys(data[symbol])) {
			for (const node of data[symbol][date]) {
// if (count ++ >= 100) break
				let market = await PolymarketApi.cache.getItem(node.slug)
				if (!market) {
					const marketData = await fsPromises.readFile(node.filePath, 'utf8')
					market = JSON.parse(marketData) as Market
					await PolymarketApi.cacheMarket(market)
				}
				if (!market){
					console.log('market not loaded:', node.slug)
					continue
				}

				if (market.chartData && market.chartData.grid === undefined && market.closed && market.outcome) {
					market.chartData.grid = getGridData(market) as any
					console.log('market.chartData.grid:', market.chartData.grid)
					await PolymarketApi.cacheMarket(market)
				}
			}
		}
	}

	console.log('complete!')
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


// ---------------------------------------------------------------------------- getAllMarketLogs
export const getAllMarkets = async (symbol: string | null = null, date: Date | null = null) => {
	if (!isElectron || !fs || !fsPromises) {
		// Not running in an Electron context, or fs unavailable
		return {}
	}

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

	let totalFiles = 0
	for (const symbol of Object.keys(data)) {
		for (const date of Object.keys(data[symbol])) {
			totalFiles += data[symbol][date].length
		}
	}

	let updatedFiles = 0
	console.log('checking data of', totalFiles, 'markets ...')

	for (const symbol of Object.keys(data)) {
		for (const date of Object.keys(data[symbol])) {
			for (const file of data[symbol][date]) {
// if (updatedFiles >= 120) break
				updatedFiles++
				// console.log('updatedFiles:', updatedFiles, '/', totalFiles, file)
				await updateMarketData(date, file.filePath, file.slug)
			}
		}
	}

	console.log('complete!')
}


// ---------------------------------------------------------------------------- updateMarketData
export const updateMarketData = async (date: string, filePath: string, slug: string) => {
	let updated = false
	let market: Market | null = null
	// console.log('jsonFilePath:', jsonFilePath)

	if (!fs.existsSync(filePath)) {
		console.log('jsonFile not found:', filePath)
		market = await PolymarketApi.createMarketFromSlug(slug)

	}else{
		const jsonFileContent = await fsPromises.readFile(filePath, 'utf8')
		market = JSON.parse(jsonFileContent) as Market
	}
	if (!market) return
	// console.log('market:', market)

	if (!market.dayString) {
		market.dayString = PolymarketApi.getUTCDateFormat(new Date(market.startTimestamp))
		updated = true
		console.log('update dayString:', market.startTimestamp, market.dayString)
	}

	if (!market.marketData
		|| (!market.marketData.closed && Date.parse(market.marketData.endDate || '') < Date.now())) {
		console.log('update marketData:', slug)
		market.marketData = await PolymarketApi.fetchMarketBySlug(slug)
		updated = true
	}

	if (market.marketData?.closed && (!market.openPrice || !market.closePrice)) {
		const priceData = await PolymarketApi.getCryptoPrice(market)
		console.log('update priceData:', priceData)
		if (priceData?.openPrice) {
			market.openPrice = priceData.openPrice
			market.openPriceTimestamp = priceData.timestamp || null
		}
		if (priceData?.closePrice) {
			market.closePrice = priceData.closePrice
			market.closePriceTimestamp = priceData.timestamp || null
		}
		updated = true
	}

	if (market.openPrice && market.closePrice) {
		if (!market.closed){
			console.log('update market closed:', market.slug)
			market.closed = true
			updated = true
		}
		const outcome = market.closePrice && market.openPrice ? (market.closePrice > market.openPrice ? 'up' : 'down') : null
		if (outcome !== market.outcome) {
			console.log('update outcome:', outcome)
			market.outcome = outcome
			updated = true
		}
	}

	// if (!market.chartData || !market.chartData.ticker.length || !market.chartData.up.length || !market.chartData.down.length) {
	if (!market.chartData) {
		const logFilePath = filePath.replace('.json', '.log')
		market.chartData = await getChartData(market, logFilePath)
		updated = true
	}
	
	if (updated) {
		await PolymarketApi.cacheMarket(market)
		await PolymarketApi.saveMarket(market)
	}

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
		return {up: [], down: [], ticker: []}
	}
	const logData = await fsPromises.readFile(logFilePath, 'utf8')
	if (!logData) return {up: [], down: [], ticker: []}

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

	const tickerData = await getChartTickerData(market.symbol.toLowerCase(), new Date(market.startTimestamp))
	const ticker = tickerData
		.filter(item => item.timestamp >= market.startTimestamp && item.timestamp <= market.endTimestamp)
		.map((item) => [item.timestamp, item.price] as any)

	return {up, down, ticker} as any
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
	const symbolLower = symbol.toLowerCase()
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
	 _symbol: string | null = null, _date: Date | null = null) => {
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
export const getChartTickerData = async (symbol: string, date: Date) => {
	const dateString = PolymarketApi.getUTCDateFormat(date)
	if (tickerData[symbol]?.[dateString]) {
		// console.log('getChartTickerData from cache:', symbol, dateString)
		return tickerData[symbol][dateString]
	}

	const rootPath = PolymarketApi.rootPath
	const dirPath = `${rootPath}tickers/${symbol}`
	const filePath = `${dirPath}/${symbol}-${dateString}.log`
	console.log('getChartTickerData:', symbol, dateString, filePath)

	const fileContent = await fsPromises.readFile(filePath, 'utf8')
	const lines = fileContent.split('\n')
	const data = lines.map((line) => {
		const [timestamp, price] = line.split(';')
		return { timestamp: parseInt(timestamp), price: parseFloat(price) }
	}).filter((item) => item.timestamp > 0 && item.price > 0)

	tickerData[symbol] = tickerData[symbol] || {} as any
	tickerData[symbol][dateString] = data

	return data
}


// ---------------------------------------------------------------------------- getChartMinuteData
export const getChartMinuteData = async (symbol: string, date: Date): Promise<{ timestamp: number, price: number }[]> => {
	const data = await getChartTickerData(symbol, date)

	let currentMinute = Math.floor(data[0].timestamp / 60000) * 60000
	let nextMinute = currentMinute + 60000
	let candle = {
		timestamp: currentMinute,
		price: 0,
		count: 0,
	}
	let chart = [candle]
	data.forEach((item) => {
		if (item.timestamp < nextMinute) {
			candle.price += item.price
			candle.count += 1
		} else {
			candle.price /= candle.count
			candle = {
				timestamp: nextMinute,
				price: item.price,
				count: 1,
			}
			chart.push(candle)
			nextMinute += 60000
		}
	})
	candle.price /= candle.count

	return chart
}


// ---------------------------------------------------------------------------- getChartDistributionData
export const getChartDistributionData = async (symbol: string, date: Date) => {
	const data = await getChartMinuteData(symbol, date)

	const values = {}
	for (let i = 0; i < data.length - 15; i++) {
		const price = data[i].price
		const price15 = data[i + 15].price
		const value = Math.floor(((price15 / price) - 1) * 2000)	//price change
		if (!values[value]) {
			values[value] = 0
		}
		values[value]++
	}
	const distribution = Object.entries(values).map(([value, count]) => ({
		value: parseInt(value),
		count: count,
	})).sort((a, b) => a.value - b.value)

	return distribution
}
