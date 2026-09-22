import moment from 'moment';
import PolymarketApi from './PolymarketApi';
import { loadMarketData } from './StrategyApi';

export interface ITrade {
	slug: string,
	outcome: 'up' | 'down',
	side: 'up' | 'down',
	timestamp: number;
	tickerPrice: number,
	openPrice: number;
	openTime: number;
	closePrice: number;
	size: number;
	cost: number;
	pnl: number;
}

export interface IResult {
	symbol: string,
	marketType: string,
	fromDate: number,
	toDate: number,
	pnl: number,
	winrate: number,
	winrateAbs: number,
	won: number,
	lost: number,
	traded: number,
	skipped: number,
	total: number,
	trades: ITrade[],
}

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
		fromDate: new Date('2026-09-12T00:00:00Z').getTime() / 1000,
		toDate: new Date('2026-09-12T23:55:00Z').getTime() / 1000,
		// fromDate: 1778148600000, // new Date('2026-05-06 10:00:00').getTime(),
		// toDate: 1778217000000, // new Date('2026-05-07 00:00:00').getTime(),
		timeMinOffset: 180,	//time offset in seconds
		timeMaxOffset: 30,	//time offset in seconds
		maxOpenPrice: 0.5,	//maximum open price in USD
		priceLimit: 1.0000, //1.0000,
		// priceLimit: 1.0002,//1.0000,
		startDelay: 3,	//order delay in seconds
		fees: 0.1,	//0.1 = 10% fees on the trade
		// size: 1,
		cost: 1,
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

		///

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
			if (market) markets.push(market)
		}
		console.log('filtered markets:', markets.length)

		// const filter = {} as any
		// markets.forEach((market: any) => filter[market.slug] = true)
		// await PolymarketApi.store.setItem('marketFilter', filter)

		// const result = await this.calcOrders(markets)
		const result = await this.calcOrders(markets)
		console.log('--------------------------------')
		console.log('winrate', Number(result.winrate.toFixed(3)), '/', Number(result.winrateAbs.toFixed(3)), 'pnl:', Number(result.pnl.toFixed(3)), 'won:', result.won, 'lost:', result.lost, 'traded:', result.traded, 'skipped:', result.skipped, 'total:', result.total)
		console.log('result:', result)
		console.table(result.trades)
	}


	// ---------------------------------------------------------------------------- calcOrders
	async calcOrders(markets: any[]): Promise<IResult> {
		console.log('calcOrders_1:', markets.length, '...')
		const s = this.setup

		const result: IResult = {
			symbol: s.symbol,
			marketType: s.marketType,
			fromDate: s.fromDate,
			toDate: s.toDate,
			pnl: 0,
			winrate: 0,
			winrateAbs: 0,
			won: 0,
			lost: 0,
			traded: 0,
			skipped: 0,
			total: markets.length,
			trades: [] as ITrade[],
		}

		for (const market of markets) {
			const chainlink = market.chartData?.ticker?.chainlink
			if (!chainlink) {
				result.skipped ++
				continue
			}

			const timeMin = market.endTimestamp - s.timeMinOffset * 1000
			const timeMax = market.endTimestamp - s.timeMaxOffset * 1000
			let trade: ITrade | null = null

			const priceMax = market.openPrice * s.priceLimit
			const priceMin = market.openPrice / s.priceLimit
			let lastPrice = market.openPrice
			let side: 'up' | 'down' | null = null
			let time = 0
			let price = 0

			for (const item of chainlink) {
				time = item[0]
				price = item[1]
				if (time < timeMin || time > timeMax) continue


				if (price <= priceMax && lastPrice > priceMax){			//we have a hit on the up side
					side = 'down'
					break
				}else if (price >= priceMin && lastPrice < priceMin){	//we have a hit on the down side
					side = 'up'
					break
				}
				lastPrice = price
			}

			if (!side) {
				result.skipped ++
				continue
			}

			trade = {slug: market.slug, outcome: market.outcome,
				side: side, timestamp: time, tickerPrice: price,
				openTime: Math.floor((time - market.startTimestamp) / 1000),
				openPrice: 0, closePrice: 0,
				size: 0, cost: 0, pnl: 0} as ITrade

			const clob = market.chartData.clob[trade.side]
			const startTime = trade.timestamp + s.startDelay * 1000

			const item = clob.find((item: any) => item[0] >= startTime && item[1] <= s.maxOpenPrice)
			if (!item) {
				result.skipped ++
				continue
			}

			result.trades.push(trade)

			trade.openPrice = item[1]
			trade.closePrice = side === market.outcome? 1 : 0

			// trade.size = s.size
			// trade.cost = trade.size * trade.openPrice

			trade.cost = s.cost
			trade.size = trade.cost / trade.openPrice

			if (trade.closePrice === 1) {
				trade.pnl = trade.size - trade.cost
				result.won ++
			} else {
				trade.pnl = -trade.cost
				result.lost ++
			}
			result.traded ++
			result.pnl = parseNumber(result.pnl + trade.pnl)
			result.winrate = parseNumber(1 + result.pnl / result.traded)
			result.winrateAbs = parseNumber(1 + result.pnl / result.total)
		}

		return result
	}
}

export const Strategy5 = new _Strategy5()
