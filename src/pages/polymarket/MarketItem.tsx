import { useEffect, useState } from "react";
import PolymarketApi from "./PolymarketApi";


export default function MarketItem(props: { market: { slug?: string; description?: string } }) {
	const market = props.market
	const priceToBeat = usePriceToBeat(market)

	useEffect(() => {
		console.log('market', market)
	}, [market])

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex flex-col gap-2'>
				<div className='text-sm text-muted-foreground'>{market.slug}</div>
			</div>
			<div className='flex flex-col gap-2'>
				<div className='text-sm text-muted-foreground'>{'Price to beat: ' + priceToBeat}</div>
			</div>
		</div>
	)
}


// ---------------------------------------------------------------------------- timeoutId
let timeoutId: NodeJS.Timeout | null = null


// ---------------------------------------------------------------------------- usePriceToBeat
function usePriceToBeat(market) {
	const [priceToBeat, setPriceToBeat] = useState('loading...')

	useEffect(() => {
		if (timeoutId) clearTimeout(timeoutId)
		console.log('usePriceToBeat', market.slug)
		const slugMatch = market.slug.match(/^([a-z]+)-updown-15m-(\d+)$/i)
		if (!slugMatch) return

		const symbol = slugMatch[1].toUpperCase()
		const slugTimestamp = parseInt(slugMatch[2], 10)
		const eventStartTime = new Date(slugTimestamp * 1000).toISOString()
		const endDate = new Date(slugTimestamp * 1000 + 15 * 60 * 1000).toISOString()
		const variant = 'fifteen'
		// "symbol": "BTC",
		// "slugTimestamp": 1764702000,
		// "eventStartTime": "2025-12-02T19:00:00.000Z",
		// "endDate": "2025-12-02T19:15:00.000Z",
		// "variant": "fifteen"

		async function fetchPriceToBeat() {
			const priceToBeat = await PolymarketApi.getPriceToBeat(symbol, eventStartTime, endDate, variant)
			if (priceToBeat !== null) {
				setPriceToBeat(priceToBeat > 100 ? priceToBeat.toFixed(2) : priceToBeat)
			} else {
				timeoutId = setTimeout(() => fetchPriceToBeat(), 5000)
			}
		}
		fetchPriceToBeat()

		return () => {
			if (timeoutId) clearTimeout(timeoutId)
		}
	}, [market.slug])

	return priceToBeat
}
