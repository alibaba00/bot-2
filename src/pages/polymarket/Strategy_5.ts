import moment from 'moment';
import PolymarketApi from './PolymarketApi';
import { loadMarketData } from './StrategyApi';

export interface ITrade {
	slug: string,
	outcome: 'up' | 'down',
	side: 'up' | 'down',
	openPrice: number;
	openTime: number;
	closeTime: number;
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
		symbol : 'xrp',
		marketType: 'updown-5m',
		fromDate: new Date('2026-09-23T00:00:00Z').getTime() / 1000,
		// fromDate: 1790199300,
		// toDate: new Date('2026-09-22T23:55:00Z').getTime() / 1000,
		toDate: new Date('2026-09-25T00:00:00Z').getTime() / 1000,
		// toDate: 1790231100,
		// fromDate: 1778148600000, // new Date('2026-05-06 10:00:00').getTime(),
		// toDate: 1778217000000, // new Date('2026-05-07 00:00:00').getTime(),
		timeMin: -20,	//time offset in seconds
		timeMax: 10,	//time offset in seconds
		openLimit: 0.35,	//open limit in percentage
		closeLimit: 0.75,	//close limit in percentage
		orderDelay: 3,	//order delay in seconds min time between open order fully fulfilled and setting close order
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
	async run(): Promise<IResult> {
		const s = this.setup
		console.log('Strategy 5 running', s.symbol, s.marketType, s.fromDate, s.toDate)

		console.log('start get markets...')

		const list = PolymarketApi.indexList.filter((item: any) => item.symbol === s.symbol && item.type === s.marketType && item.timestamp >= s.fromDate && item.timestamp < s.toDate)
		list.sort((a: any, b: any) => a.timestamp - b.timestamp)
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
		result.winrate = parseNumber(1 + result.pnl / result.traded)
		result.winrateAbs = parseNumber(1 + result.pnl / result.total)

		console.log('--------------------------------')
		console.log('setup:', s)
		console.log('result:', result)
		console.log('winrate', Number(result.winrate.toFixed(3)), '/', Number(result.winrateAbs.toFixed(3)), 'pnl:', Number(result.pnl.toFixed(3)), 'won:', result.won, 'lost:', result.lost, 'traded:', result.traded, 'skipped:', result.skipped, 'total:', result.total)
		console.log('--------------------------------')
		// console.table(result.trades)

		return result
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

		const timeMin = s.timeMin * 1000
		const timeMax = s.timeMax * 1000

		for (const market of markets) {
			const chartData = this.mergeData(market)
			if (!chartData) {
				result.skipped ++
				continue
			}

			const up = chartData.find((item: any) =>
				item.time >= timeMin && item.time <= timeMax
				&& item.up < s.openLimit)

			const down = !up? chartData.find((item: any) =>
				item.time >= timeMin && item.time <= timeMax
				&& item.down < s.openLimit) : null

			if (!up && !down){
				result.skipped ++
				continue
			}

			const side = up || down

			const trade: ITrade = {
				slug: market.slug,
				outcome: market.outcome,
				side: up ? 'up' : 'down',
				openTime: market.startTimestamp + side.time,
				openPrice: s.openLimit,
				closeTime: 0,
				closePrice: 0,
				size: parseNumber(s.cost / s.openLimit),
				cost: s.cost,
				pnl: 0,
			}
			result.trades.push(trade)
			result.traded ++

			const close = chartData.find((item: any) => item.time >= (side.time + s.orderDelay * 1000) && item[trade.side] > s.closeLimit)
			if (close){		//won
				trade.closeTime = market.startTimestamp + close.time
				trade.closePrice = s.closeLimit
				trade.pnl = trade.size * s.closeLimit - 1
				result.won ++
			}else{			//lost
				trade.pnl = -trade.cost
				result.lost ++
			}
			result.pnl = parseNumber(result.pnl + trade.pnl)
		}

		return result
	}


	// ---------------------------------------------------------------------------- mergeData
	// merge chainlink-twap + clob-up and -down
	mergeData(market: any): any[] | null {
		const ct = market.chartData?.ticker?.['chainlink-twap']
		if (!ct) {
			return null
		}
		const up = market.chartData?.clob?.up
		const down = market.chartData?.clob?.down
		if (!up || !down) {
			return null
		}

		const chart = {}
		let _up, _down, _ct

		for (const item of up) {
			if (item[1] === _up) continue
			chart[item[0]] = {time:item[0], up:item[1]}
			_up = item[1]

		}
		for (const item of down) {
			if (item[1] === _down) continue
			if (!chart[item[0]]) chart[item[0]] = {time:item[0], up:null, down:null}
			chart[item[0]].down = item[1]
			_down = item[1]
		}
		for (const item of ct) {
			if (item[1] === _ct) continue
			if (!chart[item[0]]) chart[item[0]] = {time:item[0], up:null, down:null}
			chart[item[0]].ct = item[1] / market.openPrice
			_ct = item[1]
		}

		let chartData = Object.values(chart)
		chartData.sort((a: any, b: any) => a.time - b.time)
		_up = null
		_down = null
		_ct = null

		for (const item of chartData as any[]) {
			item.time = item.time - market.startTimestamp
			item.up = item.up ?? _up
			item.down = item.down ?? _down
			item.ct = item.ct ?? _ct
			_up = item.up
			_down = item.down
			_ct = item.ct
		}

		// chartData = chartData.filter((item: any) => item.time >= 0 && item.up !== null && item.down !== null && item.ct !== null)
		chartData = chartData.filter((item: any) => item.up !== null && item.down !== null && item.ct !== null)
		return chartData
	}

}

export const Strategy5 = new _Strategy5()
