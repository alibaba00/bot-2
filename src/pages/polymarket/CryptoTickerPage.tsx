import { useEffect, useState } from 'react'
import MarketItem from './MarketItem'
import PolymarketApi from './PolymarketApi'
import type { Market } from '@/lib/polymarket/types'
import { useRTDSWebSocket } from '@/hooks/use-rtds-websocket'
import { Button } from '@/components/ui/button'
import PolymarketStore from './PolymarketStore'


export default function CryptoTickerPage({ symbol, type }: { symbol: string, type: string }) {
	// const [market, setMarket] = useState<Market | null>(null)
	// const [markets, setMarkets] = useState<Market[]>([])
	// const [chainlinkPrice, setChainlinkPrice] = useState<number | null>(null)
	// const [priceTimestamp, setPriceTimestamp] = useState<number | null>(null)
	const [tickerPrice, setTickerPrice] = useState<{timestamp: number, price: number} | null>(null)
	const tradingActive = PolymarketStore.use('tradingActive_' + symbol)

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
		if (tickerPrice) {
			PolymarketApi.onTickerLog(symbol.toLowerCase(), tickerPrice.timestamp, tickerPrice.price)
		}
	}, [tickerPrice])


	// Toggle ticker connection
	const toggleTicker = () => {
		if (chainlinkWs.status === 'connected') {
			chainlinkWs.disconnect()
		} else {
			chainlinkWs.connect()
		}
	}

	// Format price for display
	const formatPrice = (price: number | null): string => {
		if (price === null) return 'Loading...'
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(price)
	}

	const isConnected = chainlinkWs.status === 'connected'
	const isConnecting = chainlinkWs.status === 'connecting'

	return (
		<div className='flex flex-1 flex-col gap-6 p-4 pt-0 pb-16'>
			<div className='flex items-center justify-between'>
			<h1>Ticker {symbol.toUpperCase()}</h1>
			<div className='flex items-center gap-2'>
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
					onClick={() => PolymarketStore.set('tradingActive_' + symbol, !tradingActive)}
					disabled={isConnecting}
					variant={PolymarketStore.get('tradingActive_' + symbol) ? 'destructive' : 'outline'}
					size='sm'>
					{tradingActive ? 'Stop Trading' : 'Start Trading'}
				</Button>
			</div>
			</div>
			<h2>
				{formatPrice(tickerPrice?.price ?? null)}
				{tickerPrice?.timestamp && (
					<span className='text-sm text-muted-foreground ml-2'>
						({new Date(tickerPrice.timestamp).toLocaleTimeString()})
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
