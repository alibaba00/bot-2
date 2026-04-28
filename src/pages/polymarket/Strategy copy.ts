import type { Market } from '@/lib/polymarket/types'
import PolymarketApi from './PolymarketApi'
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


// ============================================================================ Strategy1
class _Strategy1 {
	id: number = 1;
	name: string = 'Strategy 1';
	description: string = 'Strategy 1 description';
	active: boolean = false;
	createdAt: number = new Date().getTime();
	updatedAt: number = new Date().getTime();

	constructor() {
		console.log('Strategy 1 constructor...')
	}

	async run(symbol: string = 'btc'): Promise<void> {
		console.log('Strategy-1 running', symbol, '...')
		const fromDate = new Date('2026-03-15').getTime()
		const marketType = symbol + '-updown-5m'

		const stats: any = {
			symbol: symbol,
			marketType: marketType,

			fromDate: fromDate,
			fromDateString: moment.utc(fromDate).format('YYYY-MM-DD HH:mm:ss'),
			toDate: new Date().getTime(),
			toDateString: moment.utc(new Date()).format('YYYY-MM-DD HH:mm:ss'),

			openLimit: 0.02,
			openTimeLimit: 60 * 1000,	//1 minutes
			closeLimit: 0.77,
			closeTimeDelay: 5 * 1000,		//6 seconds

			usedMarkets: 0,
			tradedMarkets: 0,				//total traded markets
			// wonMarkets: [],
			up: {
				enabled: true,
				count: 0,
				won: 0,
				lost: 0,
				pnl: 0,
			},
			down: {
				enabled: false,
				count: 0,
				won: 0,
				lost: 0,
				pnl: 0,
			},
			winrate: 0,
			winrate_abs: 0,
			pnl: 0,
		}

		const data = await loadMarketData(symbol, marketType, fromDate)
		stats.usedMarkets = data.usedMarkets.length
		console.log('   calc', stats.usedMarkets, 'markets ...');

		for (const market of data.usedMarkets) {
			await this.checkData(market as Market, stats)
		}

		stats.winrate = parseNumber(1 + (stats.pnl / stats.tradedMarkets))
		stats.winrate_abs = parseNumber(1 + (stats.pnl / stats.usedMarkets))

		console.table(stats)

		// data.stats = stats
		// await STORE.setItem('strategie1-' + marketType, data)
	}


	async run_multi(symbol: string = 'btc'): Promise<void> {
		console.log('Strategy-1-multi running', symbol, '...')
		const fromDate = new Date('2026-03-15').getTime()
		const marketType = symbol + '-updown-5m'

		const stats: any = {
			symbol: symbol,
			marketType: marketType,
			openLimit: 0.034,
			openTimeLimit: 60 * 1000,		//1 minutes
			closeLimit: 0.043,
			closeTimeDelay: 5 * 1000,		//5 seconds
			fromDate: fromDate,
			fromDateString: moment.utc(fromDate).format('YYYY-MM-DD HH:mm:ss'),
			toDate: new Date().getTime(),
			toDateString: moment.utc(new Date()).format('YYYY-MM-DD HH:mm:ss'),
			usedMarkets: 0,
			tradedMarkets: 0,				//total traded markets
			// wonMarkets: [],
			up: {
				enabled: true,
				count: 0,
				won: 0,
				lost: 0,
				pnl: 0,
			},
			down: {
				enabled: true,
				count: 0,
				won: 0,
				lost: 0,
				pnl: 0,
			},
			winrate: 0,
			pnl: 0,
		}

		const data = await loadMarketData(symbol, marketType, fromDate)
		stats.usedMarkets = data.usedMarkets.length
		console.log('   calc', stats.usedMarkets, 'markets ...');

		const pnls: any[] = []

		for (let openValue = 0.01; openValue <= 0.98; openValue += 0.01) {
			for (let closeValue = openValue + 0.01; closeValue <= 0.99; closeValue += 0.01) {
				stats.tradedMarkets = 0
				stats.wonMarkets = []
				stats.up.count = 0
				stats.up.won = 0
				stats.up.lost = 0
				stats.up.pnl = 0
				stats.down.count = 0
				stats.down.won = 0
				stats.down.lost = 0
				stats.down.pnl = 0
				stats.pnl = 0

				stats.openLimit = parseNumber(openValue)
				stats.closeLimit = parseNumber(closeValue)

				for (const market of data.usedMarkets) {
					await this.checkData(market as Market, stats)
				}

				pnls.push({
					side:'up',
					pnl:stats.up.pnl,
					count:stats.up.count,
					won:stats.up.won,
					open:stats.openLimit,
					close:stats.closeLimit,
				})
				pnls.push({
					side:'down',
					pnl:stats.down.pnl,
					count:stats.down.count,
					won:stats.down.won,
					open:stats.openLimit,
					close:stats.closeLimit,
				})

				// if (stats.up.pnl >= 50){
				// 	console.log('won markets:', [...stats.wonMarkets])
				// }
			}
		}

		pnls.sort((a, b) => b[1] - a[1])
		const top10 = pnls.slice(0, 10)

		console.log('complete!', pnls.length, pnls)
		console.log('top10:', top10)
	}


