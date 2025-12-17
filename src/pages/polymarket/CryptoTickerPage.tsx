import { useRTDSWebSocket } from '@/hooks/use-rtds-websocket'
import { useEffect, useRef, useState } from 'react'
import MarketItem from './MarketItem'
import PolymarketApi from './PolymarketApi'
import { beep } from '@/lib/utils'


var timeoutId: NodeJS.Timeout | null = null

export default function CryptoTickerPage({ symbol, type }: { symbol: string, type: string }) {
	const [tickerPrice, setTickerPrice] = useState<{timestamp: number, price: number} | null>(null)
	const tickerActive = PolymarketApi.use('tickerActive')
	
	// Convert symbol to Chainlink format (e.g., "btc" -> "btc/usd")
	const chainlinkSymbol = `${symbol.toLowerCase()}/usd`

	// Chainlink realtime price ticker
	const chainlinkWs = useRTDSWebSocket({
		source: 'chainlink',
		symbols: [chainlinkSymbol],
		onPriceUpdate: (update) => {
			if (update.symbol.toLowerCase() === chainlinkSymbol.toLowerCase()) {
				// setChainlinkPrice(update.value)
				// setPriceTimestamp(update.timestamp)
				setTickerPrice({timestamp: update.timestamp, price: update.value})
			}
		},
		onError: (err) => {
			console.error('Chainlink WebSocket error:', err)
		},
		autoConnect: false
	})


	useEffect(() => {
		if (timeoutId) clearTimeout(timeoutId)
		timeoutId = setTimeout(async () => {	//30 seconds timeout of missing ticker price
			beep()
			chainlinkWs.disconnect()	//disconnect and reconnect to force a new connection
			await new Promise(resolve => setTimeout(resolve, 1000))	//wait 1 second before reconnecting
			if (tickerActive) chainlinkWs.connect()		//connect to get a new price
		}, 30000)

		if (tickerPrice) {
			PolymarketApi.onTickerLog(symbol.toLowerCase(), tickerPrice.timestamp, tickerPrice.price)
		}
	}, [tickerPrice])


	useEffect(() => {
		if (timeoutId) clearTimeout(timeoutId)
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
			<div className='flex items-center justify-between'>
			<h1>Market {symbol.toUpperCase()}</h1>

				{/* <div className='flex items-center gap-2'>
					<Button
						onClick={toggleTicker}
						disabled={isConnecting}
						variant={isConnected ? 'destructive' : 'outline'}
						size='sm'>
						{isConnecting
							? 'Connecting...'
							: isConnected
								? 'Stop Ticker'
								: 'Start Ticker'}
					</Button>
					<Button
						onClick={() => PolymarketApi.set('tradingActive_' + symbol, !tradingActive)}
						disabled={isConnecting}
						variant={PolymarketApi.get('tradingActive_' + symbol) ? 'destructive' : 'outline'}
						size='sm'>
						{tradingActive ? 'Stop Trading' : 'Start Trading'}
					</Button>
				</div> */}

			</div>
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

			<MarketItem symbol={symbol} type={type} />

			{/* <div id='marketList'>
				{markets.map((market, index) => (
					<MarketItem key={index} market={market} />
				))}
			</div> */}
		</div>
	)
}
