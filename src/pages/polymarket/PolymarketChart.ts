import type { Market } from '@/lib/polymarket/types';
import PolymarketApi from './PolymarketApi'

const isElectron = window?.navigator.userAgent.includes('Electron')
const fs = isElectron ? (window as any)?.require?.('fs') : null
const fsPromises = isElectron ? (window as any)?.require?.('fs/promises') : null
// const path = isElectron ? (window as any)?.require?.('path') : null;

let tickerDataCache: any = {} // ticker data cache
let isRunning = false
let lastUpdate_logfiles: number = await PolymarketApi.store.getItem('lastUpdate_logfiles') || 0
console.log('lastUpdate_logfiles:', lastUpdate_logfiles, new Date(lastUpdate_logfiles).toISOString())


// ---------------------------------------------------------------------------- fixingClobData
export const fixingClobData = async () => {
	if (isRunning){
		console.log('fixingClobData canceled!')
		isRunning = false
		return
	}
	isRunning = true

	const importPath = 'A:/DATA/polymarket/clob/'
	const dirList = await fsPromises.readdir(importPath, { withFileTypes: true, recursive: true });
	console.log('fixingClobData dirList:', dirList.length, '...')

	let count = 0
	let updated = 0

	for (const entry of dirList) {
		if (!isRunning) break
		if (entry.isDirectory()) continue

		if (entry.name.endsWith('.csv')) {
			count++
			if (count % 100 === 0) console.log('fixingClobData:', count, '...')
// if (count > 3) break

			const filePath = entry.path.replaceAll('\\', '/') + '/' + entry.name
			// const symbol = entry.path.split('\\').pop()
			const fileContent = await fsPromises.readFile(filePath, 'utf8')
			if (fileContent?.length) {
console.log('update:', filePath)

				const lines = fileContent.split('\n')
				updated++
				lines.map((line) => {
					if (line.includes('UP')){
						return line.replace('UP', 'DOWN')
					}else if (line.includes('DOWN')){
						return line.replace('DOWN', 'UP')
					}else return line
				}).join('\n')

				// await fsPromises.writeFile(filePath, exportData)
			}	
		}
	}

	console.log('complete!', count, 'files updated:', updated)
	isRunning = false
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

/*
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
*/


// ------------------------------------------------------------------------ parseNumber
// const parseNumber = (num: number, float: number | null = null) => {
// 	if (float) num = parseFloat(num.toFixed(float))
// 	return parseFloat(num.toPrecision(12))
// }
const parseNumber = (num: number) => {
	return parseFloat(num.toFixed(12))
}


// ---------------------------------------------------------------------------- getAllMarkets_clob_2
let dirList: any[] = [];

export const getAllMarkets_clob = async (symbol: string | null = null, date: Date | null = null) => {
	// console.log('getAllMarkets_clob running', symbol, date)

	dirList = dirList.length? dirList : await fsPromises.readdir(PolymarketApi.clobPath, { withFileTypes: true, recursive: true });
	const dateString = (date || new Date()).toISOString().substring(0, 10);

	const fileList: any[] = dirList.filter((entry: any) => entry.isFile()
		&& entry.name.endsWith('.csv')
		// && (symbol ? entry.name.startsWith(symbol) : true)
		&& (symbol ? entry.path.includes('\\' + symbol + '-') : true)
		&& (date ? entry.path.endsWith(dateString) : true)
	).map((entry: any) => ({
		folder: entry.path.replaceAll('\\', '/'),
		fileName: entry.name,
		filePath: entry.path.replaceAll('\\', '/') + '/' + entry.name,
		slug: entry.name.replace('.csv', ''),
		timestamp: parseInt(entry.name.replace('.csv', '').split('-')[3]),
		date: date,
		dateString: dateString,
		symbol: symbol
	}));

	return fileList;
}


// ---------------------------------------------------------------------------- getAllMarketLogs
// get all existing market log files from A:\DATA\polymarket\markets
// return an array of objects with the following properties:
// - file: the name of the file
// - filePath: the full path of the file
// - slug: the slug of the market
// - timestamp: the timestamp of the market
// - date: the date of the market
// - symbol: the symbol of the market
//
export const getAllMarkets = async (symbol: string | null = null, date: Date | null = null) => {
	const rootPath = PolymarketApi.marketsPath;

	async function walkDir(currentPath: string, symbol?: string, date?: string) {
		const result: any = {};
		let dirList: string[] = [];

		try {
			dirList = await fsPromises.readdir(currentPath, { withFileTypes: true });
		} catch (error) {
			console.error('Error reading directory:', error)
			return {}
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


// ---------------------------------------------------------------------------- updateLogfiles
export const updateLogfiles = async () => {
	tickerDataCache = {} as any // clear ticker data cache
	lastUpdate_logfiles = Date.now() as number
	await PolymarketApi.store.setItem('lastUpdate_logfiles', lastUpdate_logfiles)
	console.log('---Updating logfiles...', lastUpdate_logfiles, new Date(lastUpdate_logfiles).toISOString())

	await updateClobData()
	console.log('')
	await updateTickerData('chainlink')
	console.log('')
	await updateTickerData('binance')
	console.log('')
	await updateTickerData('polling')
	console.log('')
	await updateTickerData('coinbase')
	console.log('')
	await updateTickerData('kraken')
	console.log('')

	console.log('update markets logfiles...')
	dirList = await fsPromises.readdir(PolymarketApi.clobPath, { withFileTypes: true, recursive: true });

	console.log('---Complete! new total files:', dirList.length)
}


// ---------------------------------------------------------------------------- updateOldLogs
export const updateOldLogs = async () => {
	console.log('---Updating old logs...')
	// await PolymarketApi.store.setItem('lastUpdate_oldLogs', Date.now())

	// const importPath = 'A:/DATA/polymarket/clob/'

	// const importPath = 'A:/DATA/polymarket/clob/'
	// const dirList = await fsPromises.readdir(importPath, { withFileTypes: true, recursive: true });
	// console.log('updateOldLogs dirList:', dirList.length, '...')

	// for (const entry of dirList) {
	// 	if (entry.isDirectory()) continue
	// }
}


const tickerDataSources: any = {
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

// ---------------------------------------------------------------------------- updateTickerData
export const updateTickerData = async (type: string = 'binance') => {
	console.log('Updating ticker data:', type)

	const importPath = tickerDataSources[type].importPath
	const exportPath = tickerDataSources[type].exportPath
	const importList = await fsPromises.readdir(importPath, { withFileTypes: true, recursive: true });

	for (const entry of importList) {
		if (entry.isDirectory() || !entry.name.endsWith('.csv')) continue
		const path = entry.path.replaceAll('\\', '/')
		const filePath = path + '/' + entry.name
		const symbol = path.split('/').pop()
		const exportDir = exportPath + symbol
		const exportFile = exportDir + '/' + entry.name

		if (fs.existsSync(exportFile)){	//export file exists
			const exportCreatedAt = fs.statSync(exportFile).ctime
			const importCreatedAt = fs.statSync(filePath).ctime
			if (exportCreatedAt >= importCreatedAt) continue

			console.log('update file:', exportFile)
		}else{
			console.log('export new file:', exportFile)
		}

		if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true })
		fs.copyFileSync(filePath, exportFile)
	}
}


// ---------------------------------------------------------------------------- updateTickerData
// H:\DEV\PY\polymarket\clob_market_ticker\logs\clob\btc-updown-15m\2026-01-05\btc-updown-15m-1767639600.csv
// A:\DATA\polymarket\clob\btc-updown-15m\2026-01-05\btc-updown-15m-1767639600.csv
export const updateClobData = async () => {
	console.log('Updating clob data...')

	// const importPath = 'H:/DEV/PY/polymarket/clob_market_ticker/logs/'	//old
	const importPath = 'H:/DEV/TRADE/POLY/bot-3/logs/clob'	//new
	const exportPath = 'A:/DATA/polymarket/'
	const importList = await fsPromises.readdir(importPath, { withFileTypes: true, recursive: true });

	const stat = {
		exists: 0,
		updatedFiles: 0,
		newFiles: 0,
	}

	for (const entry of importList) {
		if (entry.isDirectory() || !entry.name.endsWith('.csv')) continue
		const path = entry.path.replaceAll('\\', '/')
		const filePath = path + '/' + entry.name
		const exportDir = exportPath + path.split('logs/')[1]
		const exportFile = exportDir + '/' + entry.name

		if (fs.existsSync(exportFile)){		//export file exists
			stat.exists++
			const exportCreatedAt = fs.statSync(exportFile).ctime
			const importCreatedAt = fs.statSync(filePath).ctime
			if (exportCreatedAt >= importCreatedAt) continue

			stat.updatedFiles++
			console.log('')
			console.log('update file:', exportFile)

		}else{			//export file not exists
			stat.newFiles++
			console.log('export new file:', exportFile)
		}
		if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true })
		fs.copyFileSync(filePath, exportFile)
	}

	console.log('stat:', stat)
}


// ---------------------------------------------------------------------------- updateMarketData
export const getMarket = async (slug: string, filePath: string | null = null, useCache: boolean = true): Promise<Market | null> => {
	// get market from cache ...
	let market = useCache ? await PolymarketApi.cache.getItem(slug) as Market | null : null

	if (!market && filePath) {		//market not cached! load and update market from file
		if (fs.existsSync(filePath) && useCache) {
			const jsonFileContent = await fsPromises.readFile(filePath, 'utf8')
			market = JSON.parse(jsonFileContent) as Market
	
		}else{
			console.log('market file not found:', filePath)
			market = await PolymarketApi.createMarketFromSlug(slug, filePath)
		}
	}

	return market
}


// ---------------------------------------------------------------------------- updateAllMarketData_clob
export const updateAllMarketData_clob = async () => {
	if (isRunning){
		console.log('updateAllMarketData_clob canceled!')
		isRunning = false
		return
	}
	isRunning = true

	await PolymarketApi.store.setItem('lastUpdate_clobData', Date.now())

	const dataFiles = await getAllMarkets_clob()
	console.log('Updating all market data from clob (', dataFiles.length,
		'files, lastUpdate:', new Date(lastUpdate_logfiles).toISOString(), ') ...')

	const stat = {
		totalMarkets: dataFiles.length,
		closedMarkets: 0,
		updated: 0,
		newMarkets: 0,
		openMarkets: 0,
	}

	const marketKeys = await PolymarketApi.cache.keys()
	const marketLookup = marketKeys.reduce((acc: any, key: string) => {
		acc[key] = true
		return acc
	}, {})

	const openMarkets = await PolymarketApi.store.getItem('openMarkets') || []
	const openMarketsLookup = openMarkets.reduce((acc: any, slug: string) => {
		acc[slug] = true
		return acc
	}, {})
	console.log('openMarkets:', openMarkets.length)
	let count = 0
	let index = 0

	for (const file of dataFiles) {
		index++
		if (!isRunning) break

		if (marketLookup[file.slug]) {				//market is cached
			if (!openMarketsLookup[file.slug]){		//market is closed
				stat.closedMarkets++
				continue
			}
		}else{
			stat.newMarkets++
		}

		const {market, updated} = await updateMarketData_clob(file.slug, file.filePath)
		if (updated){
			console.log('-----> update market:', index, ++count, '/', openMarkets.length, file.slug, file.filePath)
			console.log('')
		}

		if (updated) stat.updated++
		if (market && !market.closed){
			stat.openMarkets++
			openMarketsLookup[file.slug] = true
		}else{
			delete openMarketsLookup[file.slug]
			stat.closedMarkets++
		}
	}

	await PolymarketApi.store.setItem('openMarkets', Object.keys(openMarketsLookup))

	console.log('complete!', stat)
	isRunning = false
}


// ---------------------------------------------------------------------------- updateMarketData
export const updateMarketData_clob = async (slug: string, csvPath: string, useCache: boolean = true)
	: Promise<{market: Market | null, updated: boolean}> => {
	let updated:boolean = false
	// let market: Market | null = null
	const filePath = csvPath.replace('.csv', '.json')

	const market = await getMarket(slug, filePath, useCache)  //-> createMarketFromSlug or load from file
	if (!market){
		console.log('market not exists!', slug)
		return {market: null, updated: false}
	}

	if (market.state === 'failed') return {market: null, updated: false}

	if (!fs.existsSync(filePath)) updated = true	//market file not saved

	if (!market.marketData || (!market.marketData.closed && Date.parse(market.marketData.endDate || '') < Date.now())) {
		market.marketData = await PolymarketApi.fetchMarketBySlug(slug, true)
		if (!market.marketData) market.state = 'failed'
		updated = true
	}

	if (market.symbol === 'bitcoin'){		//fixing wrong symbol
		market.symbol = 'btc'
		updated = true
	}

	if (!market.duration){
		if (market.marketData?.endDate){
			market.marketType = PolymarketApi.getMarketTypeFromPath(filePath) || ''
			delete market["marketName"]		//remove marketName from market object to prevent confusion
			market.duration = PolymarketApi.getMarketDurationFromType(market.marketType) || 0
			market.endTimestamp = new Date(market.marketData.endDate).getTime()
			market.startTimestamp = market.endTimestamp - market.duration * 60 * 1000
			updated = true
		}
	}

	if (market.marketData?.closed){
		if (!market.openPrice || !market.closePrice) {
			const priceData = await PolymarketApi.getCryptoPrice(market)
			console.log('update priceData:', market.slug, priceData)
			if (priceData?.openPrice) {
				market.openPrice = priceData.openPrice
				market.openPriceTimestamp = priceData.timestamp || null
				updated = true
			}
			if (priceData?.closePrice) {	// market is now closed!
				market.closePrice = priceData.closePrice
				market.closePriceTimestamp = priceData.timestamp || null
				updated = true
			}
			await new Promise(resolve => setTimeout(resolve, 1000))
		}
	
		if (market.openPrice && market.closePrice) {
			if (!market.closed || market.state !== 'closed'){
				console.log('update market closed:', market.slug)
				market.closed = true
				market.state = 'closed'
				updated = true
			}
			const outcome = market.closePrice && market.openPrice ? (market.closePrice > market.openPrice ? 'up' : 'down') : null
			if (outcome !== market.outcome) {
				console.log('update outcome:', outcome)
				market.outcome = outcome
				updated = true
			}
		}else if (market.closed){		//fixing wrong market state
			market.closed = false
			market.state = 'running'
			updated = true
		}

		if (!useCache || !market.chartData?._complete) {
			market.chartData = await getChartData(market, csvPath)
			//market is complete if lastUpdate_logfiles is greater than or equal to market.endTimestamp
			market.chartData._complete = lastUpdate_logfiles > market.endTimestamp
			updated = true
		}
	}
	
	if (updated) {
		await PolymarketApi.cacheMarket(market)
		await PolymarketApi.saveMarket(market, true)
	}

	return {market, updated}
}


// ---------------------------------------------------------------------------- getChartData
export const getChartData = async (market: Market, csvFilePath: string) => {
	console.log('getChartData from', csvFilePath)

	const up: any = []
	const down: any = []
	const last: any = {up: null, down: null, ticker: null}

	const logData = fs.existsSync(csvFilePath) ? await fsPromises.readFile(csvFilePath, 'utf8') : null
	if (logData) {
		const lines = logData.split('\n')
	
		const data = lines.map((line) => {
			const [timestamp, side, price, type] = line.split(',')
			return { timestamp: parseInt(timestamp), side, type, price: parseFloat(price) }
		}).filter((item) => item.timestamp > 0 && item.price > 0)
	
		data.forEach((item) => {
			if (item.type === 'UP') {
				if (item.price !== last.up) {		//prevent duplicate entries
					last.up = item.price
					up.push([item.timestamp, item.price] as any)
				}
			} else {
				if (item.price !== last.down) {		//prevent duplicate entries
					last.down = item.price
					down.push([item.timestamp, item.price] as any)
				}
			}
		})
	}
	const clob = {up, down, _complete: false}
	const limit = 3 * 60 * 1000	//3 minutes
	clob._complete = up.length > 20 && down.length > 20
		&& up[0][0] - market.startTimestamp < limit
		&& market.endTimestamp - up[up.length-1][0] < limit
		&& down[0][0] - market.startTimestamp < limit
		&& market.endTimestamp - down[down.length-1][0] < limit

	const dateString = PolymarketApi.getUTCDateFormat(new Date(market.startTimestamp))
	const firstTimestamp = market.startTimestamp + 5 * 60 * 1000	//5 minutes
	const lastTimestamp = market.endTimestamp - 5 * 60 * 1000	//5 minutes
	const tickers: any = {} as any

	for (const source of Object.keys(tickerDataSources)) {
		let tickerData: any = await getChartTickerData(market.symbol, dateString, source)
		if (!tickerData?.length) continue

		// Prevent duplicates from getting into the array based on timestamp and price
		tickerData = tickerData
			.filter((item: any) => item.timestamp >= market.startTimestamp
				&& item.timestamp <= market.endTimestamp)
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
		clob: clob,
		ticker: tickers
	} as any
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



// ---------------------------------------------------------------------------- getChartData
// data sample: {
//     "timestamp": 1765406957241,
//     "direction": "Up",
//     "type": "SELL",
//     "price": 0.36,
//     "volume": 15
// }
/*
export const getChartData = async (market: Market, logFilePath: string) => {
	console.log('getChartData from', logFilePath)

	const up: any = []
	const down: any = []
	const last: any = {up: null, down: null, ticker: null}

	const logData = fs.existsSync(logFilePath) ? await fsPromises.readFile(logFilePath, 'utf8') : null

	if (logData) {
		const lines = logData.split('\n')
	
		const data = lines.map((line) => {
			const [timestamp, direction, type, price, volume] = line.split(';')
			return { timestamp: parseInt(timestamp), direction, type, price: parseFloat(price), volume: parseFloat(volume) }
		}).filter((item) => item.timestamp > 0 && item.price > 0)
	
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
	}

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
*/


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


// ---------------------------------------------------------------------------- getChartMinuteData
// get chart data by minute. price is average of the minute.
export const getChartMinuteData = async (data: { timestamp: number, price: number }[]):
	Promise<{ timestamp: number, price: number }[]> => {
	const min = 60000
	const currentMinute = Math.floor(data[0].timestamp / min) * min
	let nextMinute = currentMinute + min
	let candle = {
		timestamp: currentMinute,
		price: 0,
		count: 0,
	}
	const chart = [candle]
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
export const getChartDistributionData = async (symbol: string, dateString: string | null = null) => {
	let data: any[] = []
	if (dateString) {
		data = await getChartTickerData(symbol, dateString)

	} else {
		// const dirList = await fsPromises.readdir(PolymarketApi.rootPath + 'tickers/' + symbol, { withFileTypes: true });
		const dirList = await fsPromises.readdir(PolymarketApi.rootPath + 'coinbase/' + symbol + '-usd', { withFileTypes: true });
		console.log('dirList:', dirList)
	
		for (const entry of dirList) {
			if (entry.isDirectory()) continue
			// const dateString = entry.name.substring(symbol.length + 1, entry.name.length - 4)		//yyyy-mm-dd
			const dateString = entry.name.split('.')[0]		//yyyy-mm-dd

const date = new Date(dateString)
// if (date.getTime() < new Date('2026-01-29 16:00:00').getTime()) continue
if (date.getTime() < new Date('2026-02-01').getTime()) continue

			const data_ = await getChartTickerData(symbol, dateString, 'coinbase')
			console.log(entry.path + '/' + entry.name, data_.length)
			// data.push(...data_ as any)
			data = data.concat(data_ as any) || []
		}
		data.sort((a, b) => a.timestamp - b.timestamp)
		console.log('chartData:', data.length)
	}
	if (!data.length) return [] as any

	const minuteData = await getChartMinuteData(data)
	const normalizedData = normalizeData(minuteData)

	const ranges: any = [] as any
	const steps = 40

	// only ranges with valid start and end data are considered
	for (let t = 0; t < 15; t++) {
		const r = [] as any
		let total = 0
		let off = 0
		for (let v = 0; v < steps; v++) r[v] = 0

		for (let i = 0; i < normalizedData.length + t - 15; i++) {
			if (!normalizedData[i].valid || !normalizedData[i + 15 - t].valid) continue
			
			const firstPrice = normalizedData[i].price		//first valid price of the range
			const lastPrice = normalizedData[i + 15 - t].price	//last valid price of the range
			const priceRatio = ((lastPrice / firstPrice) - 1) * 1000 * 2// * 60 / range	//price change ratio in percent per hour
			const value = Math.floor(priceRatio) + steps / 2				//round to the nearest integer (-20 - 19)

			total++
			if (value < 0) off++
			if (value < 0 || value >= steps) continue

			r[value]++
		}

		const max = Math.max(...r)
		ranges[t] = r.map((count: number, index: number) => (
			{index: index - steps / 2, count: count, value: count / max})
		)
		ranges[t]._total = total

		smoothValues(ranges[t])

		let volume = off
		ranges[t].forEach((item: any) => {
			item.ratio = (volume + item.count / 2) / total
			volume += item.count
		})
	}
	// console.log('ranges:', ranges)
	return ranges
}


// ---------------------------------------------------------------------------- smoothRatios
// Funktion zur Glättung (Begradigung) der ratio-Werte in ranges[t]
	const smoothValues = (arr: any[], window: number = 3, valueField: string = 'value'): void => {
		for (let i = 0; i < arr.length; i++) {
			let sum = 0
			let count = 0
			// Glättung über das Fenster (z.B. 3er-Mittelwert)
			for (let j = -Math.floor(window / 2); j <= Math.floor(window / 2); j++) {
				const idx = i + j
				if (idx >= 0 && idx < arr.length) {
					sum += arr[idx][valueField]
					count++
				}
			}
			arr[i][valueField + '_s'] = sum / count
		}
	}



// ---------------------------------------------------------------------------- getChartDistributionData
export const _getChartDistributionData = async (symbol: string, dateString: string | null = null, range: number = 15) => {
	let data: any[] = []
	if (dateString) {
		data = await getChartTickerData(symbol, dateString)

	} else {
		// const dirList = await fsPromises.readdir(PolymarketApi.rootPath + 'tickers/' + symbol, { withFileTypes: true });
		const dirList = await fsPromises.readdir(PolymarketApi.rootPath + 'coinbase/' + symbol + '-usd', { withFileTypes: true });
		console.log('dirList:', dirList)
	
		for (const entry of dirList) {
			if (entry.isDirectory()) continue
			// const dateString = entry.name.substring(symbol.length + 1, entry.name.length - 4)		//yyyy-mm-dd
			const dateString = entry.name.split('.')[0]		//yyyy-mm-dd
			const data_ = await getChartTickerData(symbol, dateString, 'coinbase')
			console.log(entry.path + '/' + entry.name, data_.length)
			// data.push(...data_ as any)
			data = data.concat(data_ as any) || []
		}
		data.sort((a, b) => a.timestamp - b.timestamp)
		console.log('chartData:', data.length)
	}
	if (!data.length) return [] as any

	const minuteData = await getChartMinuteData(data)
	const normalizedData = normalizeData(minuteData)

	const values: number[] = []
	const ranges: number[] = []

	// only ranges with valid start and end data are considered
	for (let i = 0; i < normalizedData.length - range; i++) {
		if (!normalizedData[i].valid || !normalizedData[i + range].valid) continue
		
		const firstPrice = normalizedData[i].price			//first valid price of the range
		const lastPrice = normalizedData[i + range].price	//last valid price of the range
		const priceRatio = ((lastPrice / firstPrice) - 1) * 1000 * 2// * 60 / range	//price change ratio in percent per hour
		const value = Math.floor(priceRatio)				//round to the nearest integer
		if (value > 19 || value < -20) continue

		values.push(priceRatio)					
		// value = Math.max(Math.min(value, 19), -20)
		if (!ranges[value]) ranges[value] = 0
		ranges[value]++
	}

	values.sort((a, b) => a - b)		//sort all price values

	const len = values.length
	const pos = [values[0]]		//first value 0%
	for (let i = 1; i < 10; i++) {
		pos.push(values[Math.round(i * len / 10)])
	}
	pos.push(values[len - 1])	//last value 100%

	console.log('values:', values.length, pos)

	const distribution = Object.entries(ranges).map(([value, count]) => ({
		value: parseInt(value),
		count: count,
	})).sort((a, b) => a.value - b.value)

	// console.log('distribution:', distribution.length, distribution)

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
