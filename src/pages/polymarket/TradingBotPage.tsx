import { use, useEffect, useMemo, useRef, useState } from "react";
import PolymarketApi from "./PolymarketApi";
import type { MarketData } from "@/lib/polymarket/types copy";
import ClobMarketTicker, { type LastTrade } from "./ClobMarketTicker";
import CoinbasePriceTicker from "./CoinbasePriceTicker";
import { beep } from "@/lib/utils";



export default function TradingBotPage() {
	const [currentMarket, setCurrentMarket] = useState<MarketData | null>(null)

	const setup = useRef({
		currentMarket: null as MarketData | null,
		baseTimestamp: 0,
		basePrice: 0,
		nextTimestamp: Infinity,
		tickerValues: {
			coinbase: {timestamp: 0, price: 0},
			clob: {
				up: {timestamp: 0, price: 0},
				down: {timestamp: 0, price: 0}
			}
		},
		events: {
			up: {limit: 1.00025, timestamp: 0, price: 0},
			down: {limit: 1 / 1.00025, timestamp: 0, price: 0}
		}
	})

	// console.log('currentMarket:', currentMarket)

	const onExpired = async () => {
		console.log('----------------------onExpired:')
		const timestamp = getUTCTimestamp(Date.now() + 10000, 15, 0)
		setup.current.nextTimestamp = (timestamp + 15 * 60) * 1000
		setup.current.baseTimestamp = timestamp * 1000
		setup.current.basePrice = setup.current.tickerValues.coinbase.price
		const currentSlug = 'btc-updown-15m-' + timestamp.toString()

		setup.current.currentMarket = await PolymarketApi.fetchMarketBySlug(currentSlug) as MarketData
		setCurrentMarket(setup.current.currentMarket)
	}

	useEffect(() => {
		onExpired()
	}, [])

	const onLastTradePriceUpdate = (lastTrade: LastTrade) => {
		// console.log('onLastTradePriceUpdate:', lastTrade)
		const values = setup.current.tickerValues.clob[lastTrade.outcome_title]
		values.price = lastTrade.price
		values.timestamp = lastTrade.timestamp
		// console.log('tickerValues:', tickerValues.current)
	}

	const onCoinbasePriceUpdate = (timestamp: number, price: number) => {
		// console.log('onCoinbasePriceUpdate:', timestamp, price, 'baseTimestamp:', baseTimestamp, 'nextTimestamp:', nextTimestamp.current)
		// console.log(timestamp, price, nextTimestamp.current, timestamp >= nextTimestamp.current)

		const values = setup.current.tickerValues

		values.coinbase = {timestamp: timestamp, price: price}
		if (setup.current.basePrice){
			const events = setup.current.events
			const event = price / setup.current.basePrice
			if (!events.up.timestamp &&event >= events.up.limit){
				events.up.timestamp = timestamp
				events.up.price = values.clob.up.price
				console.log('--------------------alertValue.current.up.timestamp:', events.up.timestamp)
				beep()
			}
			if (!events.down.timestamp && event <= events.down.limit){
				events.down.timestamp = timestamp
				events.down.price = values.clob.down.price
				console.log('--------------------alertValue.current.down.timestamp:', events.down.timestamp)
				beep()
			}
		}
	}

	// console.log('tickerValues:', tickerValues.current)

	return (
		<div className="flex flex-col gap-2 p-4 w-full">
			<h1>Trading Bot</h1>
			<MarketTimer minutes={15} onExpired={onExpired} />
			{currentMarket && (
				<>
				<div className='w-full'>
					<div>{'Market-Slug: ' + currentMarket.slug}</div>
					<div>{'Market-Name: ' + currentMarket.question}</div>
					<div>{'Base Timestamp: ' + setup.current.baseTimestamp.toString()}</div>
					<div>{'Next Timestamp: ' + setup.current.nextTimestamp.toString()}</div>
					<div>{'Base Price: ' + setup.current.basePrice.toString()}</div>
					<div>{'Alert Value up: ' + setup.current.events.up.limit.toString()
					 + ' - ts: ' + setup.current.events.up.timestamp.toString()	
					 + ' - price: ' + setup.current.events.up.price.toString()}</div>
					<div>{'Alert Value down: ' + setup.current.events.down.limit.toString()
					 + ' - ts: ' + setup.current.events.down.timestamp.toString()
					 + ' - price: ' + setup.current.events.down.price.toString()}</div>
				</div>
				<div className='flex flex-row gap-2 flex-wrap w-full'>
					<ClobMarketTicker market={currentMarket} onUpdate={onLastTradePriceUpdate} />
					<CoinbasePriceTicker symbol={'BTC-USD'} onUpdate={onCoinbasePriceUpdate} />
				</div>
				<TradesList market={currentMarket} setup={setup.current} />
				</>
			)}
		</div>
	)
}


