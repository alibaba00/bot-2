import { use, useEffect, useMemo, useRef, useState } from "react";
import PolymarketApi from "./PolymarketApi";
import type { MarketData } from "@/lib/polymarket/types copy";
import ClobMarketTicker, { type LastTrade } from "./ClobMarketTicker";
import CoinbasePriceTicker from "./CoinbasePriceTicker";
import { beep } from "@/lib/utils";
import localForage from "localforage";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const TRADE_STORE = localForage.createInstance({
	name: 'polymarket',
	storeName: 'polymarket-trades'
})

type State = 'pending' | 'open' | 'active' | 'completed' | 'closed' | 'cancelled'
type Trade = {
	slug: string
	basePrice: number
	up: {
		price: number
		limit: number
		openPrice: number
		trades: {type: 'open' | 'close', outcome: 'up' | 'down', price: number, timestamp: number}[]
		state: 'pending' | 'active' | 'completed'
	}
	down: {
		price: number
		limit: number
		openPrice: number
		trades: {type: 'open' | 'close', outcome: 'up' | 'down', price: number, timestamp: number}[]
		state: 'pending' | 'active' | 'completed'
	}
	state: State
	createdAt: number
	isLive: boolean
	_setTickerPrice?: (timestamp: number, price: number) => void
	_setMarketPrice?: (timestamp: number, outcome: 'up' | 'down', price: number) => void
	_setState?: (state: State) => void
}


