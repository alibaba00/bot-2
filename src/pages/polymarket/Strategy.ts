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
		console.log('Strategy 1 running', symbol, '...')
		const fromDate = new Date('2026-02-20').getTime()
		const marketType = symbol + '-updown-5m'

		const stats = {
			symbol: symbol,
			marketType: marketType,
			openLimit: 0.01,
			openTimeLimit: 0.5 * 60 * 1000,	//4 minutes
			closeLimit: 0.019,
			closeTimeDelay: 6 * 1000,		//6 seconds
			fromDate: fromDate,
			fromDateString: moment.utc(fromDate).format('YYYY-MM-DD HH:mm:ss'),
			toDate: new Date().getTime(),
			toDateString: moment.utc(new Date()).format('YYYY-MM-DD HH:mm:ss'),
			usedMarkets: 0,
			tradedMarkets: 0,				//total traded markets
			up: {
				count: 0,
				won: 0,
				lost: 0,
				pnl: 0,
			},
			down: {
				count: 0,
				won: 0,
				lost: 0,
				pnl: 0,
			},
			winrate: 0,
			pnl: 0,
		}

		const trades: any[] = []

		const data = await loadMarketData(symbol, marketType, fromDate)
		stats.usedMarkets = data.usedMarkets.length
		console.log('   calc', stats.usedMarkets, 'markets ...');

		for (const market of data.usedMarkets) {
			await checkData(market as Market, stats, trades)
		}

		stats.winrate = (stats.pnl / stats.tradedMarkets)

		console.table(stats)
		console.log(trades)

		data.stats = stats
		data.trades = trades
		await STORE.setItem('strategie1-' + marketType, data)
	}


	async run_multi(symbol: string = 'btc'): Promise<void> {
		const values = [
			0.989,
			0.986,
			0.982,
			0.978,
			0.973,
			0.966,
			0.957,
			0.946,
			0.933,
			0.916,
			0.90,
			0.87,
			0.84,
			0.80,
			0.74,
			0.68,
			0.60,
			0.50,
			0.40,
			0.32,
			0.26,
			0.20,
			0.16,
			0.13,
			0.10,
			0.084,
			0.067,
			0.054,
			0.043,
			0.034,
			0.027,
			0.022,
			0.018,
			0.014,
			0.011,] as number[]
			
		console.log('Strategy 1 running', symbol, '...')
		const fromDate = new Date('2026-02-20').getTime()
		const marketType = symbol + '-updown-15m'

		const stats = {
			symbol: symbol,
			marketType: marketType,
			fromDate: fromDate,
			fromDateString: moment.utc(fromDate).format('YYYY-MM-DD HH:mm:ss'),
			toDate: new Date().getTime(),
			toDateString: moment.utc(new Date()).format('YYYY-MM-DD HH:mm:ss'),
			openLimit: 0.034,
			openTimeLimit: 4 * 60 * 1000,	//4 minutes
			closeLimit: 0.043,
			closeTimeDelay: 6 * 1000,		//6 seconds
			usedMarkets: 0,
			tradedMarkets: 0,				//total traded markets
			up: {
				count: 0,
				won: 0,
				lost: 0,
				pnl: 0,
			},
			down: {
				count: 0,
				won: 0,
				lost: 0,
				pnl: 0,
			},
			winrate: 0,
			pnl: 0,
		}

		const trades: any[] = []

		const data = await loadMarketData(symbol, marketType, fromDate)
		stats.usedMarkets = data.usedMarkets.length
		console.log('   calc', stats.usedMarkets, 'markets ...');

		let index = -1
//		values.forEach(async (value, index) => {
		for (const value of values) {
			index ++
			if (index <= 0) continue

			stats.tradedMarkets = 0
			stats.up.count = 0
			stats.up.won = 0
			stats.up.lost = 0
			stats.down.count = 0
			stats.down.won = 0
			stats.down.lost = 0
			stats.pnl = 0

// if (value !== 0.034) continue
			stats.openLimit = value
			stats.closeLimit = values[index - 1]
			for (const market of data.usedMarkets) {
				await checkData(market as Market, stats, trades)
			}

			stats.winrate = stats.pnl / stats.tradedMarkets
			console.log('   winrate:', index, stats.winrate, stats.tradedMarkets, stats.openLimit, stats.closeLimit)
		}

		console.log('complete!')
	}
}
export const Strategy1 = new _Strategy1()


