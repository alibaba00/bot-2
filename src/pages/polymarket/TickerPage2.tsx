import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRTDSWebSocket } from '@/hooks/use-rtds-websocket'
import type { CryptoPriceSource } from '@/lib/polymarket/rtds-websocket'
import { Wifi, WifiOff, Play, Square, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CryptoPrice {
	symbol: string
	value: number
	timestamp: number
	previousValue?: number
}

// Popular crypto symbols for Binance (lowercase, no separator)
const BINANCE_SYMBOLS = ['btcusdt', 'ethusdt', 'solusdt', 'xrpusdt', 'adausdt', 'dogeusdt']

// Popular crypto symbols for Chainlink (slash-separated)
const CHAINLINK_SYMBOLS = ['btc/usd', 'eth/usd', 'sol/usd', 'xrp/usd', 'ada/usd', 'doge/usd']

export default function TickerPage2() {
	const [prices, setPrices] = useState<Record<string, CryptoPrice>>({})
	const [source, setSource] = useState<CryptoPriceSource>('binance')
	const [selectedSymbols, setSelectedSymbols] = useState<string[]>(BINANCE_SYMBOLS.slice(0, 4))
	const [error, setError] = useState<string | null>(null)

	const ws = useRTDSWebSocket({
		source,
		symbols: selectedSymbols,
		onPriceUpdate: (update) => {
			setPrices((prev) => {
				const previous = prev[update.symbol]
				return {
					...prev,
					[update.symbol]: {
						...update,
						previousValue: previous?.value,
					},
				}
			})
			setError(null)
		},
		onError: (err) => {
			setError(err.message || 'WebSocket connection error')
		},
		autoConnect: false,
	})

	// Update symbols when source changes
	useEffect(() => {
		if (source === 'binance') {
			setSelectedSymbols(BINANCE_SYMBOLS.slice(0, 4))
		} else {
			setSelectedSymbols(CHAINLINK_SYMBOLS.slice(0, 4))
		}
	}, [source])

	// Note: The hook (useRTDSWebSocket) automatically handles updates to symbols and source
	// No need to manually call updateSymbols/updateSource here

	const handleConnect = () => {
		setError(null)
		ws.connect()
	}

	const handleDisconnect = () => {
		ws.disconnect()
	}

	const formatSymbol = (symbol: string): string => {
		// Format for display: btcusdt -> BTC/USDT, btc/usd -> BTC/USD
		if (symbol.includes('/')) {
			return symbol.toUpperCase()
		}
		// Split lowercase concatenated pairs
		const match = symbol.match(/^([a-z]+)(usdt|usd)$/i)
		if (match) {
			return `${match[1].toUpperCase()}/${match[2].toUpperCase()}`
		}
		return symbol.toUpperCase()
	}

	const formatPrice = (price: number): string => {
		if (price < 1) {
			return price.toFixed(4)
		}
		if (price < 100) {
			return price.toFixed(2)
		}
		return price.toLocaleString('en-US', { maximumFractionDigits: 2 })
	}

	const getPriceChange = (price: CryptoPrice): { change: number; percent: number } | null => {
		if (price.previousValue === undefined) return null
		const change = price.value - price.previousValue
		const percent = (change / price.previousValue) * 100
		return { change, percent }
	}

	const getStatusColor = (status: 'disconnected' | 'connecting' | 'connected') => {
		switch (status) {
			case 'connected':
				return 'text-green-500'
			case 'connecting':
				return 'text-yellow-500'
			default:
				return 'text-red-500'
		}
	}

	const getStatusIcon = (status: 'disconnected' | 'connecting' | 'connected') => {
		switch (status) {
			case 'connected':
				return <Wifi className="h-4 w-4" />
			default:
				return <WifiOff className="h-4 w-4" />
		}
	}

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 pt-0 pb-16">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Crypto Price Ticker</h1>
					<p className="text-muted-foreground mt-1">Real-time cryptocurrency prices from Polymarket RTDS</p>
				</div>
				<div className="flex items-center gap-4">
					{/* Source Selection */}
					<div className="flex items-center gap-2">
						<Button
							variant={source === 'binance' ? 'default' : 'outline'}
							size="sm"
							onClick={() => setSource('binance')}
							disabled={ws.status === 'connected'}
						>
							Binance
						</Button>
						<Button
							variant={source === 'chainlink' ? 'default' : 'outline'}
							size="sm"
							onClick={() => setSource('chainlink')}
							disabled={ws.status === 'connected'}
						>
							Chainlink
						</Button>
					</div>

					{/* Connection Status */}
					<div className={cn('flex items-center gap-2', getStatusColor(ws.status))}>
						{getStatusIcon(ws.status)}
						<span className="text-sm capitalize">{ws.status}</span>
					</div>

					{/* Connect/Disconnect Button */}
					{ws.status === 'disconnected' ? (
						<Button onClick={handleConnect} variant="default" size="sm">
							<Play className="h-4 w-4 mr-2" />
							Connect
						</Button>
					) : (
						<Button onClick={handleDisconnect} variant="destructive" size="sm">
							<Square className="h-4 w-4 mr-2" />
							Disconnect
						</Button>
					)}
				</div>
			</div>

			{/* Error Display */}
			{error && (
				<Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
					<CardContent className="pt-6">
						<div className="flex items-center gap-2 text-red-600 dark:text-red-400">
							<span className="font-medium">Error:</span>
							<span>{error}</span>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Price Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{selectedSymbols.map((symbol) => {
					const price = prices[symbol]
					const priceChange = price ? getPriceChange(price) : null
					const isPositive = priceChange && priceChange.change > 0

					return (
						<Card key={symbol} className="relative overflow-hidden">
							<CardHeader className="pb-3">
								<CardTitle className="text-lg">{formatSymbol(symbol)}</CardTitle>
								<CardDescription>
									{source === 'binance' ? 'Binance' : 'Chainlink'} Price Feed
								</CardDescription>
							</CardHeader>
							<CardContent>
								{price ? (
									<>
										<div className="flex items-baseline justify-between mb-2">
											<div className="text-3xl font-bold">
												${formatPrice(price.value)}
											</div>
											{priceChange && (
												<div
													className={cn(
														'flex items-center gap-1 text-sm font-medium',
														isPositive
															? 'text-green-600 dark:text-green-400'
															: 'text-red-600 dark:text-red-400'
													)}
												>
													{isPositive ? (
														<TrendingUp className="h-4 w-4" />
													) : (
														<TrendingDown className="h-4 w-4" />
													)}
													<span>
														{isPositive ? '+' : ''}
														{priceChange.percent.toFixed(2)}%
													</span>
												</div>
											)}
										</div>
										<div className="text-xs text-muted-foreground">
											Updated: {new Date(price.timestamp).toLocaleTimeString()}
										</div>
									</>
								) : (
									<div className="text-muted-foreground">
										{ws.status === 'connected' ? 'Waiting for data...' : 'Not connected'}
									</div>
								)}
							</CardContent>
						</Card>
					)
				})}
			</div>

			{/* Info Card */}
			<Card>
				<CardHeader>
					<CardTitle>Connection Info</CardTitle>
					<CardDescription>Real-time data from Polymarket RTDS</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-2 text-sm">
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Source:</span>
							<span className="font-medium capitalize">{source}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Status:</span>
							<span className={cn('font-medium capitalize', getStatusColor(ws.status))}>
								{ws.status}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Symbols:</span>
							<span className="font-medium">{selectedSymbols.length}</span>
						</div>
						{ws.lastPriceUpdate && (
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Last Update:</span>
								<span className="font-medium">
									{new Date(ws.lastPriceUpdate.timestamp).toLocaleTimeString()}
								</span>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
