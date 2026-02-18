import { placeOrder } from "@/lib/polymarket/orders";
import type { PlaceOrderParams } from "@/lib/polymarket/types";
import { beep } from "@/lib/utils";
import localForage from "localforage";
import { useEffect, useState } from "react";

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

export type Trade = {
	slug: string
	question: string
	conditionId: string
	basePrice: number
	tickerPrice: number
	up: TradeSide
	down: TradeSide
	state: State
	// orderData?: PlaceOrderParams,
	// orderId?: string,
	outcome?: 'up' | 'down' | null		//finished outcome
	createdAt: number
	isLive: boolean
}


// ============================================================================ TradingBotItem
export default function TradingBotItem({trade, setup}: {trade: Trade, setup: any}) {
	const [state, _setState] = useState<string>(trade.state)

	useEffect(() => {
		if (trade.slug === setup.currentMarket?.slug){
			setup.trade = trade
			setup._updateTrade = onUpdate
			setState('open')
			saveTrade(trade)

		}else if (trade.state !== 'closed'){
			delete setup._updateTrade
			closeTrade(trade, setup.basePrice)
			setState('closed')
		}

		return () => {
		}
	}, [])


	// ---------------------------------------------------------------------------- onUpdate
	/* marketPrice example: {
		"timestamp": 1771438735564,
		"outcome": "up",
		"price": 0.45
	} */
	const onUpdate = (type: string, value: any) => {
		// console.log('---TradeItem onUpdate:', type, value)
		if (type === 'tickerPrice'){
			setTickerPrice(value.timestamp, value.price)

		}else if (type === 'marketPrice'){
			// console.log('---TradeItem onUpdate marketPrice:', value)
			setMarketPrice(value.timestamp, value.outcome, value.price)

		}else if (type === 'state'){
			setState(value)
		}
	}


	// ---------------------------------------------------------------------------- setTickerPrice
	const setTickerPrice = (timestamp: number, price: number) => {
		trade.tickerPrice = price
		checkTrade('up', timestamp)
		checkTrade('down', timestamp)
	}


	// ---------------------------------------------------------------------------- setMarketPrice
	const setMarketPrice = (timestamp: number, outcome: 'up' | 'down', price: number) => {
		if (outcome === 'up'){
			trade.up.price = price
			checkTrade('up', timestamp)
		}else if (outcome === 'down'){
			trade.down.price = price
			checkTrade('down', timestamp)
		}
	}


	// ---------------------------------------------------------------------------- checkTrade
	const checkTrade = (side: 'up' | 'down', timestamp: number) => {
		if (trade.state !== 'open') return

		const tradeSide = trade[side as 'up' | 'down']
		if (!tradeSide.enabled) return
		if (tradeSide.state !== 'pending') return
		if (!trade.tickerPrice) return
		if (!tradeSide.price) return
		if (!tradeSide.openPrice) return
		if (side === 'up' && trade.tickerPrice < tradeSide.openPrice) return
		if (side === 'down' && trade.tickerPrice > tradeSide.openPrice) return
		if (tradeSide.price > setup[side].buyLimit) return

		setTrade(trade, {
			type		:'BUY',
			outcome		:side,
			price		:tradeSide.price + setup[side].buyOffset,
			timestamp,
			size		:setup[side].size,
		})
		setState('active')
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
				// _setTickerPrice(0)
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
				<div>{trade.question}</div>
				<div>{trade.slug}</div>
				<div>{state + (state === 'closed' && trade.outcome ? ' [' + trade.outcome?.toUpperCase() + ']' : '')}</div>
				<div>{trade.basePrice}</div>
				<div style={{
					color: trade.up.state === 'active'
						? 'orange' // Tailwind blue-500 hex
						: trade.up.state === 'completed' || trade.up.state === 'cancelled'
							? '#3c3' // Tailwind green-400 hex
							: '#999' // Tailwind gray-500 hex
				}}>
					UP
				</div>
				<TradeState trade={trade} side='up' />
				<div>{trade.up.openPrice.toFixed(2)	+ ' | +'
					+ parseNumber(trade.up.limit).toFixed(2) + '% | '
					+ setup.up.buyLimit.toFixed(2) + ' | '
					+ setup.up.size.toFixed(2)}</div>
				<div>{trade.up.trades[0]?.orderData?.quantity}</div>
				<div>{trade.up.trades[0]?.price.toFixed(2)}</div>
				<div style={{
					color: trade.down.state === 'active'
						? 'orange' // Tailwind blue-500 hex
						: trade.down.state === 'completed'
							? '#3c3' // Tailwind green-400 hex
							: '#999' // Tailwind gray-500 hex
				}}>
					DOWN
				</div>
				<TradeState trade={trade} side='down' />
				<div>{trade.down.openPrice.toFixed(2) + ' | -' +
					+ parseNumber(trade.down.limit).toFixed(2) + '% | '
					+ setup.down.buyLimit.toFixed(2) + ' | '
					+ setup.down.size.toFixed(2)}</div>
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
	const [enabled, setEnabled] = useState<boolean>(tradeSide.enabled)

	return (
		<div className='flex flex-row justify-between items-center'>
			<div>{tradeSide.state}</div>
			{trade.state === 'open' && (
				<div
					className={`rounded-full w-3 h-3 cursor-pointer ${enabled ? 'bg-green-600' : 'bg-red-600'}`}
					onClick={() => {
						setEnabled(enabled => {
							tradeSide.enabled = !enabled
							return !enabled
						})
					}}
				></div>
			)}
		</div>
	)
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


// ---------------------------------------------------------------------------- openTrade
const setTrade = async (trade: Trade, action: TradeAction) => {
	const side = action.outcome === 'up' ? trade.up : trade.down
	if (!side.enabled) return trade

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
	console.log('!!!!!!!!!!!!!!!! setTrade:', trade, trade.isLive, orderData);

	if (trade.isLive) {
		const order = await placeOrder(orderData)
		console.log('--- order:', order);
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
/*
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
*/

/*
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
*/