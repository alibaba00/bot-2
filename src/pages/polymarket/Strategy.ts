import type { Market } from '@/lib/polymarket/types'
import PolymarketApi, { fsPromises, fs } from './PolymarketApi'
import localForage from 'localforage'
import moment from 'moment';


const STORE = localForage.createInstance({
	name: 'polymarket',
	storeName: 'polymarket-strategies'
})

export interface Strategy {
	id: number;
	name: string;
	description: string;
	active: boolean;
	createdAt: number;
	updatedAt: number;
}

const parseNumber = (num: number) => {
	return parseFloat(num.toFixed(12))
}


//---------------------------------------------------------------------------- loadMarketData
export const loadMarketData = async (symbol: string, marketType: string, fromDate: number, toDate: number = 0): Promise<any> => {
	const strategy = symbol + '-' + marketType
	const marketKeys = await PolymarketApi.getAllKeys(strategy, fromDate, toDate)
	console.log('   total keys:', marketKeys.length)

	let data = await STORE.getItem('strategie-' + strategy) as any
	if (!data){
		data = {
			symbol: symbol,
			marketType: marketType,
			allMarkets: {},
			usedMarkets: [],
			total: 0,
			notClosed: 0,
			new: 0,
			valid: 0,
			invalid: 0,
		}
		await STORE.setItem('strategie-' + strategy, data)
	}

	data.notClosed = 0
	data.new = 0
	data.usedMarkets = []
	console.log('   check for valid markets ...')


	for (const key of marketKeys) {
		if (data.allMarkets[key] === 'invalid') continue

		if (data.allMarkets[key] === 'valid'){
			data.usedMarkets.push(key)
			continue
		}

		const market = await PolymarketApi.cache.getItem(key)
		if (!market?.closed || !market.chartData?._complete){
			data.notClosed++
			continue
		}

		if (!data.allMarkets[key]){		// new market found
			if (market.chartData?.clob?._complete !== 1){
				data.allMarkets[key] = 'invalid'
				data.invalid++
			}else{
				data.allMarkets[key] = 'valid'
				data.valid++
			}
			data.new++
		}
		data.total = data.valid + data.invalid

		if (data.allMarkets[key] === 'invalid') continue

		if (data.allMarkets[key] === 'valid'){
			data.usedMarkets.push(key)
		}
	}

	if (data.notClosed > 0){
		console.log('   not closed markets:', data.notClosed)
	}
	if (data.new > 0){
		console.log('   new markets found:', data.new)
		await STORE.setItem('strategie-' + strategy, data)
	}
	return data
}


// ============================================================================ Strategy3
class _Strategy3 {
	id: number = 1;
	name: string = 'Strategy 3';
	description: string = 'Strategy 3 description';
	active: boolean = false;
	createdAt: number = new Date().getTime();
	updatedAt: number = new Date().getTime();
	strategyData: any = null
	trades: any[] = []

	setup: any = {
		symbol : 'btc',
		marketType: 'updown-5m',
		fromDate: new Date('2026-05-04 16:00:00').getTime(),
		toDate: new Date('2026-05-09 00:00:00').getTime(),
		// fromDate: 1778148600000, // new Date('2026-05-06 10:00:00').getTime(),
		// toDate: 1778217000000, // new Date('2026-05-07 00:00:00').getTime(),
		mode: 'and',  //'and' or 'or'
		openTimeLimit: 60 * 1000,		//1 minute timeout for last buying
		marketTimeLimit: 20 * 1000,		//20 seconds market timeout before closing (to prevent price glitches)
		closeTimeDelay: 5 * 1000,		//5 seconds delay before selling
		// closeTimeDelay: 1 * 1000,	//1 second delay before selling
		gridVersion: 1,
		'up': {enabled: true, size: 1, buyLimit: 57, sellLimit: 100, closeLimit: 0, trades: [] as any[]},
		'down': {enabled: false, size: 1, buyLimit: 57, sellLimit: 100, closeLimit: 0, trades: [] as any[]},
		isRunning: false,
		stats: null as any,
	}

	constructor() {
		console.log('Strategy 3 constructor...')
	}


