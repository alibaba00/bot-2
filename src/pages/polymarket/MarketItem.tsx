import { useCLOBMarketWebSocket } from "@/hooks/use-clob-market-websocket";
import type { Market, MarketState } from "@/lib/polymarket/types";
import { useEffect, useRef, useState } from "react";
import PolymarketApi from "./PolymarketApi";



// export default function MarketItem(props: { market: Market }) {
	// const market = props.market
export default function MarketItem({ symbol, type, minutes, offset }: { symbol: string, type: string, minutes: number, offset: number }) {
	const [market, setMarket] = useState<Market | null>(null)
	
	const [assetIds, setAssetIds] = useState<string[]>([])
	const assets = useRef<any>({})
	const [clobMarketWsStatus, setClobMarketWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
	// const [lastMarketLastTradePriceUpdate, setLastMarketLastTradePriceUpdate] = useState<CLOBLastTradePriceUpdate | null>(null)
	const [state, setState] = useState<MarketState>()
	// const state = PolymarketApi.use('marketState_' + symbol)
	const tradingActive = PolymarketApi.use('tradingActive')
	const marketCompleted = PolymarketApi.use('marketCompleted-' + type)	//market is completed from CryptoTickers.tsx
	const marketCloseTimeoutId = useRef<NodeJS.Timeout | null>(null)
	const marketOpenTimeoutId = useRef<NodeJS.Timeout | null>(null)

	const [tradeLog, setTradeLog] = useState<{
		asset: string
		price: number
		size: number
		side: 'BUY' | 'SELL'
		timestamp: number
	} | null>(null)

	// Last trade prices from last_trade_price events
	const [lastTradePrices, setLastTradePrices] = useState<
	Record<
		string,
		{
			price: number
			size: number
			side: 'BUY' | 'SELL'
			timestamp: number
			transaction_hash?: string
		}
	>
	>({})
	
	const clobMarketWs = useCLOBMarketWebSocket({
		assetIds: assetIds,
		onLastTradePriceUpdate: (update) => {
			// setLastMarketLastTradePriceUpdate(update)
			setLastTradePrices((prev) => ({
				...prev,
				[update.asset_id]: {
					price: update.price,
					size: update.size,
					side: update.side,
					timestamp: update.timestamp,
					transaction_hash: update.transaction_hash,
					asset: assets.current[update.asset_id]
				}
			}))
			setTradeLog({
				asset: assets.current[update.asset_id],
				price: update.price,
				size: update.size,
				side: update.side,
				timestamp: update.timestamp,
			})
			// onTradeLog(update)
		},
		onError: (err) => {
			console.log('clobMarketWs error', err)
		},
		onConnect: () => {
			setClobMarketWsStatus('connected')
		},
		onDisconnect: () => {
			setClobMarketWsStatus('disconnected')
		},
		autoConnect: false
	})

	useEffect(() => {
		if (tradeLog && market) {
			const log = tradeLog.timestamp + ';' + tradeLog.asset + ';' + tradeLog.side + ';' + tradeLog.price + ';' + tradeLog.size;
			PolymarketApi.onTradeLog(symbol, market.slug, log)
		}
	}, [tradeLog])


	// 1766408400 - 1766404800
	useEffect(() => {
		console.log('---init MarketItem:', symbol, type, minutes)
		PolymarketApi.createMarketFromDate(symbol, type, new Date(Date.now() + 10000), minutes, offset)		
		.then((market) => {
			console.log('market:', market)
			setMarket(market)
		})

		return () => {
			if (marketCloseTimeoutId.current) clearTimeout(marketCloseTimeoutId.current)
			if (marketOpenTimeoutId.current) clearTimeout(marketOpenTimeoutId.current)
		}
	}, [])


	useEffect(() => {
		if (!tradingActive) disconnectMarket()	
		if (tradingActive) connectMarket()
	}, [tradingActive])


	useEffect(() => {
		if (market?.state) updateMarketState(market.state || 'init')
	}, [market?.state])


	useEffect(() => {
		if (marketCompleted) {
			if (marketOpenTimeoutId.current) clearTimeout(marketOpenTimeoutId.current)
			setMarketState('completed')
		}
	}, [marketCompleted])


	if (!market) return null;


	const setMarketState = (state: MarketState) => {
		console.log('---setMarketState:', market?.slug, state)
		market.state = state
		setState(state)
		PolymarketApi.set('marketState_' + symbol, state)	//update tab indicator
		PolymarketApi.cacheMarket(market as unknown as Market)
	}


	const updateMarketState = async (_state: MarketState) => {
		if (!market) return;

		console.log('updateMarketState:', market?.slug, _state)

		switch (_state){
			case 'init':		//market is initializing
				console.log('---init MarketItem:', market.slug, market)
				// _marketData = await fetchMarketBySlugFromGamma(market?.slug || '')
				// console.log('marketData:', _marketData)
				// market.marketData = _marketData
				// await PolymarketApi.cacheMarket(market)	//update market cache
				// await PolymarketApi.saveMarket(market)

				const newAssetIds = market.marketData?.outcomes.map((outcome) => outcome.id) || []
				setAssetIds(newAssetIds)

				clobMarketWs.updateAssetIds(newAssetIds)

				market.marketData?.outcomes.forEach((outcome) => {
					assets.current[outcome.id] = outcome.title
					// assets.current[outcome.title] = outcome.id
				})

				let _state = PolymarketApi.getMarketState(market) as MarketState	//-> pending | started
				setMarketState(_state)
				return;

			// from getMarketState
			case 'pending':		//wait till market starts
				return;

			// from getMarketState
			case 'started':		//wait till market price is available
				connectMarket() //--> start trading

				marketOpenTimeoutId.current = setInterval(async () => {
					await PolymarketApi.openMarket(market as unknown as Market)
					if (market.openPrice) {
						if (marketOpenTimeoutId.current) clearInterval(marketOpenTimeoutId.current)
						setMarketState('running') //--> connectMarket
					}
				}, 5000)	//check every second if market price is available
				return;

			// from marketCompleted
			case 'running':		//market is running
				// connectMarket() //--> trading
				return;

			case 'completed':		//market is completed
				disconnectMarket()

				const currentTicker = PolymarketApi.tickerPrices.get(symbol) || null
				if (marketCloseTimeoutId.current) clearTimeout(marketCloseTimeoutId.current)

				if (market) market.closeTicker = currentTicker
				if (market?.closeTicker) {	//placeholder till final price from ticker is available
					market.closePrice = market.closeTicker.price
					market.closePriceTimestamp = market.closeTicker.timestamp
				}

				// PolymarketApi.pollingClosePrice(market)	//polling for final price in the background
				marketCloseTimeoutId.current = setTimeout(() => {
					PolymarketApi.closeMarket(market as unknown as Market)
				}, 60000 * 5)	//wait 5 minutes before closing market
				
				// create next market
				const nextMarket = await PolymarketApi.createMarketFromDate(symbol, type, new Date(Date.now() + 10000), minutes)
				console.log('next market:', nextMarket)
				if (nextMarket) nextMarket.openTicker = currentTicker
				setMarket(nextMarket)	//-> init market
				return;

			case 'closed':		//market is closed
				return;

			case 'failed':		//market is failed
				return;

			default:			//unknown state
				console.log('---default MarketItem:', market.slug, market)
				return;
		}	
	}

	function connectMarket() {
		if (!tradingActive || !market || clobMarketWs.status === 'connected'
			|| (market.state !== 'running' && market.state !== 'started')) return;
		clobMarketWs.connect()
		console.log('clobMarketWs status', clobMarketWs.status)
	}

	function disconnectMarket() {
		clobMarketWs.disconnect()
		console.log('clobMarketWs status', clobMarketWs.status)
	}

	return (
		<div className='flex flex-col gap-4 border-t border-black/20 dark:border-white/20 pt-4'>
			<div className='flex flex-col gap-2'>
				<div className='text-sm text-muted-foreground'>{market?.marketData?.question}</div>
				<div className='text-sm text-muted-foreground'>{'slug: ' + market?.marketData?.slug}</div>
				<div className='text-sm text-muted-foreground'>{'state: ' + market.state}</div>
				{/* <div className='text-sm text-muted-foreground'>{timeRemaining?.minutes}m {timeRemaining?.seconds}s</div> */}
			</div>
			<div className='flex flex-col gap-2'>
				<div className='text-sm text-muted-foreground'>{'Price to beat: ' + (market.openPrice || (state === 'started'? 'pending...':'---'))}</div>
				{/* <div className='text-sm text-muted-foreground'>{'Final price: ' + (market.closePrice || (state === 'stopped'? 'pending...' : '---'))}</div> */}
			</div>

			<div className='flex flex-col gap-2'>
				<div className='text-sm text-muted-foreground'>{clobMarketWsStatus}</div>
				<h2 className='text-sm text-muted-foreground'>{'Up (' + lastTradePrices[assetIds[0]]?.side + '): ' + lastTradePrices[assetIds[0]]?.price}</h2>
				<h2 className='text-sm text-muted-foreground'>{'Down (' + lastTradePrices[assetIds[1]]?.side + '): ' + lastTradePrices[assetIds[1]]?.price}</h2>
			</div>
		</div>
	)
}


/* last trade price update sample:
{
    "asset_id": "92581211377091492168759303491099262196233985218333357388679289186455984779645",
    "price": 0.86,
    "size": 6,
    "side": "BUY",
    "timestamp": 1765146357284,
    "transaction_hash": "0x8a0880c31e122e7e063af3c0bdb849faf5ed5e9c319cceed8901255bd7c570e7",
    "fee_rate_bps": 0,
    "market": "0x7ee34465015e239f9b7a76e4aee22caf049db9f914c8c3216882e32c6e7541e1"
}
*/

/* market sample:
{
    "success": true,
    "message": "Market created successfully",
    "slug": "btc-updown-15m-1765144800",
    "timestamp": 1765144800,
    "startTimestamp": 1765144800000,
    "endTimestamp": 1765145700000,
    "state": "init"
}
*/

/*
// market data example from Gamma API:
{
    "id": "834170",
    "question": "Bitcoin Up or Down - December 6, 10:15AM-10:30AM ET",
    "slug": "btc-updown-15m-1765034100",
    "description": "This market will resolve to \"Up\" if the Bitcoin price at the end of the time range specified in the title is greater than or equal to the price at the beginning of that range. Otherwise, it will resolve to \"Down\".\nThe resolution source for this market is information from Chainlink, specifically the BTC/USD data stream available at https://data.chain.link/streams/btc-usd.\nPlease note that this market is about the price according to Chainlink data stream BTC/USD, not according to other sources or spot markets.",
    "image": "https://polymarket-upload.s3.us-east-2.amazonaws.com/BTC+fullsize.png",
    "active": true,
    "closed": false,
    "volume": 7386.355185,
    "liquidity": 4675.9179,
    "endDate": "2025-12-06T15:30:00Z",
    "startDate": "2025-12-05T15:22:16.862435Z",
    "conditionId": "0x001326d31ec630fd179998162a3ca40fb17168400370fedfe9aae4529341a761",
    "marketMakerAddress": "",
    "outcomes": [
        {
            "id": "83830841804472257760562478289573860576952425019791151581807551696870117382753",
            "title": "Up",
            "price": 0.53,
            "volume": 0
        },
        {
            "id": "106577271810132753281735802347950743159975275287301056541989167614043110495831",
            "title": "Down",
            "price": 0.47,
            "volume": 0
        }
    ],
    "createdAt": "2025-12-05T15:17:24.444908Z",
    "updatedAt": "2025-12-06T15:20:53.122659Z"
}
*/