	//---------------------------------------------------------------------------- checkData
	async checkData(market: Market, stats: any): Promise<void> {
		// const startTimestamp = market.startTimestamp
		const endTimestamp = market.endTimestamp
		const trade: any = {
			slug: market.slug,
			outcome: market.outcome,
			up: {open: null, close: null, pnl: 0 },
			down: {open: null, close: null, pnl: 0 },
			pnl: 0,
		}

		const up = market.chartData.clob.up
		if (stats.up.enabled){
			let openUp: any = null
			if (stats.openLimit > 0.5 && up[0][1] < stats.openLimit){
				openUp = up.find((e: any) => e[1] > stats.openLimit && e[0] <= endTimestamp - stats.openTimeLimit)

			}else if (stats.openLimit < 0.5 && up[0][1] > stats.openLimit){
				openUp = up.find((e: any) => e[1] < stats.openLimit && e[0] <= endTimestamp - stats.openTimeLimit)
			}

			if (openUp){
				trade.up.open = [openUp[0], stats.openLimit]
				stats.tradedMarkets++
				stats.up.count++
				const closeUp = up.find((e: any) => e[0] > openUp[0] + stats.closeTimeDelay && e[1] > stats.closeLimit)
				if (closeUp){
					trade.up.close = [closeUp[0], stats.closeLimit]
					trade.up.pnl = (stats.closeLimit / stats.openLimit) - 1
					stats.up.won ++
					// stats.wonMarkets.push(trade)
					stats.up.pnl = parseNumber(stats.up.pnl + trade.up.pnl)
				}else{
					trade.up.pnl = -1
					stats.up.lost++
					stats.up.pnl = parseNumber(stats.up.pnl - 1)
				}
			}
		}
	
		const down = market.chartData.clob.down
		if (stats.down.enabled){
			let openDown: any = null
			if (stats.openLimit > 0.5 && down[0][1] < stats.openLimit){
				openDown = down.find((e: any) => e[1] > stats.openLimit && e[0] <= endTimestamp - stats.openTimeLimit)

			}else if (stats.openLimit < 0.5 && down[0][1] > stats.openLimit){
				openDown = down.find((e: any) => e[1] < stats.openLimit && e[0] <= endTimestamp - stats.openTimeLimit)
			}

			let closeDown: any = null
			if (openDown){
				trade.down.open = [openDown[0], stats.openLimit]
				stats.tradedMarkets++
				stats.down.count++
				closeDown = down.find((e: any) => e[0] > openDown[0] + stats.closeTimeDelay && e[1] > stats.closeLimit)
				if (closeDown){
					trade.down.close = [closeDown[0], stats.closeLimit]
					trade.down.pnl = (stats.closeLimit / stats.openLimit) - 1
					stats.down.won++
					// stats.wonMarkets.push(trade)
					stats.down.pnl = parseNumber(stats.down.pnl + trade.down.pnl)
				}else{
					trade.down.pnl = -1
					stats.down.lost++
					stats.down.pnl = parseNumber(stats.down.pnl - 1)
				}
			}
		}
		
		// if (stats.up.enabled){
		// 	const up = market.chartData.clob.up
		// 	this.checkSide(up, stats, stats.up, trade.up, endTimestamp)
		// }
	
		// if (stats.down.enabled){
		// 	const down = market.chartData.clob.down
		// 	this.checkSide(down, stats, stats.down, trade.down, endTimestamp)
		// }
	
		trade.pnl = parseNumber(trade.up.pnl + trade.down.pnl)
		stats.pnl = parseNumber(stats.pnl + trade.pnl)
	}