const checkData = async (market: Market, stats: any, trades: any[]): Promise<void> => {
	// const startTimestamp = market.startTimestamp
	const endTimestamp = market.endTimestamp
	const trade: any = {
		slug: market.slug,
		outcome: market.outcome,
		up: {open: null, close: null, pnl: 0 },
		down: {open: null, close: null, pnl: 0 },
		pnl: 0,
	}
	trades.push(trade)

	const up = market.chartData.clob.up
	const openUp = up.find((e: any) => e[1] <= stats.openLimit && e[0] <= endTimestamp - stats.openTimeLimit)
	let closeUp: any = null
	if (openUp){
		stats.tradedMarkets++
		stats.up.count++
		closeUp = up.find((e: any) => e[0] > openUp[0] + stats.closeTimeDelay && e[1] > stats.closeLimit)
		if (closeUp){
			trade.up.pnl = (stats.closeLimit / stats.openLimit) - 1
			stats.up.won ++
			stats.up.pnl += trade.up.pnl
		}else{
			trade.up.pnl = -1
			stats.up.lost++
			stats.up.pnl -= 1
		}
	}

	const down = market.chartData.clob.down
	const openDown = down.find((e: any) => e[1] <= stats.openLimit && e[0] <= endTimestamp - stats.openTimeLimit)
	let closeDown: any = null
	if (openDown){
		stats.tradedMarkets++
		stats.down.count++
		closeDown = down.find((e: any) => e[0] > openDown[0] + stats.closeTimeDelay && e[1] > stats.closeLimit)
		if (closeDown){
			trade.down.pnl = (stats.closeLimit / openDown[1]) - 1
			stats.down.won++
			stats.down.pnl += trade.down.pnl
		}else{
			trade.down.pnl = -1
			stats.down.lost++
			stats.down.pnl -= 1
		}
	}

	trade.pnl = trade.up.pnl + trade.down.pnl
	stats.pnl += trade.pnl
}


// ============================================================================ Strategy2
class _Strategy2 {
	id: number = 1;
	name: string = 'Strategy 2';
	description: string = 'Strategy 2 description';
	active: boolean = false;
	createdAt: number = new Date().getTime();
	updatedAt: number = new Date().getTime();
	trades: any = {
		'up': [
			{buyLimit: 40, size: 25, sellLimit: 60},
			{buyLimit: 20, size: 50, sellLimit: 32},
			{buyLimit: 10, size: 100, sellLimit: 20},
			{stopLoss: 4},
		],
		'down': [
			{buyLimit: 40, size: 25, sellLimit: 60},
			{buyLimit: 20, size: 50, sellLimit: 32},
			{buyLimit: 10, size: 100, sellLimit: 20},
			{stopLoss: 4},
		],
	}

	constructor() {
		console.log('Strategy 2 constructor...')
	}

	async run(symbol: string = 'btc'): Promise<void> {
		console.log('Strategy 2 running', symbol, '...')
		// const keys = await PolymarketApi.cache.keys()
		// const keys = await PolymarketApi.getAllKeys(symbol + '-updown-15m')

		const fromDate = new Date('2026-02-13').getTime()
		const marketType = symbol + '-updown-5m'
		const keys = await PolymarketApi.getAllKeys(marketType, fromDate)
		console.log('   total keys:', keys.length)

		const stats = {
			symbol: symbol,
			marketType: marketType,
			fromDate: fromDate,
			fromDateString: moment.utc(fromDate).format('YYYY-MM-DD HH:mm:ss'),
			toDate: new Date().getTime(),
			toDateString: moment.utc(new Date()).format('YYYY-MM-DD HH:mm:ss'),
			usedMarkets: 0,
			tradedMarkets: 0,				//total traded markets
			up: {
				count: 0,
				won: 0,
				lost: 0,
			},
			down: {
				count: 0,
				won: 0,
				lost: 0,
			},
			winrate: 0,
			pnl: 0,
		}

		const data = await loadMarketData(symbol, marketType, fromDate)
		stats.usedMarkets = data.usedMarkets.length
		console.log('   calc', stats.usedMarkets, 'markets ...');

		for (const market of data.usedMarkets) {
			await this.checkData(market as Market, stats)
		}

		console.table(stats)
		data.stats = stats
		await STORE.setItem('strategie2-' + marketType, data)

	}


	async checkData(market: Market, stats: any): Promise<void> {
		// const startTimestamp = market.startTimestamp
		// const endTimestamp = market.endTimestamp

		for (const trade of this.trades.up) {
			///
		}

		for (const trade of this.trades.down) {
			///
		}
	}
}
export const Strategy2 = new _Strategy2()


//---------------------------------------------------------------------------- loadMarketData
export const loadMarketData = async (symbol: string, marketType: string, fromDate: number): Promise<any> => {
	const marketKeys = await PolymarketApi.getAllKeys(marketType, fromDate)
	console.log('   total keys:', marketKeys.length)

	let data = await STORE.getItem('strategie1-' + marketType) as any
	if (!data){
		data = {
			symbol: symbol,
			marketType: marketType,
			allMarkets: {},
			usedMarkets: [],
			total: 0,
			new: 0,
			valid: 0,
			invalid: 0,
		}
		await STORE.setItem('strategie1-' + marketType, data)
	}

	data.new = 0
	data.usedMarkets = []

	console.log('   check for new markets ...')
	const useKeys = {}

	for (const key of marketKeys) {
		useKeys[key] = true
		if (data.allMarkets[key] === 'invalid') continue

		const market = await PolymarketApi.cache.getItem(key)
		if (!market?.closed || !market.chartData?._complete) continue //market not closed or chart data not complete

		if (!data.allMarkets[key]){		// new market found
			if (!market.chartData?.clob?._complete){
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

		data.usedMarkets.push(market)
	}

	console.log('   new markets found:', data.new)
	return data
}
