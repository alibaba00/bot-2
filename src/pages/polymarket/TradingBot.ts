import type { MarketData, PlaceOrderResponse } from "@/lib/polymarket/types"
import type { Trade } from "./TradingBotItem"


// ---------------------------------------------------------------------------- createTrade
// from TradingBotList
export const createTrade = (market: MarketData, setup: any): Trade => {
	console.log('---TradesList createTrade:', market)

	const trade: Trade = {
		symbol: setup.symbol,
		market: market,
		marketType: setup.marketType,
		slug: market.slug,
		startTimestamp: setup.baseTimestamp,
		endTimestamp: setup.nextTimestamp,
		timeFrame: setup.timeFrame,
		restTime: 0,
		question: market.question,
		conditionId: market.conditionId,
		basePrice: setup.basePrice,
		tickerPrice: 0,
		up: {
			outcome: 'up',
			enabled: setup.up.enabled,
			tokenId: market.outcomes.find((outcome) => outcome.title === 'Up')?.id || '',
			price: 0,
			orderLimit: setup.up.orderLimit,
			timeLimit: setup.up.timeLimit,
			buyLimit: setup.up.buyLimit,
			sellLimit: setup.up.sellLimit,
			size: 0,
			orderSize: 0,
			positionSize: 0,
			trades: [],
			eventLog: [],
			buyOrder: null,
			sellOrder: null,
			state: 'pending',
		},
		down: {
			outcome: 'down',
			enabled: setup.down.enabled,
			tokenId: market.outcomes.find((outcome) => outcome.title === 'Down')?.id || '',
			price: 0,
			orderLimit: setup.down.orderLimit,
			timeLimit: setup.down.timeLimit,
			buyLimit: setup.down.buyLimit,
			sellLimit: setup.down.sellLimit,
			size: 0,
			orderSize: 0,
			positionSize: 0,
			trades: [],
			eventLog: [],
			buyOrder: null,
			sellOrder: null,
			state: 'pending',
		},
		state: 'pending',
		outcome: null,
		createdAt: Date.now(),
		isLive: setup.liveTrading,
		isConnected: setup.isConnected,
		logs: [],
		orders: {},
	}

	if (trade.up.tokenId) setup.assets[trade.up.tokenId] = trade.up
	if (trade.down.tokenId) setup.assets[trade.down.tokenId] = trade.down
	
	return trade
}