	//---------------------------------------------------------------------------- checkSide
	checkSide(side: any[], limits: any, stats: any, trade: any, endTimestamp: number): void {
		let open: any = null
		if (limits.openLimit > 0.5 && side[0][1] < limits.openLimit){
			open = side.find((e: any) => e[1] > limits.openLimit && e[0] <= endTimestamp - limits.openTimeLimit)

		}else if (limits.openLimit < 0.5 && side[0][1] > limits.openLimit){
			open = side.find((e: any) => e[1] < limits.openLimit && e[0] <= endTimestamp - limits.openTimeLimit)
		}

		let close: any = null
		if (open){
			trade.open = [open[0], stats.openLimit]
			stats.tradedMarkets++
			stats.count++
			close = side.find((e: any) => e[0] > open[0] + stats.closeTimeDelay && e[1] > stats.closeLimit)
			if (close){
				trade.close = [close[0], stats.closeLimit]
				trade.pnl = (stats.closeLimit / stats.openLimit) - 1
				stats.won ++
				limits.pnl = parseNumber(limits.pnl + trade.pnl)
			}else{
				trade.pnl = -1
				limits.lost++
				limits.pnl = parseNumber(limits.pnl - 1)
			}
		}
	}
	
}
export const Strategy1 = new _Strategy1()



// ============================================================================ Strategy2
class _Strategy2 {
	id: number = 1;
	name: string = 'Strategy 2';
	description: string = 'Strategy 2 description';
	active: boolean = false;
	createdAt: number = new Date().getTime();
	updatedAt: number = new Date().getTime();
	strategyData: any = null

	setup: any = {
		symbol : 'btc',
		marketType: 'btc-updown-5m',
		fromDate: new Date('2026-03-01').getTime(),

		timeLimit: 10000,		//buy timeout in seconds before closing market
		priceOffset: 0.01,
		'up': [
			{buyLimit: 0.6, size: 1, sellLimit: 0.66},
		],
		'down': [
			{buyLimit: 0.6, size: 1, sellLimit: 0.66},
		],

		// 'up': [
		// 	{buyLimit: 0.02, size: 5, sellLimit: 0.77},
		// ],
		// 'down': [
		// 	{buyLimit: 0.02, size: 5, sellLimit: 0.77},
		// ],

		// 'up': [
		// 	{buyLimit: 0.4, size: 5, sellLimit: 0.5},
		// 	{buyLimit: 0.3, size: 5, sellLimit: 0.4},
		// 	{buyLimit: 0.2, size: 10, sellLimit: 0.3},
		// 	{buyLimit: 0.1, size: 20, sellLimit: 0.2},
		// 	{buyLimit: 0.02, size: 50, sellLimit: 0.1},
		// 	{buyLimit: 0.01, size: 150, sellLimit: 0.044},
		// ],
		// 'down': [
		// 	{buyLimit: 0.4, size: 5, sellLimit: 0.5},
		// 	{buyLimit: 0.3, size: 5, sellLimit: 0.4},
		// 	{buyLimit: 0.2, size: 10, sellLimit: 0.3},
		// 	{buyLimit: 0.1, size: 20, sellLimit: 0.2},
		// 	{buyLimit: 0.02, size: 50, sellLimit: 0.1},
		// 	{buyLimit: 0.01, size: 150, sellLimit: 0.044},
		// ],
	}

	constructor() {
		console.log('Strategy 2 constructor...')
	}

