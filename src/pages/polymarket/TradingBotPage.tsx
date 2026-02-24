import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import useLog from "@/hooks/use-log";
import { fetchMarketBySlugFromGamma } from "@/lib/polymarket/markets";
import type { MarketData } from "@/lib/polymarket/types";
import { beep } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import ClobMarketTicker, { type LastTrade } from "./ClobMarketTicker";
import CoinbasePriceTicker from "./CoinbasePriceTicker";
import { MarketTimer } from "./MarketTimer";
import PolymarketApi, { fsPromises, fs } from "./PolymarketApi";
import { TRADE_STORE, type Trade } from "./TradingBotItem";
import TradingBotList from "./TradingBotList";
import { useUserChannelWebSocket } from "@/hooks/use-user-channel-websocket";


// ============================================================================ TradingBotPage
export default function TradingBotPage() {
	const [currentMarket, setCurrentMarket] = useState<MarketData | null>(null)
	const [liveTrading, setLiveTrading] = useState<boolean>(false)
	const { logView, addLog } = useLog()

	const log = (action: string, data: any) => {
		setup.current._updateTrade?.('log', {action: action, data: data, timestamp: Date.now()})
		addLog(action, data)
	}

	const setup = useRef({
		symbol: 'btc',
		liveTrading: false as boolean,
		isConnected: false as boolean,
		currentMarket: null as MarketData | null,
		baseTimestamp: 0,
		basePrice: 0,
		up : {
			enabled: true,
			orderLimit: 0.1,	//order limit to set buy limit
			timeLimit: 4,		//buy timeout in minutes before closing market
			buyLimit: 0.01,		//ticker price trigger limit in % of base price
			sellLimit: 0.019,	//sell limit market price
			size: 100,			//buy size shares
		},
		down : {
			enabled: true,
			orderLimit: 0.1,	//order limit to set buy limit
			timeLimit: 4,		//buy timeout in minutes before closing market
			buyLimit: 0.01,		//ticker price trigger limit in % of base price
			sellLimit: 0.019,	//sell limit market price
			size: 100,			//buy size shares
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
		_updateTrade: null as ((type: string, value: any) => void) | null,
		_log: log,
	})


	// ---------------------------------------------------------------------------- userChannelWs
	const userChannelWs = useUserChannelWebSocket({
		onTradeUpdate: (trade) => {
			log('Trade Update (WebSocket)', {
				id: trade.id,
				status: trade.status,
				side: trade.side,
				price: trade.price,
				size: trade.size,
				outcome: trade.outcome,
				timestamp: trade.timestamp,
			})
			setup.current._updateTrade?.('tradeUpdate', trade)
		},
		onOrderUpdate: (order) => {
			log('Order Update (WebSocket)', {
				id: order.id,
				type: order.type,
				side: order.side,
				price: order.price,
				size: order.size,
				outcome: order.outcome,
				timestamp: order.timestamp,
			})
			setup.current._updateTrade?.('orderUpdate', order)
		},
		onError: (error) => {
			log('Error (WebSocket)', {
				error: error.message,
				message: 'userChannelWs error',
			})
		},
		onConnect: () => {
			setup.current.isConnected = true
			setup.current._updateTrade?.('connected', true)
			log('Connect (WebSocket)', 'userChannelWs')
		},
		onDisconnect: () => {
			setup.current.isConnected = false
			setup.current._updateTrade?.('connected', false)
			log('Disconnect (WebSocket)', 'userChannelWs')
		},
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


	// ---------------------------------------------------------------------------- onCoinbasePriceUpdate
	const onCoinbasePriceUpdate = (timestamp: number, price: number) => {
		// setup.current.trade?._setTickerPrice?.(timestamp, price)
		// setup.current._updateTrade?.('tickerPrice', {timestamp: timestamp, price: price})

		// const values = setup.current.tickerValues
		// values.coinbase = {timestamp: timestamp, price: price}
	}


	// ---------------------------------------------------------------------------- onTest
	const onTest = async () => {
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

				<MarketTimer minutes={15} onExpired={onExpired} />

				{/* User Channel WebSocket Status */}
				<div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
					<span className="text-sm font-medium">User Channel WebSocket:</span>
					<span className={`text-sm ${userChannelWs.status === 'connected' ? 'text-green-600' : userChannelWs.status === 'connecting' ? 'text-yellow-600' : 'text-gray-600'}`}>
						{userChannelWs.status}
					</span>
					{userChannelWs.status === 'disconnected' && (
						<Button variant="outline" size="sm" onClick={userChannelWs.connect}>
							Connect
						</Button>
					)}
					{userChannelWs.status !== 'disconnected' && (
						<Button variant="outline" size="sm" onClick={userChannelWs.disconnect}>
							Disconnect
						</Button>
					)}
					{userChannelWs.error && (
						<span className="text-xs text-red-600">{userChannelWs.error.message}</span>
					)}
				</div>

				<div className="flex flex-row items-center gap-2 gap-3">
					<Button variant="outline" size="icon" onClick={() => {
							onTest()
						}}>
						Test
					</Button>
					<Label className="text-sm font-medium select-none ml-0">Live Trading</Label>
					<Switch checked={liveTrading} onCheckedChange={(checked) => {
						setup.current.liveTrading = checked
						if (setup.current.trade) {setup.current.trade.isLive = checked}
						setLiveTrading(checked)
					}}	 />
				</div>
			</div>

			{currentMarket && (
				<>
				<div className='w-full'>
					<div>{'Base Price: ' + setup.current.basePrice.toString()}</div>
				</div>
				<div className='flex flex-row gap-2 flex-wrap w-full'>
					<ClobMarketTicker market={currentMarket} onUpdate={onMarketPriceUpdate} />
					<CoinbasePriceTicker symbol={setup.current.symbol.toUpperCase() + '-USD'} onUpdate={onCoinbasePriceUpdate} />
				</div>
				<TradingBotList market={currentMarket} setup={setup.current} />
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
