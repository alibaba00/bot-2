

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type WsStatus = 'disconnected' | 'connecting' | 'connected'

export default function CoinbasePriceTicker({ symbol, onUpdate }:
	{ symbol: string, onUpdate?: (timestamp: number, price: number) => void }) {
	const lastPrice = useRef<number | null>(null)
	const [timestamp, setTimestamp] = useState<number | null>(null)
	const [isActive, setIsActive] = useState(false)
	const [status, setStatus] = useState<WsStatus>('disconnected')
	const wsRef = useRef<WebSocket | null>(null)
	

	const toggleTicker = () => {
		setIsActive((prev) => !prev)
	}


	useEffect(() => {
		if (!isActive) {
			wsRef.current?.close()
			wsRef.current = null
			setStatus('disconnected')
			return
		}

		setStatus('connecting')
		const ws = new WebSocket('wss://ws-feed.exchange.coinbase.com')
		wsRef.current = ws

		ws.onopen = () => {
			setStatus('connected')
			ws.send(
				JSON.stringify({
					type: 'subscribe',
					product_ids: [symbol],
					channels: ['ticker']
				})
			)
		}

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data as string)
				if (data?.type !== 'ticker' || data.product_id !== symbol || !data.price) return
				const parsedPrice = Number(data.price)
				if (parsedPrice === lastPrice.current || !Number.isFinite(parsedPrice)) return

				lastPrice.current = parsedPrice
				const parsedTimestamp = data.time ? Date.parse(data.time) : Date.now()
				onUpdate?.(parsedTimestamp, parsedPrice)
				setTimestamp(parsedTimestamp)

			} catch (error) {
				console.error('Coinbase message error:', error)
			}
		}

		ws.onerror = (error) => {
			console.error('Coinbase WebSocket error:', error)
			setStatus('disconnected')
		}

		ws.onclose = () => {
			setStatus('disconnected')
		}

		return () => {
			ws.close()
		}
	}, [isActive, symbol])

	const formatPrice = (value: number | null): string => {
		if (value === null) return '—'
		return new Intl.NumberFormat('en-US', {
			minimumFractionDigits: value >= 100 ? 2 : 4,
			maximumFractionDigits: value >= 100 ? 2 : 4
		}).format(value)
	}

	const formatTimestamp = (value: number | null): string => {
		if (!value) return ''
		return new Date(value).toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		})
	}

	return (
		<Card className='flex-1 min-w-80'>
			<CardHeader>
				<div className='flex items-center justify-between gap-3'>
					<CardTitle className='text-xl'>Coinbase {symbol}</CardTitle>
					<Button
						onClick={toggleTicker}
						variant={isActive ? 'destructive' : 'default'}
						size='sm'
						className='flex items-center gap-2'
					>
						<div
							className={`h-2 w-2 rounded-full ${
								status === 'connected' ? 'bg-green-500' : 'bg-gray-400'
							}`}
						/>
						{isActive ? 'Stop Coinbase' : 'Start Coinbase'}
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<div className='flex items-center justify-between rounded-lg border p-3'>
					<div className='flex flex-col'>
						<span className='text-sm font-medium text-muted-foreground'>Price</span>
						<span
							className={`text-2xl font-bold ${
								status === 'connected' && lastPrice.current !== 0
									? ''
									: 'text-muted-foreground opacity-60'
							}`}
						>
							{formatPrice(lastPrice.current)}
						</span>
						{timestamp && (
							<span className='text-xs text-muted-foreground'>
								{formatTimestamp(timestamp)}
							</span>
						)}
					</div>
					<div
						className={`h-3 w-3 rounded-full ${
							status === 'connected' && lastPrice.current !== 0
								? 'bg-green-500 animate-pulse'
								: 'bg-gray-300'
						}`}
					/>
				</div>
			</CardContent>
		</Card>
	)
}

/*
data example:
{
    "type": "ticker",
    "sequence": 120185477402,
    "product_id": "BTC-USD",
    "price": "89759.34",
    "open_24h": "87867.94",
    "volume_24h": "6798.34997364",
    "low_24h": "87180.01",
    "high_24h": "90059.94",
    "volume_30d": "228496.02885858",
    "best_bid": "89759.34",
    "best_bid_size": "0.02936817",
    "best_ask": "89759.35",
    "best_ask_size": "0.22734666",
    "side": "sell",
    "time": "2026-01-28T12:23:33.989119Z",
    "trade_id": 944696022,
    "last_size": "0.00042970"
}
*/