	async run(): Promise<void> {
		const s = this.setup
		console.log('Strategy 2 running', s.symbol, '...')
		// const keys = await PolymarketApi.cache.keys()
		// const keys = await PolymarketApi.getAllKeys(symbol + '-updown-15m')

		const keys = await PolymarketApi.getAllKeys(s.marketType, s.fromDate)
		console.log('   total keys:', keys.length)

		this.strategyData = await STORE.getItem('strategie2-' + s.marketType) as any || {}

		if (this.strategyData.lostMarkets){
			for (const key in this.strategyData.lostMarkets){
				this.strategyData.lostMarkets[key] = false
			}
		}else{
			this.strategyData.lostMarkets = {}
		}

		const data = await loadMarketData(s.symbol, s.marketType, s.fromDate)
		data.lostMarkets = {}

		const markets = [] as any[]
		const stats = {
			symbol: s.symbol,
			marketType: s.marketType,
			fromDate: s.fromDate,
			fromDateString: moment.utc(s.fromDate).format('YYYY-MM-DD HH:mm:ss'),
			toDate: new Date().getTime(),
			toDateString: moment.utc(new Date()).format('YYYY-MM-DD HH:mm:ss'),
			totalMarkets: data.total,
			usedMarkets: data.usedMarkets.length,
			tradedMarkets: 0,				//total traded markets
			up: {
				count: 0,
				won: 0,
				lost: 0,
				levels: [0, 0, 0, 0, 0, 0, 0],
				pnl: 0,
			},
			down: {
				count: 0,
				won: 0,
				lost: 0,
				levels: [0, 0, 0, 0, 0, 0, 0],
				pnl: 0,
			},
			levels: [0, 0, 0, 0, 0, 0, 0],
			winrate: 0,
			pnl: 0,
		}

		console.log('   calc', stats.usedMarkets, 'markets ...');

		for (const key of data.usedMarkets) {
			const market = await PolymarketApi.cache.getItem(key)
			await this.checkData(market as Market, stats, markets)
		}

		console.table(stats)
		console.log(markets)
		data.stats = stats

		await PolymarketApi.store.setItem('marketFilter', this.strategyData.lostMarkets)

		// await STORE.setItem('strategie2-' + marketType, data)

		console.log('   complete!')
	}


	//---------------------------------------------------------------------------- checkData
	async checkData(market: Market, stats: any, markets: any[]): Promise<void> {
		// const startTimestamp = market.startTimestamp
		// const endTimestamp = market.endTimestamp
		if (market.chartData?.clob?._complete !== 1) return

		const up = market.chartData.clob.up
		const down = market.chartData.clob.down

		const sup = this.setup.up
		const sdn = this.setup.down

		// check which side is first
		const nextUp = up.find((e: any) => e[1] < (sup[0].buyLimit + this.setup.priceOffset))
		const nextDn = down.find((e: any) => e[1] < (sdn[0].buyLimit + this.setup.priceOffset))
		const side = nextUp && (!nextDn || (nextUp[0] < nextDn[0])) ? 'up' : nextDn ? 'down' : null
		if (!side) return
		if (side === 'up' && (up[0][1] < sup[0].buyLimit)) return		//check if first price is within buy limit
		if (side === 'down' && (down[0][1] < sdn[0].buyLimit)) return	//check if first price is within buy limit

		stats.tradedMarkets++

		const _market = {
			slug: market.slug,
			outcome: market.outcome,
			up: {
				type: 'up',
				outcome: market.outcome,
				trades: [] as any[],
				level: 0,
				pnl: 0,
			},
			down: {
				type: 'down',
				outcome: market.outcome,
				trades: [] as any[],
				level: 0,
				pnl: 0,
			},
		}
		markets.push(_market)

		if (side === 'up'){
			stats.up.count++
			this.checkTrades(this.setup.up, up, _market.up)
			if (_market.up.pnl < 0){
				this.strategyData.lostMarkets[market.slug] = true
				stats.up.lost++
			}else{
				stats.up.won++
			}
			stats.up.pnl = parseNumber(stats.up.pnl + _market.up.pnl)
			stats.up.levels[_market.up.level]++
			stats.levels[_market.up.level]++
		}else{
			stats.down.count++
			this.checkTrades(this.setup.down, down, _market.down)
			if (_market.down.pnl < 0){
				this.strategyData.lostMarkets[market.slug] = true
				stats.down.lost++
			}else{
				stats.down.won++
			}
			stats.down.pnl = parseNumber(stats.down.pnl + _market.down.pnl)
			stats.down.levels[_market.down.level]++
			stats.levels[_market.down.level]++
		}
		stats.pnl = parseNumber(stats.pnl + _market.up.pnl + _market.down.pnl)
	}