	//---------------------------------------------------------------------------- run
	async run(): Promise<void> {
		const s = this.setup
		console.log('Strategy 3 running', s.symbol, s.marketType, s.fromDate, s.toDate,
			moment(s.fromDate).format('YYYY-MM-DD HH:mm:ss'), '->', moment(s.toDate).format('YYYY-MM-DD HH:mm:ss'), '...')

		const data = await loadMarketData(s.symbol, s.marketType, s.fromDate, s.toDate)
		console.log('   calc', data.usedMarkets.length, 'markets ...');

		const stats = s.stats = {
			usedMarkets: data.usedMarkets.length,
			tradedMarkets: 0,				//total traded markets
			skippedMarkets: 0,				//total skipped markets
			up: {count: 0, won: 0, lost: 0, pnl: 0, pnlc: 1, buyLimit: s.up.buyLimit, enabled: s.up.enabled},
			down: {count: 0, won: 0, lost: 0, pnl: 0, pnlc: 1, buyLimit: s.down.buyLimit, enabled: s.down.enabled},
			winrate: 0,
			pnl: 0,
			pnlc: 1,
			abs: 0,
		}

		const lastTrades = {up: s.up.trades, down: s.down.trades}
		s.up.trades = []
		s.down.trades = []

		for (const key of data.usedMarkets) {
			const market = await PolymarketApi.cache.getItem(key)
			if (market.chartData?.clob?._complete !== 1) continue
			this.parseMarket(market, stats)
		}

		stats.pnl = (stats.up?.pnl || 0) + (stats.down?.pnl || 0)
		stats.pnlc = (stats.up?.pnlc || 1) + (stats.down?.pnlc || 1)
		stats.winrate = 1 + parseNumber(stats.pnl / stats.tradedMarkets)
		stats.abs = 1 + parseNumber(stats.pnl / data.usedMarkets.length)

		// console.table(this.setup)
		console.table(stats)
		console.log('up trades:', s.up.trades)
		console.log('down trades:', s.down.trades)
		console.log('complete!', Object.keys(lastTrades.up).length)

		const side = 'up'
		if (lastTrades[side].length > 0){
			const lookup = {} as any
			for (const trade of s[side].trades) lookup[trade.slug] = trade

			for (const trade of lastTrades[side]){
				if (lookup[trade.slug]){
					const currentTrade = lookup[trade.slug]
					if (trade.open !== currentTrade.open){
						console.log('changed open:', trade.slug, trade, '->', currentTrade, await PolymarketApi.cache.getItem(trade.slug))
					}
					if (trade.open !== currentTrade.open || trade.close !== currentTrade.close){
						console.log('changed close:', trade.slug, trade, '->', currentTrade, await PolymarketApi.cache.getItem(trade.slug))
					}
					if (trade.won !== currentTrade.won){
						console.log('changed won:', trade.slug, trade, '->', currentTrade, await PolymarketApi.cache.getItem(trade.slug))
					}
				}else{
					console.log('missing:', trade.slug, trade)
				}
			}
			for (const trade of s[side].trades){
				if (!lastTrades[side].find((e: any) => e.slug === trade.slug)){
					console.log('added:', trade)
				}
			}
		}

		return s
	}


	//---------------------------------------------------------------------------- parseMarket
	parseMarket(market: Market, stats: any): void {
		let buyUp: any = null
		let buyDown: any = null
		const endTimestamp = market.endTimestamp
		const timeLimit = endTimestamp - this.setup.openTimeLimit
		let up: any[] = []
		let down: any[] = []

		if (stats.up.enabled){
			up = this.getMarketClobData(market, 'up')

			const buyLimit = stats.up.buyLimit
			if (buyLimit >= up[0][1]){		//buy limit is greater than first price
				buyUp = up.find((e: any) => e[1] >= buyLimit && e[0] <= timeLimit)
			}else{
				buyUp = up.find((e: any) => e[1] <= buyLimit && e[0] <= timeLimit)
			}

// ---test for exitLimit
// const exitLimit = 20
// let exitUp: any = null
// if (exitLimit >= up[0][1]){		//buy limit is greater than first price
// 	exitUp = up.find((e: any) => e[1] >= exitLimit && e[0] <= timeLimit)
// }else{
// 	exitUp = up.find((e: any) => e[1] <= exitLimit && e[0] <= timeLimit)
// }
// if (exitUp && buyUp && exitUp[0] < buyUp[0]) buyUp = null

		}
		if (stats.down.enabled){
			down = this.getMarketClobData(market, 'down')

			const buyLimit = stats.down.buyLimit
			if (buyLimit >= down[0][1]){		//buy limit is greater than first price
				buyDown = down.find((e: any) => e[1] >= buyLimit && e[0] <= timeLimit)
			}else{
				buyDown = down.find((e: any) => e[1] <= buyLimit && e[0] <= timeLimit)
			}
		}

		// if (!buyUp && !buyDown) return
		if (buyUp || buyDown) stats.tradedMarkets ++
		else {
			stats.skippedMarkets ++
			// console.log('market skipped:', market.slug)
			return
		}

		if (buyUp && (this.setup.mode === 'and' || !buyDown || buyDown[0] > buyUp[0])){
			this.closeTrade('up', up, stats.up, market, buyUp)
		}
		if (buyDown && (this.setup.mode === 'and' || !buyUp || buyUp[0] > buyDown[0])){
			this.closeTrade('down', down, stats.down, market, buyDown)
		}
	}


