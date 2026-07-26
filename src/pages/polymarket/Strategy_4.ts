import type { Market } from '@/lib/polymarket/types'
import PolymarketApi, { fsPromises, fs } from './PolymarketApi'
import moment from 'moment';
import { loadMarketData } from './StrategyApi'

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



// ============================================================================ Strategy_4
class _Strategy4 {
	id: number = 1;
	name: string = 'Strategy 4';
	description: string = 'Strategy 4 description';
	active: boolean = false;
	createdAt: number = new Date().getTime();
	updatedAt: number = new Date().getTime();
	strategyData: any = null
	trades: any[] = []

	setup: any = {
		symbol : 'xrp',
		marketType: 'updown-5m',
		fromDate: new Date('2026-06-01 00:00:00').getTime(),
		toDate: new Date('2026-07-10 00:00:00').getTime(),
		// fromDate: 1778148600000, // new Date('2026-05-06 10:00:00').getTime(),
		// toDate: 1778217000000, // new Date('2026-05-07 00:00:00').getTime(),
		isRunning: false,
		result: null as any,
	}

	constructor() {
		console.log('Strategy 4 constructor...')
	}


	//---------------------------------------------------------------------------- run
	async run(): Promise<void> {
		const s = this.setup
		console.log('Strategy 4 running', s.symbol, s.marketType, s.fromDate, s.toDate,
			moment(s.fromDate).format('YYYY-MM-DD HH:mm:ss'), '->', moment(s.toDate).format('YYYY-MM-DD HH:mm:ss'), '...')

		let result = await PolymarketApi.cache.getItem('outcomes_' + s.symbol + '_' + s.marketType)
		if (!result || result.from !== s.fromDate || result.to !== s.toDate) {
			const data = await loadMarketData(s.symbol, s.marketType, s.fromDate, s.toDate)
			console.log('   calc', data.usedMarkets.length, 'valid markets ...');
	
			const oc = [] as number[]
			let count = 0
			for (const key of data.usedMarkets) {
				const market = await PolymarketApi.cache.getItem(key)
				oc.push(market.outcome === 'up' ? 1 : market.outcome === 'down' ? -1 : 0)
				count ++
			}
	
			result = {
				count: count,
				oc: oc,
				from: s.fromDate,
				fromStr: moment(s.fromDate).format('YYYY-MM-DD HH:mm:ss'),
				to: s.toDate,
				toStr: moment(s.toDate).format('YYYY-MM-DD HH:mm:ss'),
				stats: {}
			}
			await PolymarketApi.cache.setItem('outcomes_' + s.symbol + '_' + s.marketType, result)
		}

		console.log('result:', result)
		s.result = result

		this.parseResult(result)
	}


	//---------------------------------------------------------------------------- parseResult
	async parseResult(result: any): Promise<void> {
		result.stats = {
			up: {
				side: 'up',
				total: 0,
				count: 0,
				won: 0,
				lost: 0,
				pnl: 0,
				chart: [] as number[]
			},
			down: {
				side: 'down',
				total: 0,
				count: 0,
				won: 0,
				lost: 0,
				pnl: 0,
				chart: [] as number[]
			}
		}
		let side: any = null
		let last: any = null

		for (let i = 0; i < result.oc.length; i++) {
			const s = result.oc[i] === 1 ? 'up' : result.oc[i] === -1 ? 'down' : null
			if (s) {
				side = result.stats[s]
				side.total ++
				if (last) {
					if (side === last) {
						side.won ++
						side.pnl ++
					}else{
						side.lost ++
						side.pnl --
					}
					side.chart.push(side.pnl)
				}
				last = side
			}else if (last) {
				// last.lost ++
				// last.pnl --
				// last.chart.push(last.pnl)
				last = null
			}
		}
	}
}
export const Strategy4 = new _Strategy4()
