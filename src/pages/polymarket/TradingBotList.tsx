import type { MarketData } from "@/lib/polymarket/types";
import localForage from "localforage";
import { useEffect, useState } from "react";
import TradingBotItem, { type Trade } from "./TradingBotItem";


// ============================================================================ TradingBotList
export default function TradingBotList({market: market, setup}: {market: MarketData, setup: any}) {
	const [currentMarket, setCurrentMarket] = useState<MarketData | null>()
	const [trades, setTrades] = useState<Trade[]>([])
	const [isLoaded, setIsLoaded] = useState<boolean>(false)

	useEffect(() => {
		console.log('---TradingBotList init:')

		loadTrades().then((trades) => {
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
		console.log('---TradesList market update:', market, setup.trade)
		setCurrentMarket(market)

		if (!isLoaded) return

		if (setup.trade && setup.trade.slug !== market.slug) {
			// setup.trade._setState?.('closed')
			setup._updateTrade?.('state', 'closed')
			setup.trade = null
		}
		// if (setup.basePrice && (!setup.trade || setup.trade.slug !== market.slug)){
		if (!setup.trade || setup.trade.slug !== market.slug){
			const trade = createTrade()
			setup.trade = trade
			setTrades(trades => [trade, ...trades])
		}
	}, [market])

	// ---------------------------------------------------------------------------- createTrade
	const createTrade = (): Trade => {
		console.log('---TradesList createTrade:', market)
		const upLimit = (setup.up.priceLimit / 100) + 1
		const downLimit = (setup.down.priceLimit / 100) + 1
		const upOpenPrice = setup.basePrice * upLimit
		const downOpenPrice = setup.basePrice / downLimit

		const trade: Trade = {
			slug: market.slug,
			question: market.question,
			conditionId: market.conditionId,
			basePrice: setup.basePrice,
			tickerPrice: 0,
			up: {
				outcome: 'up',
				tokenId: market.outcomes.find((outcome) => outcome.title === 'Up')?.id || '',
				price: 0,
				limit: setup.up.priceLimit,
				openPrice: upOpenPrice,
				trades: [],
				state: 'pending',
				enabled: setup.up.enabled,
			},
			down: {
				outcome: 'down',
				tokenId: market.outcomes.find((outcome) => outcome.title === 'Down')?.id || '',
				price: 0,
				limit: setup.down.priceLimit,
				openPrice: downOpenPrice,
				trades: [],
				state: 'pending',
				enabled: setup.down.enabled,
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
				// <TradeItem key={trade.slug} trade={trade} setup={setup} />
				<TradingBotItem key={trade.slug} trade={trade} setup={setup} />
			))}
		</div>
	)
}


const TRADE_STORE = localForage.createInstance({
	name: 'polymarket',
	storeName: 'polymarket-trades'
})

// ---------------------------------------------------------------------------- loadTrades
const loadTrades = async () => {
	const trades: Trade[] = []
	const keys = await TRADE_STORE.keys()
	for (const key of keys) {	
		const trade = await TRADE_STORE.getItem(key)
		if (trade) trades.push(trade as Trade)
	}
	return trades.sort((a, b) => b.createdAt - a.createdAt)
}