	//---------------------------------------------------------------------------- checkTrades
	checkTrades(trades: any, side: any[], market: any){
		let nextHit: [number, number] = [0, 0]
		let nextClose: [number, number, number] | null = null
		let totalSize: number = 0
		let pnl: number = 0
		let i = 0
		let trade = trades[i]

		while(trade){
			nextHit = side.find((e: any) => e[0] > nextHit[0] && e[1] <= (trade.buyLimit + this.setup.priceOffset))
			if (nextClose && (!nextHit || (nextClose[0] < nextHit[0]))){	//found close limit
				pnl += totalSize * nextClose[1]
				market.trades.push({		//sell won trade
					level: market.level,
					type: 'sell',
					price: nextClose[1],
					size: totalSize,
					amount: totalSize * nextClose[1],
					timestamp: nextClose[0],
					pnl: pnl,
				})
				market.pnl = pnl
				return true
			}
			if (nextHit){	//found buy limit
				totalSize += trade.size
				pnl -= trade.size * trade.buyLimit
				market.level ++
				market.trades.push({
					level: market.level,
					type: 'buy',
					price: trade.buyLimit,
					size: trade.size,
					amount: trade.size * trade.buyLimit,
					timestamp: nextHit[0],
					total: totalSize,
					pnl: pnl,
				})
				nextClose = side.find((e: any) => e[0] > (nextHit[0] + this.setup.timeLimit)
					&& e[1] >= trade.sellLimit)
				if (nextClose) nextClose[1] = trade.sellLimit
				
			}else{	//no next buy limit found
				break
			}
			trade = trades[++i]
		}
		market.trades.push({	//sell lost trade
			level: market.level,
			type: 'close',
			size: totalSize,
			price: 0,
			amount: 0,
			timestamp: side[side.length-1][0],
			pnl: pnl,
		})
		market.pnl = pnl
		console.log('lost:', market)
		return false
	}
}
export const Strategy2 = new _Strategy2()


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
		if (!market?.closed || !market.chartData._complete){
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
		marketType: 'updown-15m',
		fromDate: new Date('2026-04-25 00:00:00').getTime(),
		toDate: new Date('2026-04-26 00:00:00').getTime(),
		mode: 'and',  //'and' or 'or'
		openTimeLimit: 60 * 1000,		//1 minute timeout for last buying
		closeTimeDelay: 5 * 1000,		//5 seconds delay before selling
		'up': {enabled: true, buyLimit: 55, size: 1, sellLimit: 95, closeLimit: 5, trades: {} as any[]},
		'down': {enabled: false, buyLimit: 55, size: 1, sellLimit: 95, closeLimit: 5, trades: {} as any[]},
		isRunning: false
	}

	constructor() {
		console.log('Strategy 3 constructor...')
	}


	//---------------------------------------------------------------------------- run
	async run(): Promise<void> {
		const s = this.setup
		console.log('Strategy 3 running', s.symbol, s.marketType, '...')
		const data = await loadMarketData(s.symbol, s.marketType, s.fromDate, s.toDate)
		console.log('   calc', data.usedMarkets.length, 'markets ...');

		const stats = {
			usedMarkets: data.usedMarkets.length,
			tradedMarkets: 0,				//total traded markets
			up: {count: 0, won: 0, lost: 0, pnl: 0, buyLimit: s.up.buyLimit, enabled: s.up.enabled},
			down: {count: 0, won: 0, lost: 0, pnl: 0, buyLimit: s.down.buyLimit, enabled: s.down.enabled},
			winrate: 0,
			pnl: 0,
			abs: 0,
		}

		const lastTrades = {up: s.up.trades, down: s.down.trades}
		s.up.trades = {}
		s.down.trades = {}

		for (const key of data.usedMarkets) {
			const market = await PolymarketApi.cache.getItem(key)
			if (market.chartData?.clob?._complete !== 1) continue
			this.parseMarket(market, stats)
		}

		stats.pnl = (stats.up?.pnl || 0) + (stats.down?.pnl || 0)
		stats.winrate = 1 + parseNumber(stats.pnl / stats.tradedMarkets)
		stats.abs = 1 + parseNumber(stats.pnl / data.usedMarkets.length)

		console.table(this.setup)
		console.table(stats)
		console.log('up trades:', s.up.trades)
		console.log('down trades:', s.down.trades)
		console.log('complete!')

		if (Object.keys(lastTrades.up).length > 0){
			for (const key in lastTrades.up){
				const lastTrade = lastTrades.up[key]
				if (s.up.trades[key]){
					const currentTrade = s.up.trades[key]
					if (lastTrade.open !== currentTrade.open){
						console.log('changed open:', key, lastTrade, '->', currentTrade)
					}
					if (lastTrade.open !== currentTrade.open || lastTrade.close !== currentTrade.close){
						console.log('changed close:', key, lastTrade, '->', currentTrade)
					}
					if (lastTrade.outcome !== currentTrade.outcome || lastTrade.won !== currentTrade.won){
						console.log('changed outcom:', key, lastTrade, '->', currentTrade)
					}
				}else{
					console.log('missing:', key, lastTrade)
				}
			}
			for (const key in s.up.trades){
				if (!lastTrades.up[key]){
					console.log('added:', s.up.trades[key])
				}
			}
		}
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
			up = market.chartData.clob.up
				.map((e: any) => [e[0], Math.floor(parseNumber(e[1] * 100)), Math.floor(parseNumber(e[2] * 100))])

			const buyLimit = stats.up.buyLimit
			if (buyLimit >= up[0][1]){		//buy limit is greater than first price
				buyUp = up.find((e: any) => e[1] >= buyLimit && e[0] <= timeLimit)
			}else{
				buyUp = up.find((e: any) => e[1] <= buyLimit && e[0] <= timeLimit)
			}
		}
		if (stats.down.enabled){
			down = market.chartData.clob.down
				.map((e: any) => [e[0], Math.floor(parseNumber(e[1] * 100)), Math.floor(parseNumber(e[2] * 100))])

			const buyLimit = stats.down.buyLimit
			if (buyLimit >= down[0][1]){		//buy limit is greater than first price
				buyDown = down.find((e: any) => e[1] >= buyLimit && e[0] <= timeLimit)
			}else{
				buyDown = down.find((e: any) => e[1] <= buyLimit && e[0] <= timeLimit)
			}
		}

		// if (!buyUp && !buyDown) return
		if (buyUp || buyDown) stats.tradedMarkets ++

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

