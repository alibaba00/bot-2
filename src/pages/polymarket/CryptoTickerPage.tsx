import { useEffect, useState } from 'react'
import MarketItem from './MarketItem'
import PolymarketApi from './PolymarketApi'
import type { MarketData } from '@/lib/polymarket/types'
import { useRTDSWebSocket } from '@/hooks/use-rtds-websocket'
import { Button } from '@/components/ui/button'

export default function CryptoTickerPage({ symbol, type }: { symbol: string, type: string }) {
	// const [market, setMarket] = useState<Market | null>(null)
	const [markets, setMarkets] = useState<MarketData[]>([])
	const [chainlinkPrice, setChainlinkPrice] = useState<number | null>(null)
	const [priceTimestamp, setPriceTimestamp] = useState<number | null>(null)

	// Convert symbol to Chainlink format (e.g., "btc" -> "btc/usd")
	const chainlinkSymbol = `${symbol.toLowerCase()}/usd`

	// Chainlink realtime price ticker
	const chainlinkWs = useRTDSWebSocket({
		source: 'chainlink',
		symbols: [chainlinkSymbol],
		onPriceUpdate: (update) => {
			if (update.symbol.toLowerCase() === chainlinkSymbol.toLowerCase()) {
				setChainlinkPrice(update.value)
				setPriceTimestamp(update.timestamp)
			}
		},
		onError: (err) => {
			console.error('Chainlink WebSocket error:', err)
		},
		autoConnect: false
	})

	useEffect(() => {
		console.log('---init CryptoTickerPage---', symbol, type)

		PolymarketApi.initMarket(symbol, type)
		.then((market) => {
			console.log('market', market)
			setMarkets([market as unknown as MarketData])
		})
		// setMarket(market)
		// setMarkets([market as Market])

		// Cleanup on unmount
		return () => {
			chainlinkWs.disconnect()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [symbol])

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
				<Button
					onClick={toggleTicker}
					disabled={isConnecting}
					variant={isConnected ? 'destructive' : 'default'}
					size='sm'>
					{isConnecting
						? 'Connecting...'
						: isConnected
							? 'Stop'
							: 'Start'}
				</Button>
			</div>
			<h2>
				{formatPrice(chainlinkPrice)}
				{priceTimestamp && (
					<span className='text-sm text-muted-foreground ml-2'>
						({new Date(priceTimestamp).toLocaleTimeString()})
					</span>
				)}
				{!isConnected && chainlinkPrice === null && (
					<span className='text-sm text-muted-foreground ml-2'>
						(Click Start to begin)
					</span>
				)}
			</h2>
			<div id='marketList'>
				{markets.map((market, index) => (
					<MarketItem key={index} market={market} />
				))}
			</div>
		</div>
	)
}
