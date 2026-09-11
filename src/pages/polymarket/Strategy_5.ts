import moment from 'moment';
import PolymarketApi from './PolymarketApi';
import { loadMarketData } from './StrategyApi';

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



// ============================================================================ Strategy_5
class _Strategy5 {
	id: number = 1;
	name: string = 'Strategy 5';
	description: string = 'Strategy 5 description';
	active: boolean = false;
	createdAt: number = new Date().getTime();
	updatedAt: number = new Date().getTime();
	strategyData: any = null
	trades: any[] = []

	setup: any = {
		symbol : 'btc',
		marketType: 'updown-5m',
		fromDate: new Date('2026-09-10T00:00:00Z').getTime() / 1000,
		toDate: new Date('2026-09-10T23:55:00Z').getTime() / 1000,
		// fromDate: 1778148600000, // new Date('2026-05-06 10:00:00').getTime(),
		// toDate: 1778217000000, // new Date('2026-05-07 00:00:00').getTime(),
		timeMinOffset: 60000,
		timeMaxOffset: 12000,
		priceLimit: 1.0003,
		startDelay: 3000,
		isRunning: false,
		result: null as any,
		filteredMarkets: [] as any[],
	}

	constructor() {
		console.log('Strategy 5 constructor...')
	}


	// ---------------------------------------------------------------------------- test
	async test(): Promise<void> {
		const s = this.setup
		console.log('Strategy 5 testing', s.symbol, s.marketType, s.fromDate, s.toDate)

		console.log('start get markets...')

		let markets = await PolymarketApi.getAllMarkets('btc-updown-5m', s.fromDate)
		console.log('markets:', markets)

		markets = markets.filter((market: any) => {
			if (!market.closed) return false
			const timeMin = market.endTimestamp - s.timeMinOffset
			const timeMax = market.endTimestamp - s.timeMaxOffset
			const max = market.openPrice * s.priceLimit
			const min = market.openPrice / s.priceLimit
			const valid = market.chartData?.ticker?.chainlink?.find((item: any) => item[0] > timeMin && item[0] < timeMax && item[1] > min && item[1] < max)
			return valid? true : false
		})
		console.log('markets:', markets)

		const filter = {} as any
		markets.forEach((market: any) => filter[market.slug] = true)

		await PolymarketApi.store.setItem('marketFilter', filter)

		const total = await this.calcOrders(markets)
		console.log('total:', total)
	}


	//---------------------------------------------------------------------------- run
	async run(): Promise<void> {
		const s = this.setup
		console.log('Strategy 5 running', s.symbol, s.marketType, s.fromDate, s.toDate)

		console.log('start get markets...')

		const list = PolymarketApi.indexList.filter((item: any) => item.symbol === s.symbol && item.type === s.marketType && item.timestamp >= s.fromDate && item.timestamp <= s.toDate)
		list.sort((a: any, b: any) => b.timestamp - a.timestamp)
		console.log('total markets:', list.length)

		let markets = [] as any[]
		for (const item of list) {
			const market = await PolymarketApi.cache.getItem(item.name)
			const timeMin = market.endTimestamp - s.timeMinOffset
			const timeMax = market.endTimestamp - s.timeMaxOffset
			const max = market.openPrice * s.priceLimit
			const min = market.openPrice / s.priceLimit
			const valid = market.chartData?.ticker?.chainlink?.find((item: any) => item[0] > timeMin && item[0] < timeMax && item[1] > min && item[1] < max)
			if (valid) markets.push(market)
		}
		console.log('filtered markets:', markets.length)

		const filter = {} as any
		markets.forEach((market: any) => filter[market.slug] = true)
		await PolymarketApi.store.setItem('marketFilter', filter)

		const result = await this.calcOrders(markets)
		console.log('result:', result)
	}


	// ---------------------------------------------------------------------------- calcOrders
	async calcOrders(markets: any[]): Promise<any> {
		console.log('calcOrders:', markets.length, '...')
		const s = this.setup

		const result = {
			symbol: s.symbol,
			marketType: s.marketType,
			fromDate: s.fromDate,
			toDate: s.toDate,
			pnl: 0,
			won: 0,
			lost: 0,
			total: 0,
			trades: [] as any[],
		}

		for (const market of markets) {
			const chainlink = market.chartData?.ticker?.chainlink
			if (!chainlink) continue

			const trade: any = {
				slug: market.slug,
				pnl: 0,
				won: 0,
				lost: 0,
				total: 0,
				orders: [] as any[],
			}
			result.trades.push(trade)

			trade.orders = [
				{side: 'up', limit: 0.05, filled: 0, pnl: 0},
				{side: 'up', limit: 0.02, filled: 0, pnl: 0},
				{side: 'up', limit: 0.01, filled: 0, pnl: 0},
				{side: 'down', limit: 0.05, filled: 0, pnl: 0},
				{side: 'down', limit: 0.02, filled: 0, pnl: 0},
				{side: 'down', limit: 0.01, filled: 0, pnl: 0},
			] as any[]
	
			const timeMin = market.endTimestamp - s.timeMinOffset
			const timeMax = market.endTimestamp - s.timeMaxOffset

			const up = market.chartData.clob.up
			const down = market.chartData.clob.down

			for (const item of up) {
				const time = item[0]
				if (time < timeMin || time > timeMax) continue
				const price = item[1]
				for (const order of trade.orders) {
					if (order.filled === 1) continue
					if (order.side === 'up' && price <= order.limit) {
						order.filled = 1
						order.pnl = market.outcome === 'up' ? parseNumber(1/order.limit * 0.9) : -1
						trade.pnl += order.pnl
					}
				}
			}
			for (const item of down) {
				const time = item[0]
				if (time < timeMin || time > timeMax) continue
				const price = item[1]
				for (const order of trade.orders) {
					if (order.filled === 1) continue
					if (order.side === 'down' && price <= order.limit) {
						order.filled = 1
						order.pnl = market.outcome === 'down' ? parseNumber(1/order.limit * 0.9) : -1
						trade.pnl += order.pnl
					}
				}
			}

			// console.log('trade:', trade.pnl, trade)
			result.pnl += trade.pnl
			if (trade.pnl > 0) result.won ++
			else result.lost ++
			result.total ++
		}

		return result
	}

}

export const Strategy5 = new _Strategy5()
