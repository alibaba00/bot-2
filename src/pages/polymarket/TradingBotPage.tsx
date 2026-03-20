import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import useLog from "@/hooks/use-log";
import { fetchMarketBySlugFromGamma } from "@/lib/polymarket/markets";
import type { MarketData } from "@/lib/polymarket/types";
import type { OrderMessage, TradeMessage } from "@/lib/polymarket/user-channel-websocket";
import { beep } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import ClobMarketTicker, { type LastTrade } from "./ClobMarketTicker";
import { MarketTimer } from "./MarketTimer";
import { fsPromises } from "./PolymarketApi";
import { TRADE_STORE, type Trade } from "./TradingBotItem";
import TradingBotList from "./TradingBotList";
import useUserChannel from "./useUserChannel";
import { getActiveMarketPositionSizes } from "@/lib/polymarket/wallet";


// ============================================================================ TradingBotPage
export default function TradingBotPage() {
	const [enabled, setEnabled] = useState<boolean>(false)
	const [currentMarket, setCurrentMarket] = useState<MarketData | null>(null)
	const [liveTrading, setLiveTrading] = useState<boolean>(false)
	const { logView, addLog } = useLog()

	const { view } = useUserChannel({
		onTradeUpdate: (trade: TradeMessage) => {
			console.log('---Trade Update (UserChannel)', trade.type, trade.status, trade)
			log('Trade Update (UserChannel)', {
				id: trade.id,
				status: trade.status,
				side: trade.side,
				price: trade.price,
				size: trade.size,
				asset_id: trade.asset_id,
				market: trade.market,
				outcome: trade.outcome,
				timestamp: trade.timestamp,
			})
			setup.current._updateTrade?.('tradeUpdate', trade)
		},
		onOrderUpdate: (order: OrderMessage) => {
			console.log('---Order Update (UserChannel)', order.type, order)
			log('Order Update (UserChannel)', {
				id: order.id,
				type: order.type,
				side: order.side,
				price: order.price,
				original_size: order.original_size,
				size_matched: order.size_matched,
				asset_id: order.asset_id,
				market: order.market,
				outcome: order.outcome,
				timestamp: order.timestamp,
			})
			setup.current._updateTrade?.('orderUpdate', order)
		},
		onError: (error) => {
			console.error('---Error (UserChannel)', error)
			setup.current.isConnected = false
			setup.current._updateTrade?.('connected', false)
		},
		onConnect: () => {
			console.log('---Connect (UserChannel)')
			setup.current.isConnected = true
			setup.current._updateTrade?.('connected', true)
			log('Connect (UserChannel)', 'connected')

		},
		onDisconnect: () => {
			console.log('Disconnect (UserChannel)')
			setup.current.isConnected = false
			setup.current._updateTrade?.('connected', false)
			log('Disconnect (UserChannel)', 'disconnected')
		},
	})

	const log = (action: string, data: any) => {
		setup.current._updateTrade?.('log', {action: action, data: data, timestamp: Date.now()})
		addLog(action, data)
	}

	const setup = useRef({
		symbol: 'btc',

		// marketTime: 15,
		// marketType: 'updown-15m',
		// startTimeLimit: 180,	//seconds
		// endTimeLimit: 60,	//seconds

		marketTime: 5,
		marketType: 'updown-5m',
		startTimeLimit: 60,	//seconds
		endTimeLimit: 30,	//seconds

		sizeFactor: 5.0,		//size factor to multiply the trade size

		liveTrading: false as boolean,
		isConnected: false as boolean,
		currentMarket: null as MarketData | null,
		baseTimestamp: 0,
		basePrice: 0,
		up : {
			enabled: true,
		},
		down : {
			enabled: true,
		},
		tradeMode: 'none' as 'none' | 'up' | 'down' | 'up-and-down' | 'up-or-down',
		nextTimestamp: Infinity,
		tickerValues: {
			coinbase: {timestamp: 0, price: 0},
			clob: {
				up: {timestamp: 0, price: 0},
				down: {timestamp: 0, price: 0}
			}
		},
		trade: null as Trade | null,		//current trade
		assets: {},		//assets lookup table
		_updateTrade: null as ((type: string, value?: any) => void) | null,		//update trade state	
		_log: log,
	})



	// ---------------------------------------------------------------------------- initialize on mount
	useEffect(() => {
		onInit()		
	}, [])


	// ---------------------------------------------------------------------------- onInit
	const onInit = async () => {
		console.log('----------------------onInit:')
		createMarket()
	}


	// ---------------------------------------------------------------------------- onExpired
	const onExpired = async () => {
		const sc = setup.current

		console.log('----------------------onExpired!')
		sc._updateTrade?.('expired')

		beep(10, 500)
		createMarket()
	}


	// ---------------------------------------------------------------------------- createMarket
	const createMarket = async () => {
		const sc = setup.current

		const timestamp = getUTCTimestamp(Date.now() + 10000, sc.marketTime, 0)	//find next marketTime-minute timestamp
		sc.baseTimestamp = timestamp * 1000
		sc.nextTimestamp = (timestamp + sc.marketTime * 60) * 1000
		const currentSlug = sc.symbol + '-' + sc.marketType + '-' + timestamp.toString()

		// TODO:
		// const market = await PolymarketApi.createMarket(sc.symbol, sc.marketType, currentSlug) as Market | null
		const market = await fetchMarketBySlugFromGamma(currentSlug) as MarketData | null
		sc.currentMarket = market
		setCurrentMarket(market)

		return market
	}


	// ---------------------------------------------------------------------------- onTime
	const onTime = (restSeconds: number) => {
		const sc = setup.current
		sc._updateTrade?.('time', restSeconds)
	}


	// ---------------------------------------------------------------------------- onMarketPriceUpdate
	/* LastTrade example:
	{
		"price": 0.97,
		"size": 3,
		"side": "BUY",
		"outcome_id": "17624096711533407181854232709583885869485769655839623144666637539997247569497",
		"outcome_title": "down",
		"timestamp": 1771438422949,
		"transaction_hash": "0x4b5b541f3a37ce3499a262a947e8b6c52fafb8818241242b0362a47e165f47ed"
	}
	*/
	const onMarketPriceUpdate = (lastTrade: LastTrade) => {
		const sc = setup.current

		const trade = sc.trade
		if (!trade) return

		trade.marketTime = lastTrade.timestamp - sc.baseTimestamp
		trade.restTime = sc.nextTimestamp - lastTrade.timestamp

		const values = sc.tickerValues.clob[lastTrade.outcome_title]
		if (values.price === lastTrade.price) return

		values.price = lastTrade.price
		values.timestamp = lastTrade.timestamp

		// trade._setMarketPrice?.(lastTrade.timestamp, lastTrade.outcome_title as 'up' | 'down', lastTrade.price)
		// trade[lastTrade.outcome_title].price = lastTrade.price
		sc._updateTrade?.('marketPrice', {
			timestamp: lastTrade.timestamp,
			outcome: lastTrade.outcome_title as 'up' | 'down',
			price: lastTrade.price
		})
	}


	// ---------------------------------------------------------------------------- onTest
	const onTest = async () => {
		// console.log('getOrder ...')
		// const order = await getOrder('0xa393633d7a31786caeaed8ac09943be612ef28ae510839fcac2e75a6389893e7');
		// console.log('order:', order)

		// console.log('getOpenOrders ...')
		// const orders = await getOpenOrders()
		// console.log('orders:', orders)

		if (!currentMarket) return
		console.log('getActiveMarketPositionSizes ...')
		const sizes = await getActiveMarketPositionSizes({
			conditionId: currentMarket.conditionId || '',
			upTokenId: currentMarket.outcomes.find((outcome: any) => outcome.title === 'Up')?.id || '',
			downTokenId: currentMarket.outcomes.find((outcome: any) => outcome.title === 'Down')?.id || '',
		});
		console.log('sizes:', sizes)

	
	return

		const root = 'A:/DATA/polymarket/trades/'
		const trades = await TRADE_STORE.keys()
		for (const slug of trades) {
			const tradeFile = root + slug + '.json'
			// if (fs.existsSync(tradeFile)) continue

			const tradeData = await TRADE_STORE.getItem(slug)

			const trade = tradeData as Trade
			console.log('trade:', slug, fsPromises)
			if (fsPromises) {
				await fsPromises.writeFile(tradeFile, JSON.stringify(trade, null, '\t'))
				console.log('trade saved to:', tradeFile)
			}
		}
	}


	// ---------------------------------------------------------------------------- render
	return (
		<div className="flex flex-col gap-2 p-4 w-full">
			<div className="flex flex-row justify-between items-center w-full">
				<h1 onClick={() => console.log('setup:', setup.current)}>Trading Bot</h1>

				<MarketTimer minutes={setup.current.marketTime} onExpired={onExpired} onTime={onTime} />

				<div className="flex flex-row items-center gap-2 gap-3">
					<Button variant="outline" size="icon" onClick={() => {
							onTest()
						}}>
						Test
					</Button>
					<Label className="text-sm font-medium select-none ml-4">Live Trading</Label>
					<Switch checked={liveTrading} onCheckedChange={(checked) => {
						setup.current.liveTrading = checked
						if (setup.current.trade) {setup.current.trade.isLive = checked}
						setLiveTrading(checked)
					}}	 />

					<Label className="text-sm font-medium select-none ml-4">enabled</Label>
					<Switch checked={enabled} onCheckedChange={(checked) => {
						setEnabled(checked)
					}} />

				</div>
			</div>

			{currentMarket && (
				<>
				<div className='flex flex-row gap-2 flex-wrap w-full'>
					<ClobMarketTicker market={currentMarket} onUpdate={onMarketPriceUpdate} />
					{view()}
				</div>
				{enabled && (
					<TradingBotList market={currentMarket} setup={setup.current} />
				)}
				</>
			)}
			{logView()}
		</div>
	)
}


// ---------------------------------------------------------------------------- getUTCTimestamp
// Function to get the current 15-minute UTC timestamp (rounded down to nearest 15-minute interval)
// date: e.g. 2025-12-10
const getUTCTimestamp = (date: Date | number | null, minutes: number = 15, offset: number = 0): number => {
	if (!date) date = new Date()	
	const dateTime = date instanceof Date ? date.getTime() : date
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
