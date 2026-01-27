import { useEffect, useState } from "react";
import PolymarketApi from "./PolymarketApi";
import type { MarketData } from "@/lib/polymarket/types copy";



export default function TradingBotPage() {
	const [currentMarket, setCurrentMarket] = useState<MarketData | null>(null)

	console.log('currentMarket:', currentMarket)

	return (
		<div className="flex flex-col gap-2 p-4">
			<h1>Trading Bot</h1>
			<MarketTimer minutes={15} onExpired={async () => {
				console.log('timer expired!')
				const currentSlug = 'btc-updown-15m-' + PolymarketApi.getUTCTimestamp(new Date(), 15).toString()
				setCurrentMarket(await PolymarketApi.fetchMarketBySlug(currentSlug) as MarketData)
			}} />
			{currentMarket && (
				<div>
					<div>{'Market-Slug: ' + currentMarket.slug}</div>
					<div>{'Market-Name: ' + currentMarket.question}</div>
				</div>
			)}
		</div>
	)
}


// ---------------------------------------------------------------------------- MarketTimer
export const MarketTimer = ({minutes, offset = 0, onExpired}:
	{minutes: number, offset?: number, onExpired?: () => void}) => {

	const timer = useMarketTimer(minutes, offset, () => {
		console.log('timer expired!')
		onExpired?.()
	})
	
	return (
		<div className='flex flex-col items-center justify-center p-2 w-40'>
			<div className='text-2xl font-bold'>{timer.timeString}</div>
		</div>
	)
}


// ---------------------------------------------------------------------------- useMarketTimer
// minutes: 15
// onExpired: () => void
// return: {minutes: number, seconds: number, timeString: string}
const useMarketTimer = (minutes: number = 15, offset: number = 0, onExpired?: () => void) => {
	const [timer, setTimer] = useState<{hours: number, minutes: number, seconds: number, timeString: string}>({
		hours: 0,
		minutes: 0,
		seconds: 0,
		timeString: '00:00:00'
	})

	useEffect(() => {
		let interval: NodeJS.Timeout | null = null
		const now = Date.now() + offset * 1000
		const past = now % (minutes * 60 * 1000)	
		const maxTime = Math.ceil(minutes * 60)
		let time = maxTime - Math.ceil(past / 1000)

		const updateTimer = () => {
			time --	//decrement time by 1 second
			if (time <= 0) time = maxTime	//reset time to maxTime if time is 0 or less
			setTimer({
				hours: Math.floor(time / 3600),
				minutes: Math.floor((time % 3600) / 60),
				seconds: time % 60,
				timeString: `${Math.floor(time / 3600).toString().padStart(2, '0')}:${Math.floor((time % 3600) / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`
			})
			if (time <= 0) onExpired?.()	//call onExpired function if time is 0 or less
		}

		updateTimer()
		interval = setInterval(updateTimer, 1000)

		onExpired?.()	//initial call

		return () => {
			if (interval) clearInterval(interval)
		}
	}, [])

	return timer
}
