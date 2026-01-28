

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type WsStatus = 'disconnected' | 'connecting' | 'connected'

export default function CoinbasePriceTicker({ symbol }: { symbol: string }) {
	const [price, setPrice] = useState<number | null>(null)
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
				if (!Number.isFinite(parsedPrice)) return
				const parsedTimestamp = data.time ? Date.parse(data.time) : Date.now()
				setPrice(parsedPrice)
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
		<Card>
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
								status === 'connected' && price !== null
									? ''
									: 'text-muted-foreground opacity-60'
							}`}
						>
							{formatPrice(price)}
						</span>
						{timestamp && (
							<span className='text-xs text-muted-foreground'>
								{formatTimestamp(timestamp)}
							</span>
						)}
					</div>
					<div
						className={`h-3 w-3 rounded-full ${
							status === 'connected' && price !== null
								? 'bg-green-500 animate-pulse'
								: 'bg-gray-300'
						}`}
					/>
				</div>
			</CardContent>
		</Card>
	)
}