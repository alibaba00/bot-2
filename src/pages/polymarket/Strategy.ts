import type { Market } from '@/lib/polymarket/types'
import PolymarketApi from './PolymarketApi'
import localForage from 'localforage'


const STORE = localForage.createInstance({
	name: 'polymarket',
	storeName: 'polymarket-strategies'
})


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
		// const keys = await PolymarketApi.cache.keys()
		// const keys = await PolymarketApi.getAllKeys(symbol + '-updown-15m')
		const keys = await PolymarketApi.getAllKeys(symbol + '-updown-15m', new Date('2026-01-01').getTime())

		console.log('   total keys:', keys.length)

		let data = await STORE.getItem('strategie1-' + symbol) as any
		if (!data){
			data = {
				symbol: symbol,
				markets: {},
				total: 0,
				new: 0,
				valid: 0,
				invalid: 0,
			}
			await STORE.setItem('strategie1-' + symbol, data)
		}

		data.new = 0

		console.log('   check for new markets ...')
		const useKeys = {}

		for (const key of keys) {
			useKeys[key] = true
			if (data.markets[key]) continue //market already processed

			const market = await PolymarketApi.cache.getItem(key)
			if (!market?.closed || !market.chartData?._complete) continue //market not closed or chart data not complete

			// new market found
			if (!market.chartData?.clob?._complete){
				data.markets[key] = 'invalid'
				data.invalid++
				data.new++
			}else{
				data.markets[key] = 'valid'
				data.valid++
				data.new++
			}
			data.total = data.valid + data.invalid
		}

		console.log('   new markets found:', data.new)

		const stats = {
			total: 0,
			openLimit: 0.01,
			openTimeLimit: 1 * 60 * 1000,	//1 minute
			closeLimit: 0.02,
			closeTimeLimit: 2 * 1000,	//2 seconds
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
		}
		console.log('   calc ...');

		for (const key in data.markets) {
			if (data.markets[key] !== 'valid') continue
			if (!useKeys[key]) continue

			stats.total++
			const market = await PolymarketApi.cache.getItem(key)
			const startTimestamp = market.startTimestamp

			const up = market.chartData?.clob?.up
			const openUp = up.find((e: any) => e[1] <= stats.openLimit && e[0] >= startTimestamp + stats.openTimeLimit)
			if (openUp){
				stats.up.count++
				const closeUp = up.find((e: any) => e[0] > openUp[0] + stats.closeTimeLimit && e[1] >= stats.closeLimit)
				if (closeUp){
					stats.up.won++
				}else{
					stats.up.lost++
				}
			}

			const down = market.chartData?.clob?.down
			const openDown = down.find((e: any) => e[1] <= stats.openLimit && e[0] >= startTimestamp + stats.openTimeLimit)
			if (openDown){
				stats.down.count++
				const closeDown = down.find((e: any) => e[0] > openDown[0] + stats.closeTimeLimit && e[1] >= stats.closeLimit)
				if (closeDown){
					stats.down.won++
				}else{
					stats.down.lost++
				}
			}
		}

		console.table(stats)
		data.stats = stats
		await STORE.setItem('strategie1-' + symbol, data)
	}


	async updateMarketData(market: Market): Promise<void> {
		console.log('Strategy 1 check market:', market.slug)
		///
	}
}
export const Strategy1 = new _Strategy1()



// ============================================================================ Strategy2
class _Strategy2 {
	constructor() {
		console.log('Strategy 2 constructor...')
	}

	id: number = 2;
	name: string = 'Strategy 2';
	description: string = 'Strategy 2 description';
	active: boolean = true;
	createdAt: number = new Date().getTime();
	updatedAt: number = new Date().getTime();

	run(): void {
		console.log('Strategy 2 running...')
	}
}
export const Strategy2 = new _Strategy2()