import { useEffect, useState } from "react";
import PolymarketApi from "./PolymarketApi";
import { fetchMarketBySlugFromGamma } from "@/lib/polymarket/markets";
import type { Market } from "@/lib/polymarket/types";
import { Button } from "@/components/ui/button";
import { useCLOBMarketWebSocket } from "@/hooks/use-clob-market-websocket";
import type { CLOBLastTradePriceUpdate, CLOBMarketPriceUpdate } from "@/lib/polymarket/clob-market-websocket";



export default function MarketItem(props: { market: { slug?: string; description?: string; marketData?: Market | null } }) {
	const market = props.market
	const priceToBeat = usePriceToBeat(market)
	// const finalPrice = useFinalPrice(market)
	const [marketData, setMarketData] = useState<Market | null>(null)
	const [assetIds, setAssetIds] = useState<string[]>([])
	const [clobMarketWsStatus, setClobMarketWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
	const [lastMarketPriceUpdate, setLastMarketPriceUpdate] = useState<CLOBMarketPriceUpdate | null>(null)
	// const [lastMarketLastTradePriceUpdate, setLastMarketLastTradePriceUpdate] = useState<CLOBLastTradePriceUpdate | null>(null)

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
		onPriceUpdate: (update) => {
			console.log('clobMarketWs price update', update)
			setLastMarketPriceUpdate(update)
		},
		onLastTradePriceUpdate: (update) => {
			console.log('clobMarketWs last trade price update', update)
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
		console.log('market:', market)

		fetchMarketBySlugFromGamma(market?.slug || '')
		.then((_marketData) => {
			console.log('marketData:', _marketData)
			market.marketData = _marketData as Market | null

			setMarketData(_marketData || null)
			setAssetIds(_marketData?.outcomes.map((outcome) => outcome.id) || [])
			clobMarketWs.updateAssetIds(assetIds)
		})
	}, [market])


	function connectMarket() {
		clobMarketWs.connect()
		console.log('clobMarketWs status', clobMarketWs.status)
	}

	function disconnectMarket() {
		clobMarketWs.disconnect()
		console.log('clobMarketWs status', clobMarketWs.status)
	}

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex flex-col gap-2'>
				<div className='text-sm text-muted-foreground'>{market.slug}</div>
			</div>
			<div className='flex flex-col gap-2'>
				<div className='text-sm text-muted-foreground'>{'Price to beat: ' + priceToBeat}</div>
				{/* <div className='text-sm text-muted-foreground'>{'Final price: ' + finalPrice}</div> */}
			</div>
			{marketData &&
			<div className='flex flex-col gap-2'>
				<Button variant='outline' onClick={clobMarketWsStatus === 'disconnected' ? connectMarket :
					disconnectMarket}>{clobMarketWsStatus === 'disconnected' ? 'Connect Market WebSockets' : 'Disconnect Market WebSockets'}</Button>
				<div className='text-sm text-muted-foreground'>{clobMarketWsStatus}</div>
				<div className='text-sm text-muted-foreground'>{'Up (' + lastTradePrices[assetIds[0]]?.side + '): ' + lastTradePrices[assetIds[0]]?.price}</div>
				<div className='text-sm text-muted-foreground'>{'Down (' + lastTradePrices[assetIds[1]]?.side + '): ' + lastTradePrices[assetIds[1]]?.price}</div>

				{/* <div className='text-sm text-muted-foreground'>{lastMarketPriceUpdate?.price}</div> */}
				{/* <div className='text-sm text-muted-foreground'>{lastMarketPriceUpdate?.size}</div> */}
				{/* <div className='text-sm text-muted-foreground'>{lastMarketPriceUpdate?.side}</div> */}
				{/* <div className='text-sm text-muted-foreground'>{lastMarketPriceUpdate?.best_bid}</div> */}
				{/* <div className='text-sm text-muted-foreground'>{lastMarketPriceUpdate?.best_ask}</div>	 */}
				{/* <div className='text-sm text-muted-foreground'>{lastMarketPriceUpdate?.hash}</div> */}
				{/* <div className='text-sm text-muted-foreground'>{lastTradePrices[assetIds[0]]?.price}</div> */}
				{/* <div className='text-sm text-muted-foreground'>{lastTradePrices[assetIds[0]]?.size}</div> */}
				{/* <div className='text-sm text-muted-foreground'>{lastTradePrices[assetIds[0]]?.side}</div> */}
				{/* <div className='text-sm text-muted-foreground'>{lastTradePrices[assetIds[0]]?.timestamp}</div> */}
				{/* <div className='text-sm text-muted-foreground'>{lastTradePrices[assetIds[0]]?.transaction_hash}</div> */}
				{/* <div className='text-sm text-muted-foreground'>{marketData.question}</div>
				<div className='text-sm text-muted-foreground'>{marketData.description}</div>
				<div className='text-sm text-muted-foreground'>{marketData.image}</div>
				<div className='text-sm text-muted-foreground'>{marketData.endDate}</div>
				<div className='text-sm text-muted-foreground'>{marketData.startDate}</div>
				<div className='text-sm text-muted-foreground'>{marketData.conditionId}</div>
				<div className='text-sm text-muted-foreground'>{marketData.marketMakerAddress}</div>
				<div className='text-sm text-muted-foreground'>{marketData.volume}</div>
				<div className='text-sm text-muted-foreground'>{marketData.liquidity}</div>
				<div className='text-sm text-muted-foreground'>{marketData.createdAt}</div>
				<div className='text-sm text-muted-foreground'>{marketData.updatedAt}</div>
				<div className='text-sm text-muted-foreground'>{marketData.outcomes.length}</div>
				<div className='text-sm text-muted-foreground'>{marketData.active ? 'active' : 'inactive'}</div>
				<div className='text-sm text-muted-foreground'>{marketData.closed ? 'closed' : 'open'}</div>
				<div className='text-sm text-muted-foreground'>{marketData.outcomes.map((outcome) => outcome.title).join(', ')}</div> */}
				</div>
			}
		</div>
	)
}


