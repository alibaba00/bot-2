import { use, useEffect, useMemo, useRef, useState } from "react";
import PolymarketApi from "./PolymarketApi";
import type { MarketData } from "@/lib/polymarket/types copy";
import ClobMarketTicker, { type LastTrade } from "./ClobMarketTicker";
import CoinbasePriceTicker from "./CoinbasePriceTicker";
import { beep } from "@/lib/utils";
import localForage from "localforage";

const TRADE_STORE = localForage.createInstance({
	name: 'polymarket',
	storeName: 'polymarket-trades'
})

type State = 'pending' | 'open' | 'active' | 'completed' | 'closed' | 'cancelled'
type Trade = {
	slug: string
	id: number
	price: number
	quantity: number
	basePrice: number
	limit: number
	openPrice: number
	outcome: 'up' | 'down'
	_setTickerPrice?: (timestamp: number, price: number) => void
	_setMarketPrice?: (timestamp: number, price: number) => void
	_setState?: (state: State) => void
	trades: {type: 'open' | 'close', outcome: 'up' | 'down', price: number, timestamp: number}[]
	state: State
	createdAt: number
}

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
		},
		trades: [] as Trade[]
	})

	useEffect(() => {
		// onExpired()		//initialize the market
		onInit()
	}, [])


	// ---------------------------------------------------------------------------- onInit
	const onInit = async () => {
		console.log('----------------------onInit:')
		// await onExpired()
		const timestamp = getUTCTimestamp(Date.now() + 10000, 15, 0)	//find next 15-minute timestamp
		setup.current.baseTimestamp = timestamp * 1000
		setup.current.nextTimestamp = (timestamp + 15 * 60) * 1000
		const currentSlug = 'btc-updown-15m-' + timestamp.toString()

		const basePrice = await PolymarketApi.store.getItem('lastBasePrice') as {slug: string, price: number, timestamp: number} | null
		if (basePrice && basePrice.slug === currentSlug) {
			setup.current.basePrice = basePrice.price
		}else{
			console.error('basePrice not found for slug:', currentSlug)
		}

		setup.current.currentMarket = await PolymarketApi.fetchMarketBySlug(currentSlug, true) as MarketData
		setCurrentMarket(setup.current.currentMarket)
	}


	// ---------------------------------------------------------------------------- onExpired
	const onExpired = async () => {
		const basePrice = setup.current.tickerValues.coinbase.price
		console.log('----------------------onExpired! basePrice:', basePrice)
		if (!basePrice) return

		const timestamp = getUTCTimestamp(Date.now() + 10000, 15, 0)	//find next 15-minute timestamp
		setup.current.baseTimestamp = timestamp * 1000
		setup.current.nextTimestamp = (timestamp + 15 * 60) * 1000
		const currentSlug = 'btc-updown-15m-' + timestamp.toString()

		await PolymarketApi.store.setItem('lastBasePrice', {slug:currentSlug, price:basePrice, timestamp:timestamp})
		setup.current.basePrice = basePrice

		setup.current.currentMarket = await PolymarketApi.fetchMarketBySlug(currentSlug, true) as MarketData
		setCurrentMarket(setup.current.currentMarket)
	}


	// ---------------------------------------------------------------------------- onLastTradePriceUpdate
	const onLastTradePriceUpdate = (lastTrade: LastTrade) => {
		// console.log('onLastTradePriceUpdate:', lastTrade)
		const values = setup.current.tickerValues.clob[lastTrade.outcome_title]
		values.price = lastTrade.price
		values.timestamp = lastTrade.timestamp
		// console.log('tickerValues:', tickerValues.current)

		setup.current.trades.forEach((trade) => {
			if (trade.outcome === lastTrade.outcome_title) {
				trade._setMarketPrice?.(lastTrade.timestamp, lastTrade.price)
			}
		})

	}

	// ---------------------------------------------------------------------------- onCoinbasePriceUpdate
	const onCoinbasePriceUpdate = (timestamp: number, price: number) => {
		setup.current.trades.forEach((trade) => {
			trade._setTickerPrice?.(timestamp, price)
		})

		const values = setup.current.tickerValues
		values.coinbase = {timestamp: timestamp, price: price}
	}

	// ---------------------------------------------------------------------------- render
	return (
		<div className="flex flex-col gap-2 p-4 w-full">
			<h1>Trading Bot</h1>
			<MarketTimer minutes={15} onExpired={onExpired} />
			{currentMarket && (
				<>
				<div className='w-full'>
					<div>{'Base Price: ' + setup.current.basePrice.toString()}</div>
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


// ============================================================================ TradesList
const TradesList = ({market: market, setup}: {market: MarketData, setup: any}) => {
	const [currentMarket, setCurrentMarket] = useState<MarketData | null>()
	const [trades, setTrades] = useState<Trade[]>([])

	useEffect(() => {
		console.log('---TradesList init:', market)
		return () => {
			setCurrentMarket(null)
			setTrades([])
		}
	}, [])


	useEffect(() => {
		if (!market || market === currentMarket) return
		console.log('---TradesList market update:', market)
		setCurrentMarket(market)

		// close all trades
		trades.forEach((trade) => {
			if (trade.state === 'open') {
				trade._setState?.('closed')
			}
		})
		if (setup.basePrice){
			addTrade('up')
			addTrade('down')
		}
	}, [market])


	// ---------------------------------------------------------------------------- addTrade
	const addTrade = (outcome: 'up' | 'down') => {
		setTrades(trades => {
			const trade: Trade = {
				slug: market.slug,
				id: trades.length + 1,
				price: 0,
				quantity: 0,
				outcome: outcome,
				basePrice: setup.basePrice,
				limit: outcome === 'up' ? 1.001 : parseNumber(1 / 1.001),
				openPrice: outcome === 'up' ? setup.basePrice * 1.001 : setup.basePrice / 1.001,
				trades: [],
				state: 'pending',
				createdAt: Date.now()
			}
			TRADE_STORE.setItem(trade.slug + '_' + outcome, trade)
			setup.trades.push(trade)
			return [...trades, trade]
		})
	}


	return (
		<div className='flex flex-col gap-2 w-full flex-1 overflow-y-auto'>
			{trades.map((trade) => (
				<TradeItem key={trade.id} trade={trade} />
			))}
		</div>
	)
}


// ============================================================================ TradeItem
const TradeItem = ({trade}: {trade: any}) => {
	const [state, _setState] = useState<string>(trade.state)
	const [tickerPrice, _setTickerPrice] = useState<number>(0)
	const [marketPrice, _setMarketPrice] = useState<number>(0)

	useEffect(() => {
		if (trade.state === 'pending') setState('open')
		return () => {
			delete trade._setTickerPrice
			delete trade._setMarketPrice
		}
	}, [])


	// ---------------------------------------------------------------------------- setTickerPrice
	const setTickerPrice = (timestamp: number, price: number) => {
		if (trade.state === 'open'){
			_setTickerPrice(price)
			if (trade.outcome === 'up'){
				if (price >= trade.openPrice && marketPrice >= 0.6){
					trade.trades.push({type:'open', outcome:trade.outcome, price:marketPrice, timestamp:timestamp})
					setState('active')
					beep()
				}
			}else{
				if (price <= trade.openPrice && marketPrice <= 0.8){
					trade.trades.push({type:'open', outcome:trade.outcome, price:marketPrice, timestamp:timestamp})
					setState('active')
					beep()
				}
			}
		}
	}


	// ---------------------------------------------------------------------------- setMarketPrice
	const setMarketPrice = (timestamp: number, price: number) => {
		_setMarketPrice(price)
		if (trade.state === 'active'){
			// check if trade is completed
		}
	}


	// ---------------------------------------------------------------------------- setState
	const setState = (state: State) => {
		switch (state) {
			case 'pending':		//markets are not open yet
				break
			case 'open':		//markets are open
				trade._setTickerPrice = setTickerPrice
				trade._setMarketPrice = setMarketPrice
				trade._setState = setState
				break
			case 'active':		//market trade is active

				break
			case 'completed':	//market trade is completed
				break
			case 'closed':		//market is closed
				delete trade._setTickerPrice
				delete trade._setMarketPrice
				break
		}
		trade.state = state
		_setState(state)
	}

	return (
		<div className="grid grid-cols-5 gap-2 w-full p-2 bg-gray-100 dark:bg-gray-900 rounded-md text-xs">
			<div>{trade.slug}</div>
			<div>{trade.outcome}</div>
			<div>{state}</div>
			<div>{trade.limit.toFixed(6)}</div>
			<div>{trade.openPrice}</div>
			<div>{trade.basePrice}</div>
			<div>{tickerPrice}</div>
			<div>{marketPrice}</div>
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


// ------------------------------------------------------------------------ parseNumber
// const parseNumber = (num: number, float: number | null = null) => {
// 	if (float) num = parseFloat(num.toFixed(float))
// 	return parseFloat(num.toPrecision(12))
// }
const parseNumber = (num: number) => {
	return parseFloat(num.toFixed(12))
}
