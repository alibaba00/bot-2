import { useEffect, useState, useCallback } from 'react'
import { useRTDSWebSocket } from '@/hooks/use-rtds-websocket'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CryptoPriceUpdate } from '@/lib/polymarket/rtds-websocket'

type CryptoSymbol = 'BTC' | 'ETH' | 'SOL' | 'XRP'

interface CryptoConfig {
	symbol: CryptoSymbol
	binanceSymbol: string // e.g., "btcusdt"
	chainlinkSymbol: string // e.g., "btc/usd"
	displayName: string
}

const CRYPTO_CONFIGS: CryptoConfig[] = [
	{ symbol: 'BTC', binanceSymbol: 'btcusdt', chainlinkSymbol: 'btc/usd', displayName: 'Bitcoin' },
	{ symbol: 'ETH', binanceSymbol: 'ethusdt', chainlinkSymbol: 'eth/usd', displayName: 'Ethereum' },
	{ symbol: 'SOL', binanceSymbol: 'solusdt', chainlinkSymbol: 'sol/usd', displayName: 'Solana' },
	{ symbol: 'XRP', binanceSymbol: 'xrpusdt', chainlinkSymbol: 'xrp/usd', displayName: 'XRP' }
]

interface PriceData {
	binance: { value: number; timestamp: number } | null
	chainlink: { value: number; timestamp: number } | null
}