	//---------------------------------------------------------------------------- checkData
	closeTrade(side: string, data: any[], stat: any, market: Market, buy: any): void {
		stat.count ++
		const closeTimeLimit = buy[0] + this.setup.closeTimeDelay
		const sideData = this.setup[side]

		// e[1] = ask, e[2] = bid
		let sell = data.find((e: any) => e[0] > closeTimeLimit && e[2] >= sideData.sellLimit)
		let close = data.find((e: any) => e[0] > closeTimeLimit && e[2] <= sideData.closeLimit)

		let pnl = 0
		let won = false

		if (sell && close){
			won = sell[0] <= close[0]
		}else if (sell){
			won = true
		}else if (close){
			won = false
		}else{
			if (market.outcome === side){
				sell = [market.endTimestamp, sideData.sellLimit, sideData.sellLimit]
				won = true
			}else{
				close = [market.endTimestamp, sideData.closeLimit, sideData.closeLimit]
				won = false
			}
		}

		if (won){
			stat.won ++
			pnl = parseNumber(sideData.sellLimit / stat.buyLimit)
		}else{
			stat.lost ++
			pnl = parseNumber(sideData.closeLimit / stat.buyLimit)
		}

		stat.pnl = parseNumber(stat.pnl + pnl - 1)
		stat.pnlc = parseNumber(stat.pnlc * (won ? 1.1 : 0.9))

		sideData.trades.push({
			slug: market.slug,
			outcome: market.outcome,
			open: buy[0],
			close: won ? sell[0] : close[0],
			won: won,
			pnl: pnl - 1,
			pnlc: stat.pnlc,
		})
	}


	//---------------------------------------------------------------------------- run_multi
	async run_multi(side: string = 'up'): Promise<void> {
		const s = this.setup
		if (s.isRunning){
			s.isRunning = false
			console.log('Strategy 3 cancelled')
			return
		}
		s.isRunning = true

		console.log('Strategy 3 multi running', s.symbol, s.marketType, '...')
		const data = await loadMarketData(s.symbol, s.marketType, s.fromDate, s.toDate)
		const t = performance.now()
		console.log('start calculating for', data.usedMarkets.length, 'markets ...');

		s.up.trades = [] as any[]
		s.down.trades = [] as any[]

		const grid = {}
		let i: number, j: number, k: number
		let index = 0

		for (i = 1; i < 100; i++){
			grid[i] = {} as any
			for (j = i+1; j <= 100; j++){
				grid[i][j] = {} as any
				for (k = i-1; k >= 0; k--){
					grid[i][j][k] = {
						// index	: index++,
						// trade	: [i,j,k],
						t0	: i,
						t1	: j,
						t2	: k,
						count	: 0,
						won		: 0,
						lost	: 0,
						pnl		: 0,
						pnlc	: 1,
						wr		: 0,
						abs		: 0,
// _trades	: [] as any[],
					}
				}
			}
		}

		let node = null as any
		let stat = null as any
		const g0 = s[side].buyLimit
		const g1 = s[side].sellLimit
		const g2 = s[side].closeLimit

		for (const slug of data.usedMarkets) {
			if (!s.isRunning) break

			stat = null
			const file = PolymarketApi.getClobPathFromSlug(slug) + slug + '_' + side + '_grid.json'
			if (fs.existsSync(file)){
				stat = JSON.parse(await fsPromises?.readFile(file, 'utf8'))
				if (stat?._version !== this.setup.gridVersion) stat = null
			}
			if (!stat){
				const market = await PolymarketApi.cache.getItem(slug)
				if (market.chartData?.clob?._complete !== 1) continue
	
				const data = this.getMarketClobData(market, side)		//get clob data
				if (side === 'down') data.forEach((e: any) => e[1] = 100 - e[1])	//invert down data
				stat = this.parseGrid(data, market.endTimestamp - this.setup.openTimeLimit, market.endTimestamp, market.outcome === side)	//parse grid
				stat._version = this.setup.gridVersion
				stat._createdAt = Date.now()
				await fsPromises?.writeFile(file, JSON.stringify(stat))
			}

			for (i = stat._min; i <= stat._max; i++){
				for (j = i+1; j <= 100; j++){
					for (k = i-1; k >= 0; k--){
						node = stat[i][j][k]
						if (node[1]) grid[i][j][k].won ++
						else grid[i][j][k].lost ++
						grid[i][j][k].count ++

						if (i === g0 && j === g1 && k === g2){
							s[side].trades.push({
								slug: slug,
								open: stat[i]._open,
								close: node[0],
								won: node[1],
							})
						}
					}
				}
			}	
			console.log('ok')
		}

		const time = (performance.now() - t) / 1000
		console.log('complete!', side, grid, time, 'seconds')

// console.log('save stat to file... A:/DATA/polymarket/export.json')
// await fsPromises?.writeFile('A:/DATA/polymarket/export.json', JSON.stringify(stat))
// console.log('done!')

		// calc pnl for each trade
		const best = [] as any[]
		for (let i = 1; i < 100; i++){
			for (let j = i+1; j <= 100; j++){
				for (let k = i-1; k >= 0; k--){
					node = grid[i][j][k]
					node.pnl = parseNumber(((node.won * node.t1 + node.lost * node.t2) / node.t0) - node.count)
					node.wr = parseNumber(1 + node.pnl / node.count)
					node.abs = parseNumber(1 + node.pnl / data.usedMarkets.length)
					if (node.abs > 1.01 && node.won > node.lost / 4 && k === 0) best.push(node)
					// if (node.abs > 1.01) best.push(node)
				}
			}
		}
		best.sort((a, b) => b.abs - a.abs)
		console.table(best.slice(0, 200))
		console.log('result:', grid[g0][g1][g2])
		console.log('trades:', s[side].trades)
		s.isRunning = false
	}


