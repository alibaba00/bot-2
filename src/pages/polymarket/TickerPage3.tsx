import { useEffect, useState, useCallback, useRef } from 'react'
import { useRTDSWebSocket } from '@/hooks/use-rtds-websocket'
import { useCryptoPricePoller } from '@/hooks/use-crypto-price-poller'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CryptoPriceUpdate } from '@/lib/polymarket/rtds-websocket'
import type { CryptoPriceUpdate as PollerPriceUpdate } from '@/lib/polymarket/crypto-price-poller'

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
	binance: { value: number; timestamp: number; source: 'websocket' | 'polling' } | null
	chainlink: { value: number; timestamp: number; source: 'websocket' | 'polling' } | null
}

export default function TickerPage3() {
	// Track which sources are active
	const [binanceActive, setBinanceActive] = useState(false)
	const [chainlinkActive, setChainlinkActive] = useState(false)

	// Track last update timestamps for health check
	const lastBinanceUpdateRef = useRef<Record<CryptoSymbol, number>>({
		BTC: 0,
		ETH: 0,
		SOL: 0,
		XRP: 0
	})
	const lastChainlinkUpdateRef = useRef<Record<CryptoSymbol, number>>({
		BTC: 0,
		ETH: 0,
		SOL: 0,
		XRP: 0
	})

	// Track if we're using polling fallback
	const [usingBinancePolling, setUsingBinancePolling] = useState(false)
	const [usingChainlinkPolling, setUsingChainlinkPolling] = useState(false)

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
				lastBinanceUpdateRef.current[config.symbol] = Date.now()
				// If we were using polling, switch back to WebSocket
				if (usingBinancePolling) {
					setUsingBinancePolling(false)
					binancePoller.stop()
				}
				setPrices((prev) => ({
					...prev,
					[config.symbol]: {
						...prev[config.symbol],
						binance: { value: update.value, timestamp: update.timestamp, source: 'websocket' }
					}
				}))
			}
		},
		onError: (err) => {
			console.error('Binance WebSocket error:', err)
		},
		autoConnect: false
	})

	// Binance Poller (fallback)
	const binancePoller = useCryptoPricePoller({
		source: 'binance',
		symbols: activeBinanceSymbols,
		onPriceUpdate: (update: PollerPriceUpdate) => {
			const config = CRYPTO_CONFIGS.find(
				(c) => c.binanceSymbol.toLowerCase() === update.symbol.toLowerCase()
			)
			if (config) {
				setPrices((prev) => ({
					...prev,
					[config.symbol]: {
						...prev[config.symbol],
						binance: { value: update.value, timestamp: update.timestamp, source: 'polling' }
					}
				}))
			}
		},
		onError: (err) => {
			console.error('Binance Poller error:', err)
		},
		autoStart: false
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
				lastChainlinkUpdateRef.current[config.symbol] = Date.now()
				// If we were using polling, switch back to WebSocket
				if (usingChainlinkPolling) {
					setUsingChainlinkPolling(false)
					chainlinkPoller.stop()
				}
				setPrices((prev) => ({
					...prev,
					[config.symbol]: {
						...prev[config.symbol],
						chainlink: { value: update.value, timestamp: update.timestamp, source: 'websocket' }
					}
				}))
			}
		},
		onError: (err) => {
			console.error('Chainlink WebSocket error:', err)
		},
		autoConnect: false
	})

	// Chainlink Poller (fallback)
	const chainlinkPoller = useCryptoPricePoller({
		source: 'chainlink',
		symbols: activeChainlinkSymbols,
		onPriceUpdate: (update: PollerPriceUpdate) => {
			const config = CRYPTO_CONFIGS.find(
				(c) => c.chainlinkSymbol.toLowerCase() === update.symbol.toLowerCase()
			)
			if (config) {
				setPrices((prev) => ({
					...prev,
					[config.symbol]: {
						...prev[config.symbol],
						chainlink: { value: update.value, timestamp: update.timestamp, source: 'polling' }
					}
				}))
			}
		},
		onError: (err) => {
			console.error('Chainlink Poller error:', err)
		},
		autoStart: false
	})

	// Update symbols when active tickers change (only if connected)
	useEffect(() => {
		if (binanceWs.status === 'connected') {
			binanceWs.updateSymbols(activeBinanceSymbols)
		}
		if (usingBinancePolling) {
			binancePoller.updateSymbols(activeBinanceSymbols)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeBinanceSymbols.join(',')])

	useEffect(() => {
		if (chainlinkWs.status === 'connected') {
			chainlinkWs.updateSymbols(activeChainlinkSymbols)
		}
		if (usingChainlinkPolling) {
			chainlinkPoller.updateSymbols(activeChainlinkSymbols)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeChainlinkSymbols.join(',')])

	// Health check: Monitor WebSocket updates and switch to polling if no updates for 30 seconds
	useEffect(() => {
		if (!binanceActive) return

		const healthCheckInterval = setInterval(() => {
			const now = Date.now()
			const timeout = 30000 // 30 seconds

			// Check if any active symbol hasn't received an update recently
			const hasStaleData = activeBinanceSymbols.some((symbol) => {
				const config = CRYPTO_CONFIGS.find((c) => c.binanceSymbol === symbol)
				if (!config) return false

				const lastUpdate = lastBinanceUpdateRef.current[config.symbol]
				// If WebSocket is connected but no updates for 30 seconds, consider it stale
				if (binanceWs.status === 'connected' && lastUpdate > 0) {
					return now - lastUpdate > timeout
				}
				// If WebSocket is disconnected, consider it stale
				return binanceWs.status === 'disconnected'
			})

			if (hasStaleData && !usingBinancePolling) {
				console.log('Binance WebSocket appears stale, switching to polling fallback')
				setUsingBinancePolling(true)
				binancePoller.start()
			} else if (!hasStaleData && usingBinancePolling && binanceWs.status === 'connected') {
				// WebSocket is working again, stop polling
				console.log('Binance WebSocket recovered, stopping polling fallback')
				setUsingBinancePolling(false)
				binancePoller.stop()
			}
		}, 5000) // Check every 5 seconds

		return () => clearInterval(healthCheckInterval)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [binanceActive, activeBinanceSymbols.join(','), binanceWs.status, usingBinancePolling])

	useEffect(() => {
		if (!chainlinkActive) return

		const healthCheckInterval = setInterval(() => {
			const now = Date.now()
			const timeout = 30000 // 30 seconds

			const hasStaleData = activeChainlinkSymbols.some((symbol) => {
				const config = CRYPTO_CONFIGS.find((c) => c.chainlinkSymbol === symbol)
				if (!config) return false

				const lastUpdate = lastChainlinkUpdateRef.current[config.symbol]
				if (chainlinkWs.status === 'connected' && lastUpdate > 0) {
					return now - lastUpdate > timeout
				}
				return chainlinkWs.status === 'disconnected'
			})

			if (hasStaleData && !usingChainlinkPolling) {
				console.log('Chainlink WebSocket appears stale, switching to polling fallback')
				setUsingChainlinkPolling(true)
				chainlinkPoller.start()
			} else if (!hasStaleData && usingChainlinkPolling && chainlinkWs.status === 'connected') {
				console.log('Chainlink WebSocket recovered, stopping polling fallback')
				setUsingChainlinkPolling(false)
				chainlinkPoller.stop()
			}
		}, 5000)

		return () => clearInterval(healthCheckInterval)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [chainlinkActive, activeChainlinkSymbols.join(','), chainlinkWs.status, usingChainlinkPolling])

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
			}
			if (usingBinancePolling) {
				binancePoller.stop()
				setUsingBinancePolling(false)
			}
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
			// Reset last update timestamps
			Object.keys(lastBinanceUpdateRef.current).forEach((key) => {
				lastBinanceUpdateRef.current[key as CryptoSymbol] = 0
			})
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
			}
			if (usingChainlinkPolling) {
				chainlinkPoller.stop()
				setUsingChainlinkPolling(false)
			}
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
			// Reset last update timestamps
			Object.keys(lastChainlinkUpdateRef.current).forEach((key) => {
				lastChainlinkUpdateRef.current[key as CryptoSymbol] = 0
			})
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
								binanceWs.status === 'connected'
									? 'bg-green-500'
									: usingBinancePolling
										? 'bg-yellow-500'
										: 'bg-gray-400'
							}`}
						/>
						{binanceActive
							? `Stop Binance${usingBinancePolling ? ' (Polling)' : ''}`
							: 'Start Binance'}
					</Button>
					<Button
						onClick={toggleChainlink}
						variant={chainlinkActive ? 'destructive' : 'default'}
						size='sm'
						className='flex items-center gap-2'
					>
						<div
							className={`h-2 w-2 rounded-full ${
								chainlinkWs.status === 'connected'
									? 'bg-green-500'
									: usingChainlinkPolling
										? 'bg-yellow-500'
										: 'bg-gray-400'
							}`}
						/>
						{chainlinkActive
							? `Stop Chainlink${usingChainlinkPolling ? ' (Polling)' : ''}`
							: 'Start Chainlink'}
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
												{priceData.binance?.source === 'polling' && (
													<span className='ml-2 text-xs text-yellow-600'>(Polling)</span>
												)}
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
													? priceData.binance.source === 'polling'
														? 'bg-yellow-500 animate-pulse'
														: 'bg-green-500 animate-pulse'
													: 'bg-gray-300'
											}`}
										/>
									</div>

									{/* Chainlink Price */}
									<div className='flex items-center justify-between rounded-lg border p-3'>
										<div className='flex flex-col'>
											<span className='text-sm font-medium text-muted-foreground'>
												Chainlink
												{priceData.chainlink?.source === 'polling' && (
													<span className='ml-2 text-xs text-yellow-600'>(Polling)</span>
												)}
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
													? priceData.chainlink.source === 'polling'
														? 'bg-yellow-500 animate-pulse'
														: 'bg-green-500 animate-pulse'
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