// ---------------------------------------------------------------------------- timeoutId
let timeoutId: NodeJS.Timeout | null = null


// ---------------------------------------------------------------------------- usePriceToBeat
function usePriceToBeat(market) {
	const [priceToBeat, setPriceToBeat] = useState('pending...')

	useEffect(() => {
		if (timeoutId) clearTimeout(timeoutId)
		console.log('usePriceToBeat', market.slug)

		async function fetchPriceToBeat() {
			const result = await PolymarketApi.getCryptoPrice(market)

			if (result?.openPrice) {
				market.openPrice = result.openPrice
				// await PolymarketApi.cacheMarket(market)
				setPriceToBeat(result.openPrice > 100 ? result.openPrice.toFixed(2) : result.openPrice)
				console.log('priceToBeat', market.openPrice)

			} else {
				timeoutId = setTimeout(() => fetchPriceToBeat(), 5000)
			}
		}
		fetchPriceToBeat()

		return () => {
			if (timeoutId) clearTimeout(timeoutId)
		}
	}, [market.slug])

	return priceToBeat
}


// ---------------------------------------------------------------------------- useFinalPrice
function useFinalPrice(market) {
	const [finalPrice, setFinalPrice] = useState('pending...')

	useEffect(() => {
		if (timeoutId) clearTimeout(timeoutId)
		console.log('useFinalPrice', market.slug)

		async function fetchFinalPrice() {
			const result = await PolymarketApi.getPriceToBeat(market)

			if (result?.finalPrice) {
				market.finalPrice = result.finalPrice
				setFinalPrice(result.finalPrice > 100 ? result.finalPrice.toFixed(2) : result.finalPrice)
			} else {
				timeoutId = setTimeout(() => fetchFinalPrice(), 5000)
			}
		}
		fetchFinalPrice()

		return () => {
			if (timeoutId) clearTimeout(timeoutId)
		}
	}, [market.slug])

	return finalPrice
}

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
