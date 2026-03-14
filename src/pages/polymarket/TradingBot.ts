import type { MarketData } from "@/lib/polymarket/types"
import type { Trade } from "./TradingBotItem"


// ---------------------------------------------------------------------------- createTrade
export const createTrade = (market: MarketData, setup: any): Trade => {
	console.log('---TradesList createTrade:', market)

	const trade: Trade = {
		symbol: setup.symbol,
		marketType: setup.marketType,
		slug: market.slug,
		startTimestamp: setup.baseTimestamp,
		endTimestamp: setup.nextTimestamp,
		timeFrame: setup.marketTime,
		marketTime: 0,
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
			level: 0,
			orderLimit: setup.up.orderLimit,
			timeLimit: setup.up.timeLimit,
			buyLimit: setup.up.buyLimit,
			sellLimit: setup.up.sellLimit,
			size: 0,
			trades: [],
			buyOrder: null,
			sellOrder: null,
			state: 'pending',
		},
		down: {
			outcome: 'down',
			enabled: setup.down.enabled,
			tokenId: market.outcomes.find((outcome) => outcome.title === 'Down')?.id || '',
			price: 0,
			level: 0,
			orderLimit: setup.down.orderLimit,
			timeLimit: setup.down.timeLimit,
			buyLimit: setup.down.buyLimit,
			sellLimit: setup.down.sellLimit,
			size: 0,
			trades: [],
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
	}
	return trade
}