// ============================================================================ TradingBotPage
export default function TradingBotPage() {
	const [currentMarket, setCurrentMarket] = useState<MarketData | null>(null)
	const [liveTrading, setLiveTrading] = useState<boolean>(false)

	const setup = useRef({
		liveTrading: false as boolean,
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
		trade: null as Trade | null,		//current trade
	})


	// ---------------------------------------------------------------------------- initialize on mount
	useEffect(() => {
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
		const sc = setup.current

		// use coinbase price if it is less than 1 minutes old or 0 if it is older
		const basePrice = sc.tickerValues.coinbase.timestamp > Date.now() - 1 * 60 * 1000 ?
			sc.tickerValues.coinbase.price : 0

		console.log('----------------------onExpired! basePrice:', basePrice)

		const timestamp = getUTCTimestamp(Date.now() + 10000, 15, 0)	//find next 15-minute timestamp
		sc.baseTimestamp = timestamp * 1000
		sc.nextTimestamp = (timestamp + 15 * 60) * 1000
		const currentSlug = 'btc-updown-15m-' + timestamp.toString()

		sc.basePrice = basePrice
		await PolymarketApi.store.setItem('lastBasePrice', {slug:currentSlug, price:basePrice, timestamp:timestamp})

		if (!basePrice){
			sc.currentMarket = null
			setCurrentMarket(null)
		}else{
			sc.currentMarket = await PolymarketApi.fetchMarketBySlug(currentSlug, true) as MarketData
			setCurrentMarket(sc.currentMarket)
		}
	}


	// ---------------------------------------------------------------------------- onMarketPriceUpdate
	const onMarketPriceUpdate = (lastTrade: LastTrade) => {
		const values = setup.current.tickerValues.clob[lastTrade.outcome_title]
		values.price = lastTrade.price
		values.timestamp = lastTrade.timestamp

		const trade = setup.current.trade
		if (!trade) return

		trade._setMarketPrice?.(lastTrade.timestamp, lastTrade.outcome_title as 'up' | 'down', lastTrade.price)
		// trade[lastTrade.outcome_title].price = lastTrade.price
	}


	// ---------------------------------------------------------------------------- onCoinbasePriceUpdate
	const onCoinbasePriceUpdate = (timestamp: number, price: number) => {
		setup.current.trade?._setTickerPrice?.(timestamp, price)

		const values = setup.current.tickerValues
		values.coinbase = {timestamp: timestamp, price: price}
	}


	// ---------------------------------------------------------------------------- render
	return (
		<div className="flex flex-col gap-2 p-4 w-full">
			<div className="flex flex-row justify-between items-center w-full">
				<h1 onClick={() => console.log('setup:', setup.current)}>Trading Bot</h1>

				<div className="flex flex-row items-center gap-2">
					<Label className="text-sm font-medium select-none ml-0">Live Trading</Label>
					<Switch checked={liveTrading} onCheckedChange={(checked) => {
						setup.current.liveTrading = checked
						setup.current.trade && (setup.current.trade.isLive = checked)
						setLiveTrading(checked)
					}}	 />
				</div>

				{/* <div className="flex flex-row items-center gap-2 ml-auto">
					<span className="text-sm font-medium select-none">Live Trading</span>
					<label className="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							className="sr-only peer"
							checked={liveTrading || false}
							onChange={e => {
								const checked = e.target.checked;
								setLiveTrading(checked);
							}}
						/>
						<div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-green-500 transition-colors duration-200"></div>
						<div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 peer-checked:translate-x-5"></div>
					</label>
				</div> */}
			</div>
			<MarketTimer minutes={15} onExpired={onExpired} />
			{currentMarket && (
				<>
				<div className='w-full'>
					<div>{'Base Price: ' + setup.current.basePrice.toString()}</div>
				</div>
				<div className='flex flex-row gap-2 flex-wrap w-full'>
					<ClobMarketTicker market={currentMarket} onUpdate={onMarketPriceUpdate} />
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
	const [isLoaded, setIsLoaded] = useState<boolean>(false)


	useEffect(() => {
		console.log('---TradesList init:')

		loadTrades().then((trades) => {
			trades.forEach((trade) => {
				if (trade.slug === market.slug) {
					trade.state = 'pending'
					setup.trade = trade
				}else{
					if (trade.state !== 'closed') {
						trade.state = 'closed'
						saveTrade(trade)
					}
				}
			})
			if (setup.basePrice && !setup.trade){
				const trade = createTrade()
				setup.trade = trade
				trades = [trade, ...trades]
			}
			setTrades(trades)
			setIsLoaded(true)
		})

		return () => {
			setCurrentMarket(null)
			setTrades([])
			setup.trade = null
		}
	}, [])


	useEffect(() => {
		if (!market || market === currentMarket) return
		console.log('---TradesList market update:', market, setup.trade, setup.basePrice)
		setCurrentMarket(market)

		if (!isLoaded) return

		if (setup.trade && setup.trade.slug !== market.slug) {
			setup.trade._setState?.('closed')
			setup.trade = null
		}
		if (setup.basePrice && (!setup.trade || setup.trade.slug !== market.slug)){
			const trade = createTrade()
			setup.trade = trade
			setTrades(trades => [trade, ...trades])
		}
	}, [market])


	// ---------------------------------------------------------------------------- createTrade
	const createTrade = (): Trade => {
		console.log('---TradesList createTrade:', market)
		const trade: Trade = {
			slug: market.slug,
			basePrice: setup.basePrice,
			up: {
				price: 0,
				limit: 1.001,
				openPrice: setup.basePrice * 1.001,
				trades: [],
				state: 'pending',
			},
			down: {
				price: 0,
				limit: 1 / 1.001,
				openPrice: setup.basePrice / 1.001,
				trades: [],
				state: 'pending',
			},
			state: 'pending',
			createdAt: Date.now(),
			isLive: setup.liveTrading
		}
		return trade
	}


	return (
		<div className='flex flex-col gap-2 w-full flex-1 overflow-y-auto'>
			{trades.map((trade) => (
				<TradeItem key={trade.slug} trade={trade} />
			))}
		</div>
	)
}


// ============================================================================ TradeItem
const TradeItem = ({trade}: {trade: Trade}) => {
	const [state, _setState] = useState<string>(trade.state)
	const [tickerPrice, _setTickerPrice] = useState<number>(0)

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
			if (trade.up.state === 'pending' && price >= trade.up.openPrice && trade.up.price >= 0.6){
				trade.up.trades.push({type:'open', outcome:'up', price:trade.up.price, timestamp:timestamp})
				trade.up.state = 'active'
				saveTrade(trade)
				beep()
			}
			if (trade.down.state === 'pending' && price <= trade.down.openPrice && trade.down.price <= 0.8){	
				trade.down.trades.push({type:'open', outcome:'down', price:trade.down.price, timestamp:timestamp})
				trade.down.state = 'active'
				saveTrade(trade)
				beep()
			}
		}
	}


	// ---------------------------------------------------------------------------- setMarketPrice
	const setMarketPrice = (timestamp: number, outcome: 'up' | 'down', price: number) => {
		if (outcome === 'up'){
			trade.up.price = price
			// trade.up.trades.push({type:'close', outcome:'up', price:marketPrice, timestamp:timestamp})
			// setState('completed')
		}else if (outcome === 'down'){
			trade.down.price = price
			// trade.down.trades.push({type:'close', outcome:'down', price:marketPrice, timestamp:timestamp})
			// setState('completed')
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
				saveTrade(trade)
				break
			case 'closed':		//market is closed
				delete trade._setTickerPrice
				delete trade._setMarketPrice
				delete trade._setState
				saveTrade(trade)
				break
		}
		trade.state = state
		_setState(state)
	}

	return (
		<div className={`grid grid-cols-5 gap-2 w-full p-2 bg-gray-100 dark:bg-gray-900 rounded-md text-xs border-l-4`}
			style={{borderLeftColor: state === 'completed' ? 'green'
				: state === 'closed' ? 'red'
				: state === 'active' ? 'yellow'
				: state === 'open' ? 'orange'
				: state === 'pending' ? 'gray'
				: 'black'}}
			onClick={() => {
				console.log('TradeItem:', trade)
			}}
			>
			<div>{trade.slug}</div>
			<div>{state}</div>
			<div>{trade.basePrice}</div>
			<div>{tickerPrice}</div>
			<div></div>
			<div>UP</div>
			<div>{trade.up.state}</div>
			<div>{trade.up.limit.toFixed(6)}</div>
			<div>{trade.up.openPrice}</div>
			<div>{trade.up.price}</div>
			<div>DOWN</div>
			<div>{trade.down.state}</div>
			<div>{trade.down.limit.toFixed(6)}</div>
			<div>{trade.down.openPrice}</div>
			<div>{trade.down.price}</div>
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


// ---------------------------------------------------------------------------- saveTrade
const saveTrade = (trade: Trade) => {
	if (!trade?.slug) return

	trade = {...trade}
	delete trade._setTickerPrice
	delete trade._setMarketPrice
	delete trade._setState

	TRADE_STORE.setItem(trade.slug, trade)
}


// ---------------------------------------------------------------------------- loadTrades
const loadTrades = async () => {
	let trades: Trade[] = []
	const keys = await TRADE_STORE.keys()
	for (const key of keys) {	
		const trade = await TRADE_STORE.getItem(key)
		if (trade) trades.push(trade as Trade)
	}
	return trades.sort((a, b) => b.createdAt - a.createdAt)
}