// ---------------------------------------------------------------------------- TradesList
const TradesList = ({market, setup}: {market: MarketData, setup: any}) => {
	const [trades, setTrades] = useState<any[]>([1, 2, 3])

	useEffect(() => {
		console.log('---TradesList init:', market)
	}, [])

	useEffect(() => {
		console.log('---TradesList market update:', market)
	}, [market])


	return (
		<div className='flex flex-col gap-2 w-full flex-1 overflow-y-auto'>
			{trades.map((trade) => (
				<TradeItem key={trade.id} trade={trade} setup={setup} />
			))}
		</div>
	)
}


// ---------------------------------------------------------------------------- TradeItem
const TradeItem = ({trade, setup}: {trade: any, setup: any}) => {
	return (
		<div className='flex flex-row gap-2 w-full min-h-10 p-2 bg-gray-100 dark:bg-gray-900 rounded-md'>
			<div>Trade-Item:</div>
			<div>{trade.id} - {setup.currentMarket.slug}</div>
			<div>{trade.price} - {setup.currentMarket.openPrice}</div>
			<div>{trade.quantity} - {setup.currentMarket.openSize}</div>
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
		console.log('--- useMarketTimer --- minutes:', minutes, 'offset:', offset)
		const maxTime = Math.ceil(minutes * 60)		//max time in seconds
		let now = Date.now() + offset * 1000
		let past = now % (minutes * 60 * 1000)	
		let time = maxTime - Math.ceil(past / 1000)
		if (time <= 10) time += maxTime

		const updateTimer = () => {
			time --	//decrement time by 1 second
			if (time <= 0) {
				onExpired?.()	//call onExpired function if time is 0 or less
				// time = maxTime	//reset time to maxTime if time is 0 or less
				now = Date.now() + offset * 1000
				past = now % (minutes * 60 * 1000)	
				time = maxTime - Math.ceil(past / 1000)
				if (time <= 10) time += maxTime
			}
			setTimer({
				hours: Math.floor(time / 3600),
				minutes: Math.floor((time % 3600) / 60),
				seconds: time % 60,
				timeString: `${Math.floor(time / 3600).toString().padStart(2, '0')}:${Math.floor((time % 3600) / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`
			})
		}

		updateTimer()
		const interval: NodeJS.Timeout = setInterval(updateTimer, 1000)	//set interval to 1 second

		return () => {
			if (interval) clearInterval(interval)
		}
	}, [])

	return timer
}


// ---------------------------------------------------------------------------- getUTCTimestamp
// Function to get the current 15-minute UTC timestamp (rounded down to nearest 15-minute interval)
// date: e.g. 2025-12-10
const getUTCTimestamp = (date: Date | number | null, minutes: number = 15, offset: number = 0): number => {
	if (!date) date = new Date()
	let dateTime = date instanceof Date ? date.getTime() : date
	const dateTimeSeconds = Math.floor(dateTime / 1000) + offset // Convert to seconds
	const minutesSeconds = minutes * 60 // minutes in seconds
	// Round down to the nearest minutes interval
	const utcTimestamp = Math.floor(dateTimeSeconds / minutesSeconds) * minutesSeconds - offset

// const past = dateTime % (minutes * 60 * 1000)
// const maxTime = Math.ceil(minutes * 60)
// let timeoutMinutes = maxTime - Math.ceil(past / 1000)
// console.log('--------- timeoutMinutes:', timeoutMinutes / 60, 'utcTimestamp', utcTimestamp,  'offset:', offset, 'minutes:', minutes)

	return utcTimestamp
}
