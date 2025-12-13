import { useEffect, useState } from 'react'
import MarketItem from './MarketItem'
import PolymarketApi from './PolymarketApi'

export default function TickerPage3() {
	const [markets, setMarkets] = useState<Array<{ symbol: string; type: string }>>([])

	useEffect(() => {
		console.log('---init TickerPage3---')

		PolymarketApi.init().then(() => {
			console.log('PolymarketApi initialized')
			// TODO: Load markets from API or state
			// For now, set empty array or load from somewhere
			setMarkets([])
		})
	}, [])

	return (
		<div className='flex flex-1 flex-col gap-6 p-4 pt-0 pb-16'>
			<h1>Ticker Page 3</h1>
			<div id='marketList'>
				{markets.map((market, index) => (
					<MarketItem key={index} symbol={market.symbol} type={market.type} />
				))}
			</div>
		</div>
	)
}
