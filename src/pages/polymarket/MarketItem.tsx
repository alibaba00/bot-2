import { useEffect, useState, useRef } from "react";
import PolymarketApi from "./PolymarketApi";
import { fetchMarketBySlugFromGamma } from "@/lib/polymarket/markets";
import type { Market, MarketData, MarketState } from "@/lib/polymarket/types";
import { Button } from "@/components/ui/button";
import { useCLOBMarketWebSocket } from "@/hooks/use-clob-market-websocket";



export default function MarketItem(props: { market: Market }) {
	const market = props.market

	const [marketData, setMarketData] = useState<MarketData | null>(null)
	const [assetIds, setAssetIds] = useState<string[]>([])
	const assets = useRef<any>({})

	const [clobMarketWsStatus, setClobMarketWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
	// const [lastMarketLastTradePriceUpdate, setLastMarketLastTradePriceUpdate] = useState<CLOBLastTradePriceUpdate | null>(null)
	const [state, setState] = useState<MarketState>()

	// Countdown timer state
	// const timeRemaining = useTimer({ endDate: market?.marketData?.endDate || undefined })

	const [timeRemaining, setTimeRemaining] = useState<{
		minutes: number
		seconds: number
		isExpired: boolean
	} | null>(null)


	useEffect(() => {
		updateMarketState(market.state)
	}, [market.state])


	const setMarketState = (state: MarketState) => {
		market.state = state
		setState(state)
		PolymarketApi.cacheMarket(market as unknown as Market)
	}

	const updateMarketState = async (_state: MarketState) => {
		switch (_state){
			case 'init':		//market is initializing
				console.log('---init MarketItem:', market.slug, market)
				const _marketData = await fetchMarketBySlugFromGamma(market?.slug || '')
				console.log('marketData:', _marketData)
				market.marketData = _marketData as MarketData
				setMarketData(_marketData || null)
				setAssetIds(_marketData?.outcomes.map((outcome) => outcome.id) || [])
				clobMarketWs.updateAssetIds(assetIds)

				_marketData?.outcomes.forEach((outcome) => {
					assets.current[outcome.id] = outcome.title
				})

				let _state = PolymarketApi.getMarketState(market) as MarketState
				setMarketState(_state)
				return;

			case 'pending':		//wait till market starts
				PolymarketApi.onMarketTimer(market.startTimestamp || 0, (t) => {
					setTimeRemaining(t)
					if (t.isExpired) setMarketState('started')
				})
				return;

			case 'started':		//wait till market price is available
				const result = await PolymarketApi.pollingMarketPrice(market, 'openPrice')
				if (result) {
					console.log('---started MarketItem:', market.slug, market)
					market.openPrice = result.openPrice || null as unknown as number
					// setOpenPrice(market.openPrice)		//price to beat
					setMarketState('running')
				}
				return;

			case 'running':		//market is running
				PolymarketApi.onMarketTimer(market.endTimestamp || 0, (t) => {
					setTimeRemaining(t)
					if (t.isExpired) setMarketState('stopped')
				})
				return;

			case 'stopped':		//market is stopped
				disconnectMarket()
				const _result = await PolymarketApi.pollingMarketPrice(market, 'closePrice')
				if (_result) {
					market.closePrice = _result.closePrice || null as unknown as number
					// setClosePrice(market.closePrice)
					setMarketState('closed')
				}
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
			// console.log('clobMarketWs last trade price update', update)
			// setLastMarketLastTradePriceUpdate(update)
			setLastTradePrices((prev) => ({
				...prev,
				[update.asset_id]: {
					price: update.price,
					size: update.size,
					side: update.side,
					timestamp: update.timestamp,
					transaction_hash: update.transaction_hash
				}
			}))
market.trades.push({
	asset: assets.current[update.asset_id],
	price: update.price,
	size: update.size,
	side: update.side,
	timestamp: update.timestamp,
})

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

	function connectMarket() {
		if (clobMarketWs.status === 'connected' || market.state !== 'running') return;
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
				<div className='text-sm text-muted-foreground'>{marketData?.question}</div>
				<div className='text-sm text-muted-foreground'>{'slug: ' + marketData?.slug}</div>
				<div className='text-sm text-muted-foreground'>{'state: ' + market.state}</div>
				<div className='text-sm text-muted-foreground'>{timeRemaining?.minutes}m {timeRemaining?.seconds}s</div>
			</div>
			<div className='flex flex-col gap-2'>
				<div className='text-sm text-muted-foreground'>{'Price to beat: ' + (market.openPrice || (state === 'started'? 'pending...':'---'))}</div>
				<div className='text-sm text-muted-foreground'>{'Final price: ' + (market.closePrice || (state === 'stopped'? 'pending...' : '---'))}</div>
			</div>

			<div className='flex flex-col gap-2'>
				<div className='flex flex-row gap-2'>
				<Button variant='outline' onClick={clobMarketWsStatus === 'disconnected' ? connectMarket :
					disconnectMarket}>{clobMarketWsStatus === 'disconnected' ? 'Connect Market WebSockets' : 'Disconnect Market WebSockets'}</Button>
					<Button variant='outline' onClick={() => {
						PolymarketApi.cacheMarket(market as unknown as Market)
					}}>save market</Button>
				</div>
				<div className='text-sm text-muted-foreground'>{clobMarketWsStatus}</div>

				<div className='text-sm text-muted-foreground'>{'Up (' + lastTradePrices[assetIds[0]]?.side + '): ' + lastTradePrices[assetIds[0]]?.price}</div>
				<div className='text-sm text-muted-foreground'>{'Down (' + lastTradePrices[assetIds[1]]?.side + '): ' + lastTradePrices[assetIds[1]]?.price}</div>
			</div>
		</div>
	)
}


let interval: NodeJS.Timeout | null = null

// ---------------------------------------------------------------------------- useTimer
function useTimer(market: { endDate?: string }) {
	// Countdown timer state
	const [timeRemaining, setTimeRemaining] = useState<{
		minutes: number
		seconds: number
		isExpired: boolean
	} | null>(null)


	useEffect(() => {
		if (interval) clearInterval(interval)

		if (!market?.endDate) {
			setTimeRemaining({ minutes: 0, seconds: 0, isExpired: true })
			return
		}

		const updateCountdown = () => {
			const endDate = new Date(market.endDate!)
			const now = new Date()
			const diff = endDate.getTime() - now.getTime()

			if (diff <= 0) {
				setTimeRemaining({ minutes: 0, seconds: 0, isExpired: true })
				if (interval) clearInterval(interval)
				return
			}

			const minutes = Math.floor(diff / 60000)
			const seconds = Math.floor((diff % 60000) / 1000)
			setTimeRemaining({ minutes, seconds, isExpired: false })
		}

		// Update immediately
		updateCountdown()

		// Update every second
		interval = setInterval(updateCountdown, 1000)

		return () => {
			if (interval) clearInterval(interval)
			interval = null
		}
	}, [market?.endDate])

	return timeRemaining
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
