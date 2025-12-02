import { useEffect, useState } from 'react'
import MarketItem from './MarketItem'
import PolymarketApi from './PolymarketApi'

export default function TickerPage3() {
	const [markets, setMarkets] = useState([])
	// const [currentMarket, setCurrentMarket] = useState(null)

	useEffect(() => {
		console.log('---init TickerPage3---')

		PolymarketApi.init().then((result) => {
			console.log('result', result)
			setMarkets(result)
		})

		// setMarkets([<MarketItem market={market} />])
		// const gammaApiBase = PolymarketApi.getGammaApiBase()
		// const polymarketApiBase = PolymarketApi.getPolymarketApiBase()
		// console.log('gammaApiBase', gammaApiBase)
		// console.log('polymarketApiBase', polymarketApiBase)
		// const marketSlug = PolymarketApi.getDefaultBTCMarketSlug()
		// console.log('marketSlug', marketSlug)
		// const market = await pm.polymarketApi.getMarket(marketSlug)
		// console.log('market', market)
	}, [])

	return (
		<div className='flex flex-1 flex-col gap-6 p-4 pt-0 pb-16'>
			<h1>Ticker Page 3</h1>
			<div id='marketList'>
				{markets.map((market, index) => (
					<MarketItem key={index} market={market} />
				))}
			</div>
		</div>
	)
}