export default function TickerPage3() {
	// Track which sources are active
	const [binanceActive, setBinanceActive] = useState(false)
	const [chainlinkActive, setChainlinkActive] = useState(false)

	// Store prices for each crypto from both sources
	const [prices, setPrices] = useState<Record<CryptoSymbol, PriceData>>({
		BTC: { binance: null, chainlink: null },
		ETH: { binance: null, chainlink: null },
		SOL: { binance: null, chainlink: null },
		XRP: { binance: null, chainlink: null }
	})

	// Get all symbols for Binance (all 4 assets when active)
	const activeBinanceSymbols = binanceActive
		? CRYPTO_CONFIGS.map((config) => config.binanceSymbol)
		: []

	// Get all symbols for Chainlink (all 4 assets when active)
	const activeChainlinkSymbols = chainlinkActive
		? CRYPTO_CONFIGS.map((config) => config.chainlinkSymbol)
		: []

	// Binance WebSocket connection
	const binanceWs = useRTDSWebSocket({
		source: 'binance',
		symbols: activeBinanceSymbols,
		onPriceUpdate: (update: CryptoPriceUpdate) => {
			// Find which crypto this update belongs to
			const config = CRYPTO_CONFIGS.find(
				(c) => c.binanceSymbol.toLowerCase() === update.symbol.toLowerCase()
			)
			if (config) {
				setPrices((prev) => ({
					...prev,
					[config.symbol]: {
						...prev[config.symbol],
						binance: { value: update.value, timestamp: update.timestamp }
					}
				}))
			}
		},
		onError: (err) => {
			console.error('Binance WebSocket error:', err)
		},
		autoConnect: false
	})

	// Chainlink WebSocket connection
	const chainlinkWs = useRTDSWebSocket({
		source: 'chainlink',
		symbols: activeChainlinkSymbols,
		onPriceUpdate: (update: CryptoPriceUpdate) => {
			// Find which crypto this update belongs to
			const config = CRYPTO_CONFIGS.find(
				(c) => c.chainlinkSymbol.toLowerCase() === update.symbol.toLowerCase()
			)
			if (config) {
				setPrices((prev) => ({
					...prev,
					[config.symbol]: {
						...prev[config.symbol],
						chainlink: { value: update.value, timestamp: update.timestamp }
					}
				}))
			}
		},
		onError: (err) => {
			console.error('Chainlink WebSocket error:', err)
		},
		autoConnect: false
	})

	// Update symbols when active tickers change (only if connected)
	useEffect(() => {
		if (binanceWs.status === 'connected') {
			binanceWs.updateSymbols(activeBinanceSymbols)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeBinanceSymbols.join(',')])

	useEffect(() => {
		if (chainlinkWs.status === 'connected') {
			chainlinkWs.updateSymbols(activeChainlinkSymbols)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeChainlinkSymbols.join(',')])

	// Connect/disconnect WebSockets based on active sources
	useEffect(() => {
		if (binanceActive) {
			// Connect if disconnected
			if (binanceWs.status === 'disconnected') {
				binanceWs.connect()
			}
		} else {
			// Disconnect if not active
			if (binanceWs.status !== 'disconnected') {
				binanceWs.disconnect()
				// Clear all Binance prices
				setPrices((prev) => {
					const updated = { ...prev }
					Object.keys(updated).forEach((key) => {
						updated[key as CryptoSymbol] = {
							...updated[key as CryptoSymbol],
							binance: null
						}
					})
					return updated
				})
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [binanceActive])

	useEffect(() => {
		if (chainlinkActive) {
			// Connect if disconnected
			if (chainlinkWs.status === 'disconnected') {
				chainlinkWs.connect()
			}
		} else {
			// Disconnect if not active
			if (chainlinkWs.status !== 'disconnected') {
				chainlinkWs.disconnect()
				// Clear all Chainlink prices
				setPrices((prev) => {
					const updated = { ...prev }
					Object.keys(updated).forEach((key) => {
						updated[key as CryptoSymbol] = {
							...updated[key as CryptoSymbol],
							chainlink: null
						}
					})
					return updated
				})
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [chainlinkActive])

	// Toggle Binance source
	const toggleBinance = useCallback(() => {
		setBinanceActive((prev) => !prev)
	}, [])

	// Toggle Chainlink source
	const toggleChainlink = useCallback(() => {
		setChainlinkActive((prev) => !prev)
	}, [])

	// Format price for display
	const formatPrice = (price: number | null): string => {
		if (price === null) return '—'
		return new Intl.NumberFormat('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(price)
	}

	// Format timestamp
	const formatTimestamp = (timestamp: number | null): string => {
		if (!timestamp) return ''
		return new Date(timestamp).toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		})
	}

	return (
		<div className='flex flex-1 flex-col gap-6 p-4 pt-0 pb-16'>
			<div className='flex items-center justify-between'>
				<h1 className='text-2xl font-bold'>Crypto Price Ticker</h1>
				<div className='flex items-center gap-3'>
					<Button
						onClick={toggleBinance}
						variant={binanceActive ? 'destructive' : 'default'}
						size='sm'
						className='flex items-center gap-2'
					>
						<div
							className={`h-2 w-2 rounded-full ${
								binanceWs.status === 'connected' ? 'bg-green-500' : 'bg-gray-400'
							}`}
						/>
						{binanceActive ? 'Stop Binance' : 'Start Binance'}
					</Button>
					<Button
						onClick={toggleChainlink}
						variant={chainlinkActive ? 'destructive' : 'default'}
						size='sm'
						className='flex items-center gap-2'
					>
						<div
							className={`h-2 w-2 rounded-full ${
								chainlinkWs.status === 'connected' ? 'bg-green-500' : 'bg-gray-400'
							}`}
						/>
						{chainlinkActive ? 'Stop Chainlink' : 'Start Chainlink'}
					</Button>
				</div>
			</div>

			<div className='grid gap-4 md:grid-cols-2'>
				{CRYPTO_CONFIGS.map((config) => {
					const priceData = prices[config.symbol]

					return (
						<Card key={config.symbol}>
							<CardHeader>
								<CardTitle className='text-xl'>
									{config.displayName} ({config.symbol})
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className='space-y-4'>
									{/* Binance Price */}
									<div className='flex items-center justify-between rounded-lg border p-3'>
										<div className='flex flex-col'>
											<span className='text-sm font-medium text-muted-foreground'>
												Binance
											</span>
											<span className='text-2xl font-bold'>
												{formatPrice(priceData.binance?.value ?? null)}
											</span>
											{priceData.binance?.timestamp && (
												<span className='text-xs text-muted-foreground'>
													{formatTimestamp(priceData.binance.timestamp)}
												</span>
											)}
										</div>
										<div
											className={`h-3 w-3 rounded-full ${
												binanceActive && priceData.binance
													? 'bg-green-500 animate-pulse'
													: 'bg-gray-300'
											}`}
										/>
									</div>

									{/* Chainlink Price */}
									<div className='flex items-center justify-between rounded-lg border p-3'>
										<div className='flex flex-col'>
											<span className='text-sm font-medium text-muted-foreground'>
												Chainlink
											</span>
											<span className='text-2xl font-bold'>
												{formatPrice(priceData.chainlink?.value ?? null)}
											</span>
											{priceData.chainlink?.timestamp && (
												<span className='text-xs text-muted-foreground'>
													{formatTimestamp(priceData.chainlink.timestamp)}
												</span>
											)}
										</div>
										<div
											className={`h-3 w-3 rounded-full ${
												chainlinkActive && priceData.chainlink
													? 'bg-green-500 animate-pulse'
													: 'bg-gray-300'
											}`}
										/>
									</div>

									{/* Price Difference */}
									{priceData.binance && priceData.chainlink && (
										<div className='rounded-lg bg-muted p-2 text-center'>
											<span className='text-xs text-muted-foreground'>Difference</span>
											<div className='text-sm font-medium'>
												{(
													((priceData.binance.value - priceData.chainlink.value) /
														priceData.chainlink.value) *
													100
												).toFixed(4)}
												%
											</div>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					)
				})}
			</div>
		</div>
	)
}
