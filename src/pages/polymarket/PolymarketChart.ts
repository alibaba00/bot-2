import type { Market } from '@/lib/polymarket/types';
import PolymarketApi from './PolymarketApi'

const isElectron = window?.navigator.userAgent.includes('Electron')
const fs = isElectron ? (window as any)?.require?.('fs') : null
const fsPromises = isElectron ? (window as any)?.require?.('fs/promises') : null
const path = (window as any)?.require?.('path');


// ---------------------------------------------------------------------------- getAllMarketLogs
export const getAllMarketLogs = async (symbol: string | null = null, date: Date | null = null) => {
	if (!isElectron || !fs || !fsPromises) {
		// Not running in an Electron context, or fs unavailable
		return {}
	}

	const rootPath = PolymarketApi.rootPath + "markets/";

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
					result[dirName] = await walkDir(path.join(currentPath, dirName), dirName, undefined);
				} else if (!date) {
					// Date layer inside of Symbol
					result[dirName] = await walkDir(path.join(currentPath, dirName), symbol, dirName);
				}
			} else if ((entry as any).isFile() && (entry as any).name.endsWith('.log') && symbol && date) {
				// Only files of the relevant Symbol + Date
				if (!result[date]) result[date] = [];
				result[date].push((entry as any).name);
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
		out[symbol] = await walkDir(path.join(rootPath, symbol));
	} else if (symbol && date) {
		// Only for given symbol & date
		const dateString = PolymarketApi.getUTCDateFormat(date)
		const files = await walkDir(path.join(rootPath, symbol, dateString), symbol, dateString);
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

	const data = await getAllMarketLogs()
	console.log('data:', data)

	let totalFiles = 0
	for (const symbol of Object.keys(data)) {
		for (const date of Object.keys(data[symbol])) {
			totalFiles += data[symbol][date].length
		}
	}

	let updatedFiles = 0

	for (const symbol of Object.keys(data)) {
		for (const date of Object.keys(data[symbol])) {
			for (const file of data[symbol][date]) {
if (updatedFiles >= 120) break
				updatedFiles++
				console.log('updatedFiles:', updatedFiles, '/', totalFiles, file)
				await updateMarketData(symbol, date, file)
			}
		}
	}

	console.log('complete!')
}


// ---------------------------------------------------------------------------- updateMarketData
export const updateMarketData = async (symbol: string, date: string, file: string) => {
	const jsonFilePath = `${PolymarketApi.rootPath}markets/${symbol}/${date}/${file.replace('.log', '.json')}`

	const slug = file.replace('.log', '')
	let updated = false
	let market: Market | null = null
	// console.log('jsonFilePath:', jsonFilePath)


	if (!fs.existsSync(jsonFilePath)) {
		console.log('jsonFile not found:', jsonFilePath)
		market = await PolymarketApi.createMarketFromSlug(slug)

	}else{
		const jsonFileContent = await fsPromises.readFile(jsonFilePath, 'utf8')
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
		|| (!market.marketData.closed && Date.parse(market.marketData.endDate || '') < Date.parse(date))) {
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

	if (!market.chartData?.ticker.length) {
		const logFilePath = `${PolymarketApi.rootPath}markets/${symbol}/${date}/${file}`
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
	console.log('getChartData:', market, logFilePath)
	const logData = await fsPromises.readFile(logFilePath, 'utf8')
	const lines = logData.split('\n')

	const data = lines.map((line) => {
		const [timestamp, direction, type, price, volume] = line.split(';')
		return { timestamp: parseInt(timestamp), direction, type, price: parseFloat(price), volume: parseFloat(volume) }
	}).filter((item) => item.timestamp > 0 && item.price > 0)

	const up: any = []
	const down: any = []
	const last: any = {up: null, down: null, ticker: null}
	const tickerData = await getChartTickerData(market.symbol, new Date(market.startTimestamp))
	const ticker = tickerData
		.filter(item => item.timestamp >= market.startTimestamp && item.timestamp <= market.endTimestamp)
		.map((item) => [item.timestamp, item.price] as any)
	
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
	const rootPath = PolymarketApi.rootPath
	const dirPath = `${rootPath}/tickers/${symbol}`
	const filePath = `${dirPath}/${symbol}-${dateString}.log`
	console.log('getChartTickerData:', symbol, dateString, filePath)

	const fileContent = await fsPromises.readFile(filePath, 'utf8')
	const lines = fileContent.split('\n')
	const data = lines.map((line) => {
		const [timestamp, price] = line.split(';')
		return { timestamp: parseInt(timestamp), price: parseFloat(price) }
	}).filter((item) => item.timestamp > 0 && item.price > 0)

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