// 1777073400000 -> 1777073366869
// if (market.slug === 'btc-updown-15m-1777072500'){
// 	console.log('!!!!!!!!!!!!! close', sell, close, market.endTimestamp)
// }

		let pnl = 0
		let won = false

		if (sell && close){
			won = sell[0] < close[0]
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
			pnl = parseNumber(pnl + sideData.sellLimit / stat.buyLimit - 1)
		}else{
			stat.lost ++
			pnl = parseNumber(pnl + sideData.closeLimit / stat.buyLimit - 1)
		}
		sideData.trades[market.slug] = {
			outcome: market.outcome,
			open: buy[0],
			close: won ? sell[0] : close[0],
			won: won,
			pnl: pnl,
		}
		stat.pnl = parseNumber(stat.pnl + pnl)
	}


	//---------------------------------------------------------------------------- run_multi
	async run_multi(): Promise<void> {
		const s = this.setup
		if (s.isRunning){
			s.isRunning = false
			console.log('Strategy 3 cancelled')
			return
		}
		s.isRunning = true

		console.log('Strategy 3 multi running', s.symbol, s.marketType, '...')
		const data = await loadMarketData(s.symbol, s.marketType, s.fromDate, s.toDate)
		console.log('start calculating for', data.usedMarkets.length, 'markets ...');

		s.up.trades = {}
		s.down.trades = {}

		const stat = [] as any[]
		let i: number, j: number, k: number
		for (i = 1; i < 100; i++){
			stat[i] = [] as any[]
			for (j = i+1; j <= 100; j++){
				stat[i][j] = [] as any[]
				for (k = i-1; k >= 0; k--){
					stat[i][j][k] = {
						trade: [i,j,k],
						count:0,
						won:0,
						lost:0,
						pnl:0,
						wr:0,
						abs:0,
					}
				}
			}
		}

		// console.log('stat:', index, stat[60][80][40])
		let node = null as any

		for (const key of data.usedMarkets) {
			if (!s.isRunning) break

			const market = await PolymarketApi.cache.getItem(key)
			if (market.chartData?.clob?._complete !== 1) continue

			const upData = market.chartData?.clob.up
			const list = this.parseGrid(upData, market.endTimestamp - this.setup.openTimeLimit, market.endTimestamp, market.outcome === 'up', market.slug)
			for (i = 1; i < 100; i++){
				for (j = i+1; j <= 100; j++){
					for (k = i-1; k >= 0; k--){
						if (list[i]?.stat?.[j]?.[k]?.close){
							node = stat[i][j][k] as any
							node.count ++
							if (list[i].stat[j][k].won) node.won ++
							else node.lost ++
						}
					}
				}
			}

			node = list[55]?.stat?.[95]?.[5]
// if (!node){
// 	console.log('!!!!!!!!!!!! node', 55, 95, 5, list)
// 	throw new Error('node not found for 55, 95, 5')
// }
			if (node){
				s.up.trades[market.slug] = {
					outcome: market.outcome,
					open: node.open,
					close: node.close,
					won: node.won,
				}

// changed close: btc-updown-15m-1777072500 1777073400000 -> 1777073366869
if (market.slug === 'btc-updown-15m-1777072500'){
	console.log('!!!!!!!!!!!!! node', node.close)
}
			}


			console.log('ok')
		}

		console.log('complete!', stat)

		// calc pnl for each trade
		const best = [] as any[]
		for (let i = 1; i < 100; i++){
			for (let j = i+1; j <= 100; j++){
				for (let k = i-1; k >= 0; k--){
					node = stat[i][j][k]
					node.pnl = parseNumber(((node.won * node.trade[1] + node.lost * node.trade[2]) / node.trade[0]) - node.count)
					node.wr = parseNumber(1 + node.pnl / node.count)
					node.abs = parseNumber(1 + node.pnl / data.usedMarkets.length)
					if (node.abs > 1.01) best.push(node)
				}
			}
		}
		best.sort((a, b) => b.abs - a.abs)
		console.log('best:', best.length, best.slice(0, 100))
		// console.log('best:', best.length, best)

		console.log('result:', stat[55][95][5])
		console.log('trades:', s.up.trades)
		s.isRunning = false
	}


	//---------------------------------------------------------------------------- parseGrid
	parseGrid(data: any[], timeLimit: number, endTimestamp: number, won: boolean, slug: string): any[]{
		if (!data?.[0]?.[2]) return []		//wrong data

		const closeTimeDelay = this.setup.closeTimeDelay

		// create all trades for this market
		data = data.map((e: any) => [e[0], Math.floor(parseNumber(e[1] * 100)), Math.floor(parseNumber(e[2] * 100))])

		// get min and max prices inside the valid time range
		let min = 100, max = 0, value = 0, time = 0
		for (const item of data){
			if (item[0] > timeLimit) break
			if (item[1] < min) min = item[1]
			if (item[1] > max) max = item[1]
		}
		if (min < 1) min = 1
		if (max > 99) max = 99

if (slug === 'btc-updown-15m-1777072500'){
	console.log('0!!!!!!!!!!!! node', min, max)
}
		
		const list = {} as any[]
		const first = data[0][1]	//first ask price value
		let i: number, j: number, k: number

		// create all valid trades for this market
		for (i = min; i <= max; i++){
			// search for open trade node of this price
			const open = i >= first ?
				data.find((e: any) => e[1] >= i)?.[0] || timeLimit
				: data.find((e: any) => e[1] <= i)?.[0] || timeLimit

			const stat = [] as any[]
			for (j = i+1; j <= 100; j++){
				stat[j] = [] as any[]
				for (k = i-1; k >= 0; k--){
					stat[j][k] = {
						open: open,
						close: null as any,
						won: null as boolean | null,
						trade: [i, j, k],
					}
				}
			}
			list[i] = {id:i, open, stat, min:i, max:i}
		}

		// search for next sell or close event
		for (const item of data) {
			value = item[2]		//current bid price
			time = item[0] + closeTimeDelay
			for (i = Math.max(value+1, min); i <= max; i++){	//lost
if (!list[i]){
	console.log('!!!!!!!!!!!! list', i, list[i], item, item[0] > timeLimit)
	throw new Error('list not found for i=' + i)
}
				list[i].stat.forEach((j: any[]) => {
					for (k = i-1; k > value; k--){
						if (!j[k].close && time > j[k].open){
							j[k].won = true
							j[k].close = item[0]
						}
					}
				})
			}
			for (i = min; i < Math.min(value, max); i++){	//won
				list[i].stat.forEach((j: any[]) => {
					for (k = 0; k < i; k++){
						if (!j[k].close && time > j[k].open){
							j[k].won = false
							j[k].close = item[0]
						}
					}
				})
			}
		}

		//close all still open trades
		let node = null as any
		for (i = min; i <= max; i++){		//won
			for (j = i+1; j <= 100; j++){
				for (k = i-1; k >= 0; k--){
					node = list[i].stat[j][k]
					if (!node.close) {
// console.log('!!!!!!!!!!!! close', i, j, k, node)
						node.won = won
						node.close = endTimestamp
					}
				}
			}
		}
		return list
	}
}
export const Strategy3 = new _Strategy3()


