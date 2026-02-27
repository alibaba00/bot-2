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
		console.log('Strategy 1 running', symbol, '...')
		const fromDate = new Date('2026-02-26').getTime()
		const marketType = symbol + '-updown-5m'
		const trades: any[] = []

		const stats: any = {
			symbol: symbol,
			marketType: marketType,
			openLimit: 0.02,
			openTimeLimit: 50 * 1000,	//1 minutes
			closeLimit: 0.5,
			closeTimeDelay: 5 * 1000,		//6 seconds
			fromDate: fromDate,
			fromDateString: moment.utc(fromDate).format('YYYY-MM-DD HH:mm:ss'),
			toDate: new Date().getTime(),
			toDateString: moment.utc(new Date()).format('YYYY-MM-DD HH:mm:ss'),
			usedMarkets: 0,
			tradedMarkets: 0,				//total traded markets
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
			await checkData(market as Market, stats, trades)
		}

		stats.winrate = parseNumber(1 + (stats.pnl / stats.tradedMarkets))
		stats.winrate_abs = parseNumber(1 + (stats.pnl / stats.usedMarkets))

		console.table(stats)
		console.log(trades)

		// data.stats = stats
		// await STORE.setItem('strategie1-' + marketType, data)
	}


	async run_multi(symbol: string = 'btc'): Promise<void> {
		console.log('Strategy 1 running', symbol, '...')
		const fromDate = new Date('2026-02-26').getTime()
		const marketType = symbol + '-updown-5m'

		const stats: any = {
			symbol: symbol,
			marketType: marketType,
			openLimit: 0.034,
			openTimeLimit: 60 * 1000,	//1 minutes
			closeLimit: 0.043,
			closeTimeDelay: 5 * 1000,		//5 seconds
			fromDate: fromDate,
			fromDateString: moment.utc(fromDate).format('YYYY-MM-DD HH:mm:ss'),
			toDate: new Date().getTime(),
			toDateString: moment.utc(new Date()).format('YYYY-MM-DD HH:mm:ss'),
			usedMarkets: 0,
			tradedMarkets: 0,				//total traded markets
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
		const trades: any[] = []

		for (let openValue = 0.01; openValue <= 0.98; openValue += 0.01) {
			for (let closeValue = openValue + 0.01; closeValue <= 0.99; closeValue += 0.01) {
				stats.tradedMarkets = 0
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
					await checkData(market as Market, stats, trades)
				}

				pnls.push(['up', stats.up.pnl, stats.up.count, stats.up.won, stats.openLimit, stats.closeLimit])
				pnls.push(['down', stats.down.pnl, stats.down.count, stats.down.won, stats.openLimit, stats.closeLimit])
			}
		}

		pnls.sort((a, b) => b[1] - a[1])
		const top10 = pnls.slice(0, 10)

		console.log('complete!', pnls.length, pnls)
		console.log('top10:', top10)
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

	if (stats.up.enabled){
		const up = market.chartData.clob.up
		const openUp = up.find((e: any) => e[1] < stats.openLimit && e[0] <= endTimestamp - stats.openTimeLimit)
		let closeUp: any = null
		if (openUp){
			trade.up.open = [openUp[0], stats.openLimit]
			stats.tradedMarkets++
			stats.up.count++
			closeUp = up.find((e: any) => e[0] > openUp[0] + stats.closeTimeDelay && e[1] > stats.closeLimit)
			if (closeUp){
				trade.up.close = [closeUp[0], stats.closeLimit]
				trade.up.pnl = (stats.closeLimit / stats.openLimit) - 1
				stats.up.won ++
				stats.up.pnl = parseNumber(stats.up.pnl + trade.up.pnl)
// trades.push(trade)
			}else{
				trade.up.pnl = -1
				stats.up.lost++
				stats.up.pnl = parseNumber(stats.up.pnl - 1)
			}
		}
	}

	if (stats.down.enabled){
		const down = market.chartData.clob.down
		const openDown = down.find((e: any) => e[1] < stats.openLimit && e[0] <= endTimestamp - stats.openTimeLimit)
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
				stats.down.pnl = parseNumber(stats.down.pnl + trade.down.pnl)
// trades.push(trade)
			}else{
				trade.down.pnl = -1
				stats.down.lost++
				stats.down.pnl = parseNumber(stats.down.pnl - 1)
			}
		}
	}

	trade.pnl = parseNumber(trade.up.pnl + trade.down.pnl)
	stats.pnl = parseNumber(stats.pnl + trade.pnl)
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
