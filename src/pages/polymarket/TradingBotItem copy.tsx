import { cancelOrder, placeOrder } from "@/lib/polymarket/orders";
import type { PlaceOrderParams, PlaceOrderResponse } from "@/lib/polymarket/types";
import { beep } from "@/lib/utils";
import localForage from "localforage";
import { useEffect, useReducer, useState } from "react";

export const TRADE_STORE = localForage.createInstance({
	name: 'polymarket',
	storeName: 'polymarket-trades'
})

type TradeState = 'pending' | 'open' | 'closed' | 'cancelled' | 'completed'

type TradeAction = {
	type: 'BUY' | 'SELL',
	outcome: 'up' | 'down',
	price: number,
	timestamp: number,
	size: number,
	orderData?: PlaceOrderParams,
	orderId?: string,
}

type TradeSide = {
	enabled: boolean
	outcome: 'up' | 'down'
	tokenId: string
	price: number
	level: number

	orderLimit: number,		//order trigger to set buy limit
	timeLimit: number,		//buy timeout in seconds before closing market
	buyLimit: number,		//ticker price trigger limit in % of base price
	sellLimit: number,		//sell limit market price
	size: number,			//buy size in USD

	trades: TradeAction[]
	state: 'pending' | 'active' | 'buying' | 'selling' | 'positioned' | 'completed' | 'cancelled'
	buyOrder?: PlaceOrderResponse | null
	sellOrder?: PlaceOrderResponse | null
}

export type Trade = {
	symbol: string
	marketType: string
	slug: string
	startTimestamp: number
	endTimestamp: number
	timeFrame: number
	marketTime: number
	restTime: number
	question: string
	conditionId: string
	basePrice: number
	tickerPrice: number
	up: TradeSide
	down: TradeSide
	state: TradeState
	// orderData?: PlaceOrderParams,
	// orderId?: string,
	outcome?: 'up' | 'down' | null		//finished outcome
	createdAt: number
	isLive: boolean
	isConnected: boolean
	logs: any[]
}



