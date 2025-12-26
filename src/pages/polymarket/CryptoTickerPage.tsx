import { useRTDSWebSocket } from '@/hooks/use-rtds-websocket'
import { useEffect, useRef, useState } from 'react'
import MarketItem from './MarketItem'
import PolymarketApi from './PolymarketApi'
import { beep } from '@/lib/utils'


export default function CryptoTickerPage({ symbol }: { symbol: string }) {
	const [tickerPrice, setTickerPrice] = useState<{timestamp: number, price: number} | null>(null)
	const tickerActive = PolymarketApi.use('tickerActive')
	const timeoutId = useRef<NodeJS.Timeout | null>(null)


	// Convert symbol to Chainlink format (e.g., "btc" -> "btc/usd")
	const chainlinkSymbol = `${symbol.toLowerCase()}/usd`

	// Chainlink realtime price ticker
	const chainlinkWs = useRTDSWebSocket({
		source: 'chainlink',
		symbols: [chainlinkSymbol],
		onPriceUpdate: (update) => {
			if (update.symbol.toLowerCase() === chainlinkSymbol.toLowerCase()) {
				setTickerPrice({timestamp: update.timestamp, price: update.value})
				PolymarketApi.tickerPrices.set(symbol, {timestamp: update.timestamp, price: update.value})
			}
		},
		onError: (err) => {
			console.error('Chainlink WebSocket error:', err)
		},
		autoConnect: false
	})

	const resetTimer = () => {
		if (timeoutId.current) clearTimeout(timeoutId.current as any)
		if (!tickerActive) return

		timeoutId.current = setTimeout(async () => {	//15 seconds timeout of missing ticker price
			onTimeoutExpired()
		}, 15000)
	}

	const onTimeoutExpired = async () => {
		beep()
		chainlinkWs.disconnect()	//disconnect and reconnect to force a new connection
		await new Promise(resolve => setTimeout(resolve, 1000))	//wait 2 second before reconnecting
		chainlinkWs.connect()		//connect to get a new price
		resetTimer()
	}

	useEffect(() => {
		resetTimer()
		if (tickerPrice) {
			PolymarketApi.onTickerLog(symbol.toLowerCase(), tickerPrice.timestamp, tickerPrice.price)
		}
		return () => {	//cleanup timeout id on unmount
			if (timeoutId.current) clearTimeout(timeoutId.current as any)
		}
	}, [tickerPrice])


	useEffect(() => {
if (symbol === 'btc') console.log('---------------------useEffect tickerActive:', symbol, timeoutId)
		resetTimer()
		if (!tickerActive) chainlinkWs.disconnect()
		if (tickerActive && chainlinkWs.status === 'disconnected') chainlinkWs.connect()
	}, [tickerActive])


	// Format price for display
	const formatPrice = (price: number | null): string => {
		if (price === null) return 'Loading...'
		// Format as "12.345,67 USD"
		return new Intl.NumberFormat('de-DE', {
			minimumFractionDigits: price >= 100 ? 2 : 4,
			maximumFractionDigits: price >= 100 ? 2 : 4
		}).format(price)
	}

	const isConnected = chainlinkWs.status === 'connected'

	return (
		<div className='flex flex-1 flex-col gap-6 p-4 pt-0 pb-16'>
			<h1>Market {symbol.toUpperCase()}</h1>
			<h2>
				{formatPrice(tickerPrice?.price ?? null)}
				{tickerPrice?.timestamp && (
					<span className='text-sm text-muted-foreground'>
						$ ({new Date(tickerPrice.timestamp).toLocaleTimeString()})
					</span>
				)}
				{!isConnected && tickerPrice?.price === null && (
					<span className='text-sm text-muted-foreground ml-2'>
						(Click Start to begin)
					</span>
				)}
			</h2>

			<MarketItem symbol={symbol} type={'updown-15m'} minutes={15} offset={0} />

			{/* <MarketItem symbol={symbol} type={'updown-1h'} minutes={60} /> */}

			<MarketItem symbol={symbol} type={'updown-4h'} minutes={4 * 60} offset={3600} />

			{/* <div id='marketList'>
				{markets.map((market, index) => (
					<MarketItem key={index} market={market} />
				))}
			</div> */}
		</div>
	)
}
