import { getOrder, placeOrder, cancelOrder } from "@/lib/polymarket/orders";
import type { MarketData, PlaceOrderParams, PlaceOrderResponse } from "@/lib/polymarket/types";
import { beep } from "@/lib/utils";
import localForage from "localforage";
import { useEffect, useReducer, useState } from "react";
import ClobMarketTicker from "./ClobMarketTicker";
import { getActiveMarketPositionSizes } from "@/lib/polymarket/wallet";

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
	tokenId: string			//asset id
	price: number

	orderLimit: number,		//order trigger to set buy limit
	timeLimit: number,		//buy timeout in seconds before closing market
	buyLimit: number,		//ticker price trigger limit in % of base price
	sellLimit: number,		//sell limit market price
	size: number,			//buy size in USD
	orderSize: number,		//order size in shares
	positionSize: number,	//position size in shares

	trades: TradeAction[],
	eventLog: any[],
	state: 'pending' | 'active' | 'buying' | 'selling' | 'positioned' | 'completed' | 'cancelled'
	buyOrder?: PlaceOrderResponse | null
	sellOrder?: PlaceOrderResponse | null
}

// for TradingBot.ts createTrade
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
	orders: {}		//order lookup by orderId
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


	// ---------------------------------------------------------------------------- setMarketPrice
	const setMarketPrice = (value: any) => {
		// console.log('--- setMarketPrice:', value)
		if (trade.state === 'closed' || trade.state === 'cancelled') return

		if (value.outcome === 'up'){
			// updatePrice(trade.up, value.price, value.ask, value.bid)
		}else if (value.outcome === 'down'){
			// updatePrice(trade.down, value.price, value.ask, value.bid)
		}
		// console.log('--- setMarketPrice:', trade.up.price, trade.down.price)
		render()
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
				cancelOpenBuyOrders(trade)
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


	// ---------------------------------------------------------------------------- onUpdate
	const onUpdate = (type: string, value?: any) => {
		console.log('---TradeItem onUpdate:', type, value)
		if (type === 'expired'){		//market is expired
			console.log('---TradeItem expired:', value)
			setState('closed')
			return

		}else if (type === 'connected'){
			trade.isConnected = value
			render()
			
		}else if (type === 'orderUpdate'){
			orderUpdate(value)

		// }else if (type === 'tradeUpdate'){
		// 	tradeUpdate(value)
		}
	}
	

	// ---------------------------------------------------------------------------- orderUpdate
/* example order update:
{
    "id": "0xba3c15de8c86feea63e43485059cfe7537cd512d730c10bc4836743f1885b294",
    "owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
    "market": "0xf91cac18426735921d224fc08e41159ddeca076c9ff82ea3fbbb0e8a3e157037",
    "asset_id": "80237582226519275624474863496229885237878232853867079564332905601361584833421",
    "side": "BUY",
    "order_owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
    "original_size": "5",
    "size_matched": "0",
    "price": "0.35",
    "associate_trades": [],
    "outcome": "Down",
    "type": "PLACEMENT",
    "created_at": "1790159090",
    "expiration": "0",
    "order_type": "GTC",
    "status": "LIVE",
    "maker_address": "0xC41997C65144683AB62051EDd1f80B034756E588",
    "timestamp": "1790159090215",
    "event_type": "order"
}
{
    "id": "0x33d93615805104801e0620ee5e833ffff223f5d0ce7934c144a6f9ba5996ae07",
    "owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
    "market": "0xf91cac18426735921d224fc08e41159ddeca076c9ff82ea3fbbb0e8a3e157037",
    "asset_id": "38804663978458348916822540827139742232441664019828453815115111325876249578806",
    "side": "BUY",
    "order_owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
    "original_size": "5",
    "size_matched": "5",
    "price": "0.35",
    "associate_trades": [
        "dd3eafc7-fbfd-4202-af2f-00aa72d040da"
    ],
    "outcome": "Up",
    "type": "UPDATE",
    "created_at": "1790159090",
    "expiration": "0",
    "order_type": "GTC",
    "status": "MATCHED",
    "maker_address": "0xC41997C65144683AB62051EDd1f80B034756E588",
    "timestamp": "1790159119406",
    "event_type": "order"
}
*/
	const orderUpdate = async (value: any) => {
		// console.log('!!!!! orderUpdate:', value)

		if (value.type === 'CANCELLATION'){		//status: CANCELED
			// if (side.state === 'active'){
			// 	cancelTradeSide(side)
			// 	saveTrade(trade, 4)
			// 	render()
			// }
		}else if (value.type === 'PLACEMENT'){		//order placed
			if (trade.up.tokenId === value.asset_id){		//upside order updated
				// trade.up.state = 'buying'
			}else if (trade.down.tokenId === value.asset_id){		//downside order updated
				// trade.down.state = 'buying'
			}

		}else if (value.type === 'UPDATE' && value.status === 'MATCHED'){		//order updated
			// Only place sell after a BUY fill. CLOB balance for outcome tokens
			// can lag briefly behind the MATCHED event → retries in setOrder.
			if (value.side !== 'BUY') return

			if (trade.up.tokenId === value.asset_id){		//upside order updated
				trade.up.positionSize = parseFloat(value.size_matched)
				trade.up.state = 'positioned'
				if (trade.down.state === 'active') await cancelOpenBuyOrder(trade.down)

				await new Promise(resolve => setTimeout(resolve, 3000))
				await setOrder(setup, trade, {
					type		:'SELL',
					outcome		:'up',
					price		:setup.up.closePrice,
					timestamp	:Date.now(),
					size		:trade.up.positionSize,
				}, 10, 2000)

			}else if (trade.down.tokenId === value.asset_id){		//downside order updated
				trade.down.positionSize = parseFloat(value.size_matched)
				trade.down.state = 'positioned'
				if (trade.up.state === 'active') await cancelOpenBuyOrder(trade.up)

				await new Promise(resolve => setTimeout(resolve, 3000))
				await setOrder(setup, trade, {
					type		:'SELL',
					outcome		:'down',
					price		:setup.down.closePrice,
					timestamp	:Date.now(),
					size		:trade.down.positionSize,
				}, 10, 2000)
			}
		}

	}


	// ---------------------------------------------------------------------------- tradeUpdate
	const tradeUpdate = async (value: any) => {
		console.log('!!!!! tradeUpdate:', value)
		// if (value.type === 'UPDATE'){		//trade updated
		// 	if (trade.up.tokenId === value.asset_id){		//upside trade updated
		// 		// updatePrice(trade.up, value.price, value.ask, value.bid)
		// 	}else if (trade.down.tokenId === value.asset_id){		//downside trade updated
		// 		// updatePrice(trade.down, value.price, value.ask, value.bid)
		// 	}
		// }
	}


	// ---------------------------------------------------------------------------- onMarketTime
	// 5m = 300s
	const onMarketTime = (restSeconds: number) => {
// console.log('--- onMarketTime:', trade.state, restSeconds, setup)
		if (trade.state === 'open') {
			if (setup.currentMarket?.endTimestamp && Date.now() + 60000 > setup.currentMarket.endTimestamp) {
				setup._createMarket?.(70000)	//create next valid market from now + 70 seconds
			}
			if (restSeconds <= setup.startTime && trade.up.state === 'pending'){
				openTradeOrders(setup, trade)
			}
			if (restSeconds <= setup.endTime && (trade.up.state === 'active' || trade.down.state === 'active')){
				cancelOpenBuyOrders(trade)
				// setState('closed')
			}
		}
	}


	// ---------------------------------------------------------------------------- cancelOpenBuyOrders
	const cancelOpenBuyOrder = async (side: TradeSide) => {
		console.log('--- cancelOpenBuyOrders:', side.state)

		if (side.state !== 'active') return
		const orderId = side.buyOrder?.orderId
		if (!orderId) return
		try {
			setup._log('< cancel order:', orderId)
			const result = await cancelOrder(orderId)
			console.log('--- cancelOrder result:', result)
			setup._log('< cancel order result:', result)
		} catch (error) {
			console.error('--- cancelOrder failed:', orderId, error)
			setup._log('< cancel order failed:', error)
		}
		side.state = 'cancelled'
		render()
	}


	// ---------------------------------------------------------------------------- cancelOpenBuyOrders
	const cancelOpenBuyOrders = async (trade: Trade) => {
		console.log('--- cancelOpenBuyOrders:', trade.up.state, trade.down.state)
		const cancelSide = async (side: Trade['up']) => {
			if (side.state !== 'active') return
			const orderId = side.buyOrder?.orderId
			if (orderId) {
				try {
					setup._log('< cancel order:', orderId)
					const result = await cancelOrder(orderId)
					console.log('--- cancelOrder result:', result)
					setup._log('< cancel order result:', result)
					side.state = 'cancelled'
				} catch (error) {
					console.error('--- cancelOrder failed:', orderId, error)
					setup._log('< cancel order failed:', error)
				}
			} else {
				side.state = 'cancelled'
			}
		}
		await cancelSide(trade.up)
		await cancelSide(trade.down)
		render()
	}


	// ---------------------------------------------------------------------------- openTradeOrders
	const openTradeOrders = async (setup: any, trade: Trade) => {
		console.log('!!!!!!!!!!!!!!!!!!!!!--- openTradeOrders:', trade)
		if (trade.up.state === 'pending'){
			trade.up.state = 'active'
			setOrder(setup, trade, {
				type		:'BUY',
				outcome		:'up',
				price		:setup.up.openPrice,
				timestamp	:Date.now(),
				size		:setup.orderSize,
			})		//-> active
		}
		if (trade.down.state === 'pending'){
			trade.down.state = 'active'
			setOrder(setup, trade, {
				type		:'BUY',
				outcome		:'down',
				price		:setup.down.openPrice,
				timestamp	:Date.now(),
				size		:setup.orderSize,
			})		//-> active
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
				{/* <div>{(trade.timeFrame / 60000).toFixed(2) + ' | ' + (trade.restTime / 60000).toFixed(2)}</div> */}
				<div></div>
				<div style={{
					cursor: 'pointer',
					color: trade.up.state === 'active'
						? 'orange' // Tailwind blue-500 hex
						: trade.up.state === 'completed' || trade.up.state === 'cancelled'
							? '#3c3' // Tailwind green-400 hex
							: '#999' // Tailwind gray-500 hex
				}}></div>
				<TradeState trade={trade} side='up' />
				<div>{trade.up.orderSize.toFixed(2) + ' | ' + trade.up.positionSize.toFixed(2)}</div>
				{/* <div style={{
					cursor: 'pointer',
					color: trade.down.state === 'active'
						? 'orange' // Tailwind blue-500 hex
						: trade.down.state === 'completed'
							? '#3c3' // Tailwind green-400 hex
							: '#999' // Tailwind gray-500 hex
				}}
				>
				</div> */}
				<TradeState trade={trade} side='down' />
				<div>{trade.down.orderSize.toFixed(2) + ' | ' + trade.down.positionSize.toFixed(2)}</div>
				<div></div>
			</div>
			<div className={`absolute top-0 right-0 text-xs text-gray-500 ${trade.isLive ? 'text-green-500' : 'text-red-500'}`}>{trade.isLive ? 'live' : 'not live'}</div>
		</div>
	)
}


// ---------------------------------------------------------------------------- TradeState
const TradeState = ({trade, side}: {trade: Trade, side: 'up' | 'down'}) => {
	const tradeSide = trade[side as 'up' | 'down']
	const [active, setActive] = useState<boolean>(tradeSide.enabled && tradeSide.state !== 'completed')

	useEffect(() => {
		setActive(tradeSide.enabled && tradeSide.state !== 'completed')
	}, [tradeSide.enabled, tradeSide.state])

	return (
		<div className='flex flex-row justify-between items-center'>
			<div>{active ? tradeSide.state : 'disabled'}</div>
			{trade.state === 'open' && (
				<div
					className={`rounded-full w-3 h-3 cursor-pointer ${active ? 'bg-green-600' : 'bg-red-600'}`}
					onClick={() => {
						setActive(enabled => {
							tradeSide.enabled = !enabled
							return !enabled
						})
					}}
				></div>
			)}
		</div>
	)
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

	const orderData: PlaceOrderParams = {
		marketId: trade.conditionId,
		price: action.price || 0,
		quantity: action.size || 0,
		side: action.type,
		outcome: action.outcome === 'up' ? 'Up' : 'Down',
		outcomeId: action.outcome === 'up' ? trade.up.tokenId : trade.down.tokenId
	}

	action.orderData = orderData
	console.log('!!!!!!!!!!!!!!!! set order:', trade, trade.isLive, orderData);
	
	if (setup._log) setup._log('> set order: ' + action.type + ' (live:' + trade.isLive + ')', orderData)	//-> onUpdate log

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
				beep(20, 1000, 0.2)

			}else if (action.type === 'SELL'){
				side.sellOrder = order
				beep(20, 500, 0.2)

			}

			setup._log('< set order result:', order)

			const orderData = await getOrder(order.orderId);
			console.log('!!!!!!!!!!!!! orderData:', orderData)

			// if (orderData?.id) {
			// 	trade.orders[orderData.id] = orderData
			// }
		}
	}
}


// ---------------------------------------------------------------------------- setPositionSize
const setPositionSize = async (trade: Trade) => {
console.log('---setPositionSize:', trade.conditionId)
	const sizes = await getActiveMarketPositionSizes({
		conditionId: trade.conditionId || '',
		upTokenId: trade.up.tokenId || '',
		downTokenId: trade.down.tokenId || '',
	})
console.log('sizes:', sizes)
	trade.up.size = sizes.up
	trade.down.size = sizes.down
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