// ============================================================================ TradingBotItem
export default function TradingBotItem({trade, setup}: {trade: Trade, setup: any}) {
	const [, render] = useReducer(x => !x, false);
	const [state, _setState] = useState<string>(trade.state)
	const [time, setTime] = useState<number>(0)

	useEffect(() => {
		// console.log('---TradingBotItem init:', trade, setup)

		if (trade.slug === setup.currentMarket?.slug){
			//---connect current market to trading-bot setup
			if (trade.state === 'pending'){			//new market is pending, set to open
				const time = Date.now() - trade.startTimestamp
				if (time >= setup.startTimeLimit * 1000){
					trade.up.enabled = false
					trade.down.enabled = false
					setState('cancelled')
				}else{
					setState('open')
				}
				saveTrade(trade, 1)
			}
		}else if (trade.state !== 'closed'){
			setState('closed')
		}

		return () => {
			delete setup._updateTrade
		}
	}, [])


	// ---------------------------------------------------------------------------- checkTradeCancel
	// const checkTradeCancel = (side: TradeSide, time: number = 0): boolean => {
	// 	if ((side.state === 'pending' || side.state === 'active') && time > 0 && time <= side.timeLimit){
	// 		cancelTradeSide(side)
	// 		return true
	// 	}
	// 	return false
	// }

	
	// ---------------------------------------------------------------------------- onUpdate
	const onUpdate = (type: string, value?: any) => {
		// console.log('---TradeItem onUpdate:', type, value)

		if (type === 'expired'){		//market is expired
			console.log('---TradeItem expired:', value)
			setState('closed')
			return

		}else if (type === 'time'){
			// console.log('---TradeItem onUpdate time:', value)
			setTime(value)
			// const changedUp = checkTradeCancel(trade.up, value)
			// const changedDown = checkTradeCancel(trade.down, value)
			// if (changedUp || changedDown){
			// 	saveTrade(trade, 2)
			// 	render()
			// 	beep(20, 300)
			// }
		}else if (type === 'log'){
			console.log('---TradeItem onUpdate log:', value)
			// trade.logs.push(value)
			// saveTrade(trade, 3)

		}else if (type === 'tickerPrice'){
			// setTickerPrice(value.timestamp, value.price)

		}else if (type === 'marketPrice'){
			// console.log('---TradeItem onUpdate marketPrice:', value)
			setMarketPrice(value.timestamp, value.outcome, value.price)

		// }else if (type === 'tradeUpdate'){
		// 	console.log('---TradeItem onUpdate tradeUpdate:', value)

		}else if (type === 'orderUpdate'){
			orderUpdate(value)

		}else if (type === 'connected'){
			trade.isConnected = value
			render()

		}else if (type === 'state'){
			// setState(value)
		}
	}


	// ---------------------------------------------------------------------------- orderUpdate
	const orderUpdate = (order: any) => {
		console.log('---orderUpdate:', order.type, order)
		const side = trade[order.outcome.toLowerCase() as 'up' | 'down']
		if (!side) return

		if (order.type === 'CANCELLATION'){
			if (side.state === 'active'){
				cancelTradeSide(side)
				saveTrade(trade, 4)
				render()
			}
		}else if (order.type === 'PLACEMENT'){
			///

		}else if (order.type === 'UPDATE'){
			if (side.state === 'active'){
				/// check here if order side = SELL !!!
				if (order.side === 'SELL'){
					side.state = 'selling'			//selling has started
					/// cancel all buy orders
					console.log('!!!!!!!!!!!!!!!!!!!!!!!! SELL order:', side.buyOrder?.orderId)
					if (side.buyOrder?.orderId) cancelOrder(side.buyOrder.orderId)

				}else if (order.side === 'BUY'){
					side.state = 'buying'			//buying has started
					if (side.level === 0){
						if (side.outcome === 'up'){		//disable the other side
							trade.down.enabled = false
							trade.down.state = 'cancelled'
							if (trade.down.buyOrder?.orderId) cancelOrder(trade.down.buyOrder.orderId)
						}else if (side.outcome === 'down'){
							trade.up.enabled = false
							trade.up.state = 'cancelled'
							if (trade.up.buyOrder?.orderId) cancelOrder(trade.up.buyOrder.orderId)
						}
					}else{
						// cancel last sell order
						if (side.sellOrder?.orderId) cancelOrder(side.sellOrder.orderId)
					}
					side.level ++
				}
				saveTrade(trade, 5)
				render()
			}
			if (side.state === 'buying'){
				const sizeMatched = parseFloat(order.size_matched || '0')
				const originalSize = parseFloat(order.original_size || '0')
				const isFullyFilled = sizeMatched >= (originalSize * 0.99) && originalSize > 0	//99% of original size

				const sellSize = parseNumber(Math.floor(sizeMatched * 100) / 100)
				console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!--isFullyFilled:', isFullyFilled, sellSize)

				if (!isFullyFilled) return

				side.size += sizeMatched

				console.log('!!!!!!!!!NEW SIZE TO SELL:', side.size)

				// Make a request here to get the whole position size (i.e., open orders/positions for this outcome)
				// Assuming you have a function `getOpenOrders` that gets all open orders.
				// (async () => {
				// 	try {
				// 		const openOrders = await getOpenOrders()
				// 		// Filter for the current market and outcome, summing the open/buy positions
				// 		const positionSize = openOrders
				// 			.filter(o =>
				// 				(o.market_slug === trade.market && o.side === 'BUY' && o.outcome_id === side.outcomeId)
				// 			)
				// 			.reduce((sum, o) => sum + (parseFloat(o.remaining_size || o.size || '0')), 0)
				// 		console.log('Total position size for', side.outcome, ':', positionSize)
				// 		// You may want to update state, e.g. side.size = positionSize, or otherwise process this info
				// 	} catch (error) {
				// 		console.error('Error fetching full position size:', error)
				// 	}
				// })()
				
				checkTrade(side)
			}
			if (side.state === 'selling'){
				const sizeMatched = parseFloat(order.size_matched || '0')
				const originalSize = parseFloat(order.original_size || '0')
				const isFullyFilled = sizeMatched >= (originalSize * 0.99) && originalSize > 0	//99% of original size

				const sellSize = parseNumber(Math.floor(sizeMatched * 100) / 100)
				console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!--isFullyFilled:', isFullyFilled, sellSize)

				if (isFullyFilled){
					beep(20, 1500)
					console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!--SELL fully filled:', side.sellOrder?.orderId)
					side.state = 'completed'
					setState('completed')
				}
			}
		}
	}


	// ---------------------------------------------------------------------------- setTickerPrice
	// const setTickerPrice = (timestamp: number, price: number) => {
	// 	// trade.tickerPrice = price
	// 	// checkTrade(trade.up)
	// 	// checkTrade(trade.down)
	// }


	// ---------------------------------------------------------------------------- setMarketPrice
	const setMarketPrice = (timestamp: number, outcome: 'up' | 'down', price: number) => {
		// console.log(trade, time)
		if (trade.state === 'closed' || trade.state === 'cancelled') return

		if (outcome === 'up'){
			trade.up.price = price
			checkTrade(trade.up)
		}else if (outcome === 'down'){
			trade.down.price = price
			checkTrade(trade.down)
		}
		// console.log('--- setMarketPrice:', trade.up.price, trade.down.price)
		render()
	}


	// ---------------------------------------------------------------------------- checkTrade
	const checkTrade = (side: TradeSide) => {
		if (!side.enabled) return false

		switch (side.level){
			case 0:
				if (side.state === 'pending' && trade.isConnected && side.price > 0.41){
					side.state = 'active'
					setOrder(setup, trade, {
						type		:'BUY',
						outcome		:side.outcome,
						price		:0.41,
						timestamp	:Date.now(),
						size		:5 * setup.sizeFactor,
					})		//-> active
				}
				break
			case 1:
				if (side.state === 'buying'){
					side.state = 'active'
					setOrder(setup, trade, {
						type		:'BUY',
						outcome		:side.outcome,
						price		:0.31,
						timestamp	:Date.now(),
						size		:5 * setup.sizeFactor,
					})		//-> active
					setOrder(setup, trade, {
						type		:'SELL',
						outcome		:side.outcome,
						price		:0.49,
						timestamp	:Date.now(),
						size		:side.size,
					})		//-> active
				}
				break
			case 2:
				if (side.state === 'buying'){
					side.state = 'active'
					setOrder(setup, trade, {
						type		:'BUY',
						outcome		:side.outcome,
						price		:0.21,
						timestamp	:Date.now(),
						size		:10 * setup.sizeFactor,
					})		//-> active
					setOrder(setup, trade, {
						type		:'SELL',
						outcome		:side.outcome,
						price		:0.39,
						timestamp	:Date.now(),
						size		:side.size,
					})		//-> active
				}
				break
			case 3:
				if (side.state === 'buying'){
					side.state = 'active'
					setOrder(setup, trade, {
						type		:'BUY',
						outcome		:side.outcome,
						price		:0.11,
						timestamp	:Date.now(),
						size		:20 * setup.sizeFactor,
					})		//-> active
					setOrder(setup, trade, {
						type		:'SELL',
						outcome		:side.outcome,
						price		:0.29,
						timestamp	:Date.now(),
						size		:side.size,
					})		//-> active
				}
				break
			case 4:
				if (side.state === 'buying'){
					side.state = 'active'
					setOrder(setup, trade, {
						type		:'BUY',
						outcome		:side.outcome,
						price		:0.021,
						timestamp	:Date.now(),
						size		:50 * setup.sizeFactor,
					})		//-> active
					setOrder(setup, trade, {
						type		:'SELL',
						outcome		:side.outcome,
						price		:0.19,
						timestamp	:Date.now(),
						size		:side.size,
					})		//-> active
				}
				break;
			case 5:
				break;
			default:
				return
		}

		// console.log(side.state)
		// if (side.state == 'pending' && trade.isConnected && side.price <= side.orderLimit){
		// 	setTrade(setup, trade, {
		// 		type		:'BUY',
		// 		outcome		:side.outcome,
		// 		price		:side.buyLimit,
		// 		timestamp	:Date.now(),
		// 		size		:side.size,
		// 	})		//-> active
		// }
	}


	// ---------------------------------------------------------------------------- setState
	// from TradeList market update or createTrade
	const setState = (state: TradeState) => {
		switch (state) {
			case 'pending':		//markets are not open yet
				break
			case 'open':		//markets are open
				setup.trade = trade
				setup._updateTrade = onUpdate
				break
			case 'closed':		//market is closed from TradeList market update
				delete setup._updateTrade
				if (setup.trade === trade) setup.trade = null
				closeTrade(trade)
				// _setTickerPrice(0)
				break
			case 'cancelled':		//market is cancelled from TradeList market update
				delete setup._updateTrade
				if (setup.trade === trade) setup.trade = null
				// cancelTrade(trade)
				break
			case 'completed':		//market is completed
				delete setup._updateTrade
				if (setup.trade === trade) setup.trade = null
				closeTrade(trade)
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
				<div>{trade.isConnected ? 'connected' : 'disconnected'}</div>
				<div>{(trade.marketTime / 60000).toFixed(2) + ' | ' + (trade.restTime / 60000).toFixed(2)}</div>
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
				<div>{trade.up.level}</div>
				<div>{trade.up.price.toFixed(2)}</div>
				<div>{time.toFixed(2)}</div>
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
					<div>{trade.down.level}</div>
				<div>{trade.down.price.toFixed(2)}</div>
				<div></div>
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
const saveTrade = async (trade: Trade, id: number = 1) => {
	if (!trade?.slug) return null
	console.log('--- saveTrade:', id, trade.slug)
	await TRADE_STORE.setItem(trade.slug, trade)
}


// ---------------------------------------------------------------------------- openTrade
// buy | sell
const setOrder = async (setup: any, trade: Trade, action: TradeAction,
	maxRetries: number = 10, retryDelay: number = 2000) => {
	const side = action.outcome === 'up' ? trade.up : trade.down
	if (!side.enabled) return trade

	side.trades.push(action)

	// side.state = action.type === 'BUY' ? 'active' : action.type === 'SELL' ? 'completed' : 'cancelled'

	const orderData: PlaceOrderParams = {
		marketId: trade.conditionId,
		price: action.price,
		quantity: action.size,
		side: action.type,
		outcome: action.outcome === 'up' ? 'Up' : 'Down',
		outcomeId: action.outcome === 'up' ? trade.up.tokenId : trade.down.tokenId
	}

	action.orderData = orderData
	console.log('!!!!!!!!!!!!!!!! set order:', trade, trade.isLive, orderData);
	
	if (setup._log) setup._log('> set order: ' + action.type, orderData)	//-> onUpdate log

	if (trade.isLive) {
		let order: PlaceOrderResponse | null = null
		let retry = 0
		while (retry <= maxRetries) {
			try {
				order = await placeOrder(orderData)
				break
			} catch (error) {
				console.error('Error placing order:', error)
				if (retry >= maxRetries) {
					console.error('Max retries reached:', error)
					side.state = 'cancelled'
					beep(20, 1000)
					saveTrade(trade, 7)
					return trade
				}
				retry++
				await new Promise(resolve => setTimeout(resolve, retryDelay))
			}
		}
		if (order) {
			console.log('--- order:', order);
			action.orderId = order.orderId
			// side.orderId = order.orderId || ''

			if (action.type === 'BUY'){
				side.buyOrder = order

			}else if (action.type === 'SELL'){
				side.sellOrder = order
			}

			setup._log('< set order result:', order)
		}
	}

	saveTrade(trade, 8)

	if (action.type === 'BUY') beep(20, 1000)
	else if (action.type === 'SELL') beep(20, 500)
	return trade
}


// ---------------------------------------------------------------------------- cancelTrade
// TODO! try till cancelled
//
const cancelTradeSide = async (side: TradeSide) => {
	if ((side.state === 'pending' || side.state === 'active')){
		side.state = 'cancelled'
		if (side.buyOrder?.orderId) await cancelOrder(side.buyOrder.orderId)
		if (side.sellOrder?.orderId) await cancelOrder(side.sellOrder.orderId)
	}
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
	saveTrade(trade, 9)
}


/*
---set trade order data:
{
    "marketId": "0x183f74553e351c37c766cc67eba59b4c15134b42dfb89eb1faa390c8f754097f",
    "price": 0.1,
    "quantity": 10,
    "side": "BUY",
    "outcome": "Down",
    "outcomeId": "28080882265774312658727310358320379811945669903442421488324987253068169424193"
}
---set trade order result:
{
    "orderId": "0xc560fb8e5c25571a07f416cb14051a24df0a3d7f3d16330abb68f4c8c8fa1eb2",
    "status": "PENDING",
    "message": "Order placed successfully"
}

---order update:
1. order places
{
    "type": "orderUpdate",
    "value": {
        "id": "0xc560fb8e5c25571a07f416cb14051a24df0a3d7f3d16330abb68f4c8c8fa1eb2",
        "owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
        "market": "0x183f74553e351c37c766cc67eba59b4c15134b42dfb89eb1faa390c8f754097f",
        "asset_id": "28080882265774312658727310358320379811945669903442421488324987253068169424193",
        "side": "BUY",
        "order_owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
        "original_size": "10",
        "size_matched": "0",
        "price": "0.1",
        "associate_trades": [],
        "outcome": "Down",
        "type": "PLACEMENT",
        "created_at": "1771681753",
        "expiration": "0",
        "order_type": "GTC",
        "status": "LIVE",
        "maker_address": "0xC41997C65144683AB62051EDd1f80B034756E588",
        "timestamp": "1771681753498",
        "event_type": "order"
    }
}
{
    "type": "orderUpdate",
    "value": {
        "id": "0xc560fb8e5c25571a07f416cb14051a24df0a3d7f3d16330abb68f4c8c8fa1eb2",
        "owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
        "market": "0x183f74553e351c37c766cc67eba59b4c15134b42dfb89eb1faa390c8f754097f",
        "asset_id": "28080882265774312658727310358320379811945669903442421488324987253068169424193",
        "side": "BUY",
        "order_owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
        "original_size": "10",
        "size_matched": "0",
        "price": "0.1",
        "associate_trades": [],
        "outcome": "Down",
        "type": "PLACEMENT",
        "created_at": "1771681753",
        "expiration": "0",
        "order_type": "GTC",
        "status": "LIVE",
        "maker_address": "0xC41997C65144683AB62051EDd1f80B034756E588",
        "timestamp": "1771681753498",
        "event_type": "order"
    }
}
*/


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