	//---------------------------------------------------------------------------- parseGrid
	parseGrid(data: any[], timeLimit: number, endTimestamp: number, won: boolean): any {
		// get min and max prices
		let min = 100, max = 0, value = 0, time = 0
		for (const item of data){
			if (item[0] > timeLimit) break
			if (item[1] < min) min = item[1]
			if (item[1] > max) max = item[1]
		}
		if (min < 1) min = 1
		if (max > 99) max = 99

		// const list = [] as any[]
		const first = data[0][1]	//first ask price value
		let i: number, j: number, k: number
		let node = null as any

		const stat = {_min: min, _max: max} as any

		// create all valid trades for this market
		for (i = min; i <= max; i++){
			stat[i] = {} as any

			// search for open trade node of this price
			const open = i >= first ?
				data.find((e: any) => e[1] >= i)?.[0]
				: data.find((e: any) => e[1] <= i)?.[0]
			stat[i]._open = open

			for (j = i+1; j <= 100; j++){
				stat[i][j] = {}
			}
		}

		const closeTimeDelay = this.setup.closeTimeDelay

		// search for next sell or close event
		for (const item of data) {
			value = item[2]		//current bid price
			time = item[0] - closeTimeDelay

			for (i = min; i <= max; i++){
				for (j = i+1; j <= 100; j++){
					for (k = i-1; k >= 0; k--){
						node = stat[i][j][k]
						if (!node && time > stat[i]._open){
							if (i < value && j <= value){			//won
								stat[i][j][k] = [item[0], true]

							}else if (i > value && k >= value){		//lost
								stat[i][j][k] = [item[0], false]
							}
						}
					}
				}
			}
		}

		//close all still open trades
		for (i = min; i <= max; i++){		//won
			for (j = i+1; j <= 100; j++){
				for (k = i-1; k >= 0; k--){
					node = stat[i][j][k]
					if (!node) {
						stat[i][j][k] = [endTimestamp, won]
					}
				}
			}
		}

		return stat
	}


	getMarketClobData(market, side: string): any[] {
		const data = market.chartData?.clob[side]
		if (!data?.[0]?.[2]) return []		//wrong data
		const timeLimit = market.endTimestamp - this.setup.marketTimeLimit

		return data.filter((e: any) => e[0] <= timeLimit)
			.map((e: any) => [e[0], Math.floor(parseNumber(e[1] * 100)), Math.floor(parseNumber(e[2] * 100))])
	}

}
export const Strategy3 = new _Strategy3()
