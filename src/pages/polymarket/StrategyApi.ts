import PolymarketApi from './PolymarketApi'
import localForage from 'localforage'

const STORE = localForage.createInstance({
	name: 'polymarket',
	storeName: 'polymarket-strategies'
})

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
