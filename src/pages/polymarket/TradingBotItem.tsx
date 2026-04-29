import { cancelOrder, getOrder, placeOrder } from "@/lib/polymarket/orders";
import type { MarketData, PlaceOrderParams, PlaceOrderResponse } from "@/lib/polymarket/types";
import { beep } from "@/lib/utils";
import localForage from "localforage";
import { useEffect, useReducer, useRef, useState } from "react";
import ClobMarketTicker, { type LastTrade } from "./ClobMarketTicker";
import { getActiveMarketPositionSizes } from "@/lib/polymarket/wallet";
import { useMarketTimer } from "./TradingBot";

export const TRADE_STORE = localForage.createInstance({
	name: 'polymarket',
	storeName: 'polymarket-trades'
})

type TradeState = 'pending' | 'open' | 'closed' | 'cancelled' | 'completed'

type TradeAction = {
	type: 'BUY' | 'SELL',
	outcome: 'up' | 'down',
	price: number | null,
	timestamp: number,
	size?: number,
	orderData?: PlaceOrderParams,
	orderId?: string,
}

type TradeSide = {
	enabled: boolean
	outcome: 'up' | 'down'
	tokenId: string
	price: number

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
	market?: MarketData
	marketType: string
	slug: string
	startTimestamp: number
	endTimestamp: number
	timeFrame: number
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


	useEffect(() => {
		// console.log('---TradingBotItem init:', trade, setup)

		if (trade.slug === setup.currentMarket?.slug){
			//---connect current market to trading-bot setup
			if (trade.state === 'pending'){			//new market is pending, set to open
				// const time = Date.now() - trade.startTimestamp
				// if (time >= setup.startTimeLimit * 1000){
				// 	trade.up.enabled = false
				// 	trade.down.enabled = false
				// 	setState('cancelled')
				// }else{
				// 	setState('open')
				// }
				setState('open')
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
			// console.log('---TradeItem onUpdate time:', value)	// 300 -> 0
			// setTime(value)
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
			// setMarketPrice(value.timestamp, value.outcome, value.price)

		// }else if (type === 'tradeUpdate'){
		// 	console.log('---TradeItem onUpdate tradeUpdate:', value)

		}else if (type === 'connected'){
			trade.isConnected = value
			render()

		}else if (type === 'state'){
			// setState(value)
		}
	}

	// ---------------------------------------------------------------------------- setTickerPrice
	// const setTickerPrice = (timestamp: number, price: number) => {
	// 	// trade.tickerPrice = price
	// 	// checkTrade(trade.up)
	// 	// checkTrade(trade.down)
	// }


	// ---------------------------------------------------------------------------- setMarketPrice
	// const setMarketPrice = (lastTrade: LastTrade) => {
	// 	// console.log(trade, time)
	// 	if (trade.state === 'closed' || trade.state === 'cancelled') return

	// 	if (lastTrade.outcome_title === 'up'){
	// 		updatePrice(trade.up, lastTrade.price)
	// 	}else if (lastTrade.outcome_title === 'down'){
	// 		updatePrice(trade.down, lastTrade.price)
	// 	}
	// 	// console.log('--- setMarketPrice:', trade.up.price, trade.down.price)
	// 	render()
	// }
	const setMarketPrice = (value: any) => {
		// console.log('--- setMarketPrice:', value)
		if (trade.state === 'closed' || trade.state === 'cancelled') return

		if (value.outcome === 'up'){
			updatePrice(trade.up, value.price, value.ask, value.bid)
		}else if (value.outcome === 'down'){
			updatePrice(trade.down, value.price, value.ask, value.bid)
		}
		// console.log('--- setMarketPrice:', trade.up.price, trade.down.price)
		render()
	}


	// ---------------------------------------------------------------------------- buyTrade
	const updatePrice = (side: TradeSide, price: number, ask: number, bid: number) => {
		// side.price = price
		if (!side.enabled) return false

		if (side.state === 'pending' && ask <= 0.01){
			console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!--BUY Trade:', side.outcome, ask)
			side.state = 'active'
			setOrder(setup, trade, {
				type		:'BUY',
				outcome		:side.outcome,
				price		:0.01,
				timestamp	:Date.now(),
				size		:10,		//2 * 0.6 = 1.2
			})		//-> active
			.then(() => {
				// if (trade.isLive) checkTradeSize(trade)
			})

		}else if (side.state === 'active'){
			if (bid >= 0.9){
				side.state = 'selling'
				setOrder(setup, trade, {
					type		:'SELL',
					outcome		:side.outcome,
					price		:0.9,
					timestamp	:Date.now(),
				})		//-> active
			}
			// else if (ask <= 0.28){
			// 	side.state = 'selling'
			// 	setOrder(setup, trade, {
			// 		type		:'SELL',
			// 		outcome		:side.outcome,
			// 		price		:0.29,
			// 		timestamp	:Date.now(),
			// 	})		//-> active
			// }
		}
	}


	// // ---------------------------------------------------------------------------- checkTradeSize
	// const checkTradeSize = async (trade: Trade) => {
	// 	console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!--checkTradeSize:', trade.conditionId)
	// 	let sizes = { up: 0, down: 0 }
	// 	do {
	// 		await new Promise(resolve => setTimeout(resolve, 2000))
	// 		sizes = await getActiveMarketPositionSizes({
	// 			conditionId: trade.conditionId || '',
	// 			upTokenId: trade.up.tokenId || '',
	// 			downTokenId: trade.down.tokenId || '',
	// 		})
	// 		// console.log('sizes:', sizes)

	// 		trade.up.size = sizes.up
	// 		trade.down.size = sizes.down
	
	// 		if (sizes.up > 0 && trade.up.state === 'active') trade.up.state = 'positioned'
	// 		if (sizes.down > 0 && trade.down.state === 'active') trade.down.state = 'positioned'
	
	// 	} while (trade.state !== 'closed' && trade.state !== 'completed' && trade.state !== 'cancelled')
	
	// 	saveTrade(trade, 6)
	// 	render()
	// }


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


	// ---------------------------------------------------------------------------- onTime
	const onMarketTime = (restSeconds: number) => {
		if (trade.state === 'open') {
			if (setup.currentMarket?.endTimestamp && Date.now() + 60000 > setup.currentMarket.endTimestamp) {
				setup._createMarket?.(70000)	//create next valid market from now + 70 seconds
			}
			if (restSeconds <= -10){
				setState('closed')
			}
			if (restSeconds <= setup.openTimeLimit){
				if (trade.up.state === 'pending') trade.up.state = 'cancelled'
				if (trade.down.state === 'pending') trade.down.state = 'cancelled'
			}
		}
	}

	return (
		<div className='relative w-full p-2 bg-gray-100 dark:bg-gray-900 rounded-md text-xs border-l-4'
			style={{borderLeftColor: state === 'completed' ? 'green'
				: state === 'closed' ? 'red'
				: state === 'active' ? 'yellow'
				: state === 'open' ? 'orange'
				: state === 'pending' ? 'gray'
				: 'black'}}
			>
			{trade.market && <ClobMarketTicker
				market={trade.market}
				onUpdate={setMarketPrice}
				autoConnect={false}
				onTime={onMarketTime}
			/>}

			<div className={`grid grid-cols-4 gap-2`}	
				onClick={() => {
					console.log('TradeItem:', trade)
				}}
				>
				<div>{state + (state === 'closed' && trade.outcome ? ' [' + trade.outcome?.toUpperCase() + ']' : '')}</div>
				<div></div>
				<div>{(trade.timeFrame / 60000).toFixed(2) + ' | ' + (trade.restTime / 60000).toFixed(2)}</div>
				<div style={{
					cursor: 'pointer',
					color: trade.up.state === 'active'
						? 'orange' // Tailwind blue-500 hex
						: trade.up.state === 'completed' || trade.up.state === 'cancelled'
							? '#3c3' // Tailwind green-400 hex
							: '#999' // Tailwind gray-500 hex
				}}
				>
				</div>
				<TradeState trade={trade} side='up' />
				<div>{trade.up.state}</div>
				<div>{trade.up.size.toFixed(2)}</div>
				<div style={{
					cursor: 'pointer',
					color: trade.down.state === 'active'
						? 'orange' // Tailwind blue-500 hex
						: trade.down.state === 'completed'
							? '#3c3' // Tailwind green-400 hex
							: '#999' // Tailwind gray-500 hex
				}}
				>
				</div>
				<TradeState trade={trade} side='down' />
					<div>{trade.down.state}</div>
				<div>{trade.down.size.toFixed(2)}</div>
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
	maxRetries: number = 0, retryDelay: number = 2000) => {
	const side = action.outcome === 'up' ? trade.up : trade.down
	if (!side.enabled) return trade

	side.trades.push(action)
	// side.state = action.type === 'BUY' ? 'active' : action.type === 'SELL' ? 'completed' : 'cancelled'

	const effectivePrice =
		action.price != null
			? action.price
			: action.type === 'BUY' ? 1 : 0

	if (!action.size){
		action.size = side.size = await getOrderSize(trade, side.outcome)
		if (!action.size){
			console.error('Error getting order size:', trade.conditionId)
			return
		}
	}

	const orderData: PlaceOrderParams = {
		marketId: trade.conditionId,
		price: effectivePrice,
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

			const orderData = await getOrder(order.orderId);
			console.log('!!!!!!!!!!!!! orderData:', orderData)
		}
	}
}


// ---------------------------------------------------------------------------- getOrderSize
const getOrderSize = async (trade: Trade, side: 'up' | 'down') => {
	console.log('---getOrderSize:', trade.conditionId)
	const sizes = await getActiveMarketPositionSizes({
		conditionId: trade.conditionId || '',
		upTokenId: trade.up.tokenId || '',
		downTokenId: trade.down.tokenId || '',
	})
	console.log('sizes:', sizes)
	return sizes[side]
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
place BUY oder:

-> Trade Update (UserChannel)
status: MATCHED
or
status: LIVE (type: PLACEMENT)

-> order result:
{
    "orderId": "0x49a30330e41ea69e7ef06bc9b14227073b779f15c314a7586ba8d2649f0ecb3f",
    "status": "PENDING",
    "message": "Order placed successfully"
}

-> Trade Update (UserChannel)
price: 0.58
status: MINED

-> Trade Update (UserChannel)
status: CONFIRMED




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