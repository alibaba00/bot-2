import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MarketData } from "@/lib/polymarket/types";
import { beep } from "@/lib/utils";
import localForage from "localforage";
import { useEffect, useRef, useState } from "react";
import ClobMarketTicker, { type LastTrade } from "./ClobMarketTicker";
import CoinbasePriceTicker from "./CoinbasePriceTicker";
import PolymarketApi from "./PolymarketApi";
import { fetchMarketBySlugFromGamma } from "@/lib/polymarket/markets";
import { Button } from "@/components/ui/button";
import { getOpenOrders, placeOrder, cancelOrder } from "@/lib/polymarket/orders";
import type { PlaceOrderParams } from "@/lib/polymarket/types";

const TRADE_STORE = localForage.createInstance({
	name: 'polymarket',
	storeName: 'polymarket-trades'
})

type State = 'pending' | 'open' | 'active' | 'completed' | 'closed' | 'cancelled'

type TradeAction = {
	type: 'BUY' | 'SELL',
	outcome: 'up' | 'down',
	price: number,
	timestamp: number,
	size: number,
	orderData?: PlaceOrderParams,
	orderId?: string
}

type TradeSide = {
	outcome: 'up' | 'down'
	tokenId: string
	price: number
	limit: number
	openPrice: number
	trades: TradeAction[]
	state: 'pending' | 'active' | 'completed' | 'cancelled'
	enabled: boolean
}

type Trade = {
	slug: string
	conditionId: string
	basePrice: number
	up: TradeSide
	down: TradeSide
	state: State
	// orderData?: PlaceOrderParams,
	// orderId?: string,
	outcome?: 'up' | 'down' | null		//finished outcome
	createdAt: number
	isLive: boolean
}


// ============================================================================ TradingBotPage
export default function TradingBotPage() {
	const [currentMarket, setCurrentMarket] = useState<MarketData | null>(null)
	const [liveTrading, setLiveTrading] = useState<boolean>(false)

	const setup = useRef({
		symbol: 'sol',
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
		_updateTrade: null as ((type: string, value: any) => void) | null,
	})


	// ---------------------------------------------------------------------------- initialize on mount
	useEffect(() => {
		onInit()		
	}, [])


	// ---------------------------------------------------------------------------- onInit
	const onInit = async () => {
		console.log('----------------------onInit:')
		const sc = setup.current

		// await onExpired()
		const timestamp = getUTCTimestamp(Date.now() + 10000, 15, 0)	//find next 15-minute timestamp
		sc.baseTimestamp = timestamp * 1000
		sc.nextTimestamp = (timestamp + 15 * 60) * 1000
		const currentSlug = sc.symbol + '-updown-15m-' + timestamp.toString()

		const basePrice = await PolymarketApi.store.getItem('lastBasePrice') as {slug: string, price: number, timestamp: number} | null
		if (basePrice && basePrice.slug === currentSlug) {
			sc.basePrice = basePrice.price
		}else{
			console.error('basePrice not found for slug:', currentSlug)
		}

		const market = await fetchMarketBySlugFromGamma(currentSlug) as MarketData | null
		sc.currentMarket = market
		setCurrentMarket(market)
	}


	// ---------------------------------------------------------------------------- onExpired
	const onExpired = async () => {
		const sc = setup.current

		// use coinbase price if it is less than 1 minutes old or 0 if it is older
		const basePrice = sc.tickerValues.coinbase.timestamp > Date.now() - 1 * 60 * 1000 ?
			sc.tickerValues.coinbase.price : 0

		console.log('----------------------onExpired! new basePrice:', basePrice)
		beep(10, 500)

		const timestamp = getUTCTimestamp(Date.now() + 10000, 15, 0)	//find next 15-minute timestamp
		sc.baseTimestamp = timestamp * 1000
		sc.nextTimestamp = (timestamp + 15 * 60) * 1000
		const currentSlug = sc.symbol + '-updown-15m-' + timestamp.toString()

		sc.basePrice = basePrice
		await PolymarketApi.store.setItem('lastBasePrice', {slug:currentSlug, price:basePrice, timestamp:timestamp})

		const market = await fetchMarketBySlugFromGamma(currentSlug) as MarketData | null
		sc.currentMarket = market
		setCurrentMarket(market)
	}


	// ---------------------------------------------------------------------------- onMarketPriceUpdate
	const onMarketPriceUpdate = (lastTrade: LastTrade) => {
		const values = setup.current.tickerValues.clob[lastTrade.outcome_title]
		values.price = lastTrade.price
		values.timestamp = lastTrade.timestamp

		const trade = setup.current.trade
		if (!trade) return

		// trade._setMarketPrice?.(lastTrade.timestamp, lastTrade.outcome_title as 'up' | 'down', lastTrade.price)
		// trade[lastTrade.outcome_title].price = lastTrade.price
		setup.current._updateTrade?.('marketPrice',
			{timestamp: lastTrade.timestamp, outcome: lastTrade.outcome_title as 'up' | 'down', price: lastTrade.price})
	}


	// ---------------------------------------------------------------------------- onCoinbasePriceUpdate
	const onCoinbasePriceUpdate = (timestamp: number, price: number) => {
		// setup.current.trade?._setTickerPrice?.(timestamp, price)
		setup.current._updateTrade?.('tickerPrice', {timestamp: timestamp, price: price})

		const values = setup.current.tickerValues
		values.coinbase = {timestamp: timestamp, price: price}
	}


	// ---------------------------------------------------------------------------- onTest
	const onTest = () => {
		console.log('-----> onTest:')
		_getOpenOrders()
	}


	// ---------------------------------------------------------------------------- render
	return (
		<div className="flex flex-col gap-2 p-4 w-full">
			<div className="flex flex-row justify-between items-center w-full">
				<h1 onClick={() => console.log('setup:', setup.current)}>Trading Bot</h1>

				<div className="flex flex-row items-center gap-2 gap-3">
					<Button variant="outline" size="icon" onClick={() => {
							onTest()
						}}>
						Test
					</Button>
					<Label className="text-sm font-medium select-none ml-0">Live Trading</Label>
					<Switch checked={liveTrading} onCheckedChange={(checked) => {
						setup.current.liveTrading = checked
						setup.current.trade && (setup.current.trade.isLive = checked)
						setLiveTrading(checked)
					}}	 />
				</div>
			</div>
			<MarketTimer minutes={15} onExpired={onExpired} />
			{currentMarket && (
				<>
				<div className='w-full'>
					<div>{'Base Price: ' + setup.current.basePrice.toString()}</div>
				</div>
				<div className='flex flex-row gap-2 flex-wrap w-full'>
					<ClobMarketTicker market={currentMarket} onUpdate={onMarketPriceUpdate} />
					<CoinbasePriceTicker symbol={setup.current.symbol.toUpperCase() + '-USD'} onUpdate={onCoinbasePriceUpdate} />
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
					// trade.state = 'pending'
					setup.trade = trade
				}else{
					if (trade.state !== 'closed') {
						closeTrade(trade)
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
			// setup.trade._setState?.('closed')
			setup._updateTrade?.('state', 'closed')
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
			conditionId: market.conditionId,
			basePrice: setup.basePrice,
			up: {
				outcome: 'up',
				tokenId: market.outcomes.find((outcome) => outcome.title === 'Up')?.id || '',
				price: 0,
				limit: 1.001,
				openPrice: setup.basePrice * 1.001,
				trades: [],
				state: 'pending',
				enabled: false,
			},
			down: {
				outcome: 'down',
				tokenId: market.outcomes.find((outcome) => outcome.title === 'Down')?.id || '',
				price: 0,
				limit: 1 / 1.001,
				openPrice: setup.basePrice / 1.001,
				trades: [],
				state: 'pending',
				enabled: true,
			},
			state: 'pending',
			outcome: null,
			createdAt: Date.now(),
			isLive: setup.liveTrading
		}
		return trade
	}


	return (
		<div className='flex flex-col gap-2 w-full flex-1 overflow-y-auto'>
			{trades.map((trade) => (
				<TradeItem key={trade.slug} trade={trade} setup={setup} />
			))}
		</div>
	)
}


// ============================================================================ TradeItem
const TradeItem = ({trade, setup}: {trade: Trade, setup: any}) => {
	const [state, _setState] = useState<string>(trade.state)
	const [tickerPrice, _setTickerPrice] = useState<number>(0)

	useEffect(() => {
		if (trade.slug === setup.currentMarket?.slug){
			setup._updateTrade = onUpdate
		}
		if (trade.state === 'pending'){
			if (setup.currentMarket?.slug === trade.slug){
				setState('open')
			}else{
				setState('closed')
			}
		}
		return () => {
		}
	}, [])


	// ---------------------------------------------------------------------------- onUpdate
	const onUpdate = (type: string, value: any) => {
		// console.log('---TradeItem onUpdate:', type, value)
		if (type === 'tickerPrice'){
			setTickerPrice(value.timestamp, value.price)
		}else if (type === 'marketPrice'){
			setMarketPrice(value.timestamp, value.outcome, value.price)
		}else if (type === 'state'){
			setState(value)
		}
	}


	// ---------------------------------------------------------------------------- setTickerPrice
	const setTickerPrice = (timestamp: number, price: number) => {
		if (trade.state === 'open'){
			if (trade.up.enabled && trade.up.state === 'pending' && price >= trade.up.openPrice && trade.up.price <= 0.8){
				setTrade(trade, {
					type:'BUY',
					outcome:'up',
					price:trade.up.price,
					timestamp,
					size:5
				})
			}
			if (trade.down.enabled && trade.down.state === 'pending' && price <= trade.down.openPrice && trade.down.price <= 0.8){	
				setTrade(trade, {
					type		:'BUY',
					outcome		:'down',
					price		:trade.down.price,
					timestamp	:timestamp,
					size		:10
				})
			}
			_setTickerPrice(price)
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
	// from TradeList market update or createTrade
	const setState = (state: State) => {
		switch (state) {
			case 'pending':		//markets are not open yet
				break
			case 'open':		//markets are open
				setup._updateTrade = onUpdate
				saveTrade(trade)
				break
			case 'closed':		//market is closed from TradeList market update
				delete setup._updateTrade
				closeTrade(trade, setup.basePrice)
				_setTickerPrice(0)
				break
		}
		trade.state = state
		_setState(state)
	}

	return (
		<div className='relative'>
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
				<div>{state + (state === 'closed' && trade.outcome ? ' [' + trade.outcome?.toUpperCase() + ']' : '')}</div>
				<div>{trade.basePrice}</div>
				<div>{tickerPrice}</div>
				<div>{(tickerPrice / trade.basePrice).toFixed(6)}</div>
				<div style={{
					color: trade.up.state === 'active'
						? '#00f' // Tailwind blue-500 hex
						: trade.up.state === 'completed' || trade.up.state === 'cancelled'
							? '#3c3' // Tailwind green-400 hex
							: '#999' // Tailwind gray-500 hex
				}}>
					UP
				</div>
				<TradeState trade={trade} side='up' />
				<div>{trade.up.openPrice.toFixed(2) + ' (' + parseNumber(trade.up.limit) + ')'}</div>
				<div>{trade.up.trades[0]?.orderData?.quantity}</div>
				<div>{trade.up.trades[0]?.price.toFixed(2)}</div>
				<div style={{
					color: trade.down.state === 'active'
						? '#00f' // Tailwind blue-500 hex
						: trade.down.state === 'completed'
							? '#3c3' // Tailwind green-400 hex
							: '#999' // Tailwind gray-500 hex
				}}>
					DOWN
				</div>
				<TradeState trade={trade} side='down' />
				<div>{trade.down.openPrice.toFixed(2) + ' (' + parseNumber(trade.down.limit) + ')'}</div>
				<div>{trade.down.trades[0]?.orderData?.quantity}</div>
				<div>{trade.down.trades[0]?.price.toFixed(2)}</div>
			</div>
			<div className={`absolute top-0 right-0 text-xs text-gray-500 ${trade.isLive ? 'text-green-500' : 'text-red-500'}`}>{trade.isLive ? 'live' : 'not live'}</div>
		</div>
	)
}


// ---------------------------------------------------------------------------- TradeState
const TradeState = ({trade, side}: {trade: Trade, side: 'up' | 'down'}) => {
	const tradeSide = trade[side as 'up' | 'down']

	return (
		<div className='flex flex-row justify-between items-center'>
			<div>{tradeSide.state}</div>
			{trade.state === 'open' && (
				<div
					className={`rounded-full w-3 h-3 cursor-pointer ${tradeSide.enabled ? 'bg-green-600' : 'bg-red-600'}`}
				></div>
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
		timeString: minutes < 60 ? '00:00' : '00:00:00'
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
				timeString: minutes < 60 ?
					`${Math.floor((time % 3600) / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`
					: `${Math.floor(time / 3600).toString().padStart(2, '0')}:${Math.floor((time % 3600) / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`
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
const saveTrade = async (trade: Trade) => {
	if (!trade?.slug) return null
	console.log('--- saveTrade:', trade.slug)
	await TRADE_STORE.setItem(trade.slug, trade)
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


// ---------------------------------------------------------------------------- openTrade
const setTrade = async (trade: Trade, action: TradeAction) => {
	const side = action.outcome === 'up' ? trade.up : trade.down
	side.trades.push(action)
	side.state = action.type === 'BUY' ? 'active' : action.type === 'SELL' ? 'completed' : 'cancelled'

	const quantity = Math.floor(action.size / action.price)

	const orderData: PlaceOrderParams = {
		marketId: trade.conditionId,
		price: action.price,
		quantity: quantity,
		side: action.type,
		outcome: action.outcome === 'up' ? 'Up' : 'Down',
		outcomeId: action.outcome === 'up' ? trade.up.tokenId : trade.down.tokenId
	}

	action.orderData = orderData
	console.log('!!!!!!!!!!!!!!!! orderData:', trade.isLive, orderData);

	if (trade.isLive) {
		const order = await placeOrder(orderData)
		console.log('!!!!!!!!!!!!!!!! order:', order);
		action.orderId = order.orderId
	}

	saveTrade(trade)

	if (action.type === 'BUY') beep(20, 1000)
	else if (action.type === 'SELL') beep(20, 500)
	return trade
}


// ---------------------------------------------------------------------------- closeTrade
const closeTrade = (trade: Trade, newBasePrice: number = 0) => {
	console.log('--- closeTrade:', trade)
	trade.state = 'closed'
	trade.outcome = newBasePrice ? newBasePrice > trade.basePrice ? 'up' : 'down' : null

	if (trade.up.state === 'active') trade.up.state = 'completed'
	if (trade.up.state === 'pending') trade.up.state = 'cancelled'
	if (trade.down.state === 'active') trade.down.state = 'completed'
	if (trade.down.state === 'pending') trade.down.state = 'cancelled'

	trade.up.price = 0
	trade.down.price = 0
	saveTrade(trade)
}


// ---------------------------------------------------------------------------- setOrder
// outcome: 'up' | 'down'
// price: number (price per share)
// size: number (number of shares)
const setOrder = async (trade: Trade, outcome: 'up' | 'down', price: number, size: number) => {
	if (!trade?.slug) return null

	console.log('--- setOrder:', trade)
	// Market + YES token from Gamma
	const conditionId = trade.conditionId;
	const yesTokenId = outcome === 'up' ? trade.up.tokenId : trade.down.tokenId;
	// const side = Side.BUY;

	const order = await placeOrder({
		marketId: conditionId,
		price: price,
		quantity: size,
		side: 'BUY',
		outcome: outcome === 'up' ? 'Up' : 'Down',
		outcomeId: yesTokenId
	});
	console.log(order);
}


const _cancelOrder = async () => {
	const orderId = "0x9b7c28cfbec00b2fd8047a1e8ccfd4966b314e630a3a53c58b699eb5b6bc3e7a"
	console.log('--- cancelOrder:')
	const order = await cancelOrder(orderId)
	console.log(order);
}


const _getOpenOrders = async () => {
	console.log('--- getOpenOrders:')
	const orders = await getOpenOrders()
	console.log(orders);
}