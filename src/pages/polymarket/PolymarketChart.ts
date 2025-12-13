import PolymarketApi from './PolymarketApi'

const isElectron = window?.navigator.userAgent.includes('Electron')
const fs = isElectron ? (window as any)?.require?.('fs') : null
const fsPromises = isElectron ? (window as any)?.require?.('fs/promises') : null


// ---------------------------------------------------------------------------- DateFormat
// Format date to yyyy-mm-dd
const DateFormat = (date: Date) => {
	const pad = (n: number) => n.toString().padStart(2, '0')
	const year = date.getFullYear()
	const month = pad(date.getMonth() + 1)
	const day = pad(date.getDate())
	return `${year}-${month}-${day}`
}


// ---------------------------------------------------------------------------- getMarketDataFromDate
// Path should be like: A:/DATA/polymarket/markets/btc/2025-12-12
export const getMarketDataFromDate = (symbol: string, date: Date) => {
	const dateString = DateFormat(date)
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
export const getMarketChartData = async (_symbol: string, _date: Date) => {
	const filePath = 'A:/DATA/polymarket/trades/btc/2025-12-13/btc-updown-15m-1765584900.log'

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
	const dateString = DateFormat(date)
	const rootPath = PolymarketApi.rootPath
	const dirPath = `${rootPath}/tickers/${symbol}`
	const filePath = `${dirPath}/${symbol}-${dateString}.log`

	const fileContent = await fsPromises.readFile(filePath, 'utf8')
	const lines = fileContent.split('\n')
	const data = lines.map((line) => {
		const [timestamp, price] = line.split(';')
		return { timestamp: parseInt(timestamp), price: parseFloat(price) }
	}).filter((item) => item.timestamp > 0 && item.price > 0)

	return data
}


// ---------------------------------------------------------------------------- getChartMinuteData
export const getChartMinuteData = async (symbol: string, date: Date): Promise<{timestamp: number, price: number}[]> => {
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
		}else{
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
		const price15 = data[i+15].price
		const value = Math.floor(((price15 / price) - 1) * 2000)	//price change
		if (!values[value]) {
			values[value] = 0
		}
		values[value] ++
	}
	const distribution = Object.entries(values).map(([value, count]) => ({
		value: parseInt(value),
		count: count,
	})).sort((a, b) => a.value - b.value)

	return distribution
}
