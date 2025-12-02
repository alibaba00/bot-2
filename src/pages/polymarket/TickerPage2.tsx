import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRTDSWebSocket } from '@/hooks/use-rtds-websocket'
import { useRTDSMarketWebSocket } from '@/hooks/use-rtds-market-websocket'
import { usePolymarketWebSocket } from '@/hooks/use-polymarket-websocket'
import { useCLOBMarketWebSocket } from '@/hooks/use-clob-market-websocket'
import {
	fetchMarketBySlugFromGamma,
	fetchMarketPricesFromClob,
	fetchCryptoPriceToBeat
} from '@/lib/polymarket/markets'
import type { Market } from '@/lib/polymarket/types'
import type { CryptoPriceSource } from '@/lib/polymarket/rtds-websocket'
import { WS_URLS } from '@/lib/polymarket/websocket'
import { Wifi, WifiOff, Play, Square, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
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

// Function to get the current 15-minute UTC timestamp (rounded down to nearest 15-minute interval)
function getCurrent15MinuteUTCTimestamp(): number {
	const now = Date.now() // Current time in milliseconds
	const nowSeconds = Math.floor(now / 1000) // Convert to seconds
	const fifteenMinutes = 15 * 60 // 15 minutes in seconds (900)
	// Round down to the nearest 15-minute interval
	return Math.floor(nowSeconds / fifteenMinutes) * fifteenMinutes
}

// Default Bitcoin market slug - dynamically generated based on current 15-minute UTC timestamp
function getDefaultBTCMarketSlug(): string {
	const timestamp = getCurrent15MinuteUTCTimestamp()
	console.log('Default Bitcoin market slug:', `btc-updown-15m-${timestamp}`)
	return `btc-updown-15m-${timestamp}`
}

export default function TickerPage2() {
	// Crypto prices state (RTDS)
	const [prices, setPrices] = useState<Record<string, CryptoPrice>>({})
	const [source, setSource] = useState<CryptoPriceSource>('binance')
	const [selectedSymbols, setSelectedSymbols] = useState<string[]>(BINANCE_SYMBOLS.slice(0, 4))
	const [cryptoError, setCryptoError] = useState<string | null>(null)

	// Market ticker state (CLOB)
	const [market, setMarket] = useState<Market | null>(null)
	const [marketLoading, setMarketLoading] = useState(true)
	const [marketError, setMarketError] = useState<string | null>(null)
	const [marketPrices, setMarketPrices] = useState<
		Record<string, { price: number; timestamp: number }>
	>({})
	const [assetIds, setAssetIds] = useState<string[]>([])
	const [useMarketPolling, setUseMarketPolling] = useState(false) // Don't start polling automatically
	const [pollingInterval, setPollingInterval] = useState(1000) // Default: 1 second for real-time updates

	// Activity update prices from orders_matched events
	const [activityPrices, setActivityPrices] = useState<{
		up?: { price: number; timestamp: number }
		down?: { price: number; timestamp: number }
	}>({})

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

	// Price to beat (reference price for crypto up/down markets)
	const [priceToBeat, setPriceToBeat] = useState<number | null>(null)
	const [priceToBeatLoading, setPriceToBeatLoading] = useState(false)

	// RTDS WebSocket for crypto prices
	const cryptoWs = useRTDSWebSocket({
		source,
		symbols: selectedSymbols,
		onPriceUpdate: (update) => {
			setPrices((prev) => {
				const previous = prev[update.symbol]
				return {
					...prev,
					[update.symbol]: {
						...update,
						previousValue: previous?.value
					}
				}
			})
			setCryptoError(null)
		},
		onError: (err) => {
			setCryptoError(err.message || 'Crypto WebSocket connection error')
		},
		autoConnect: false
	})

	// RTDS Market WebSocket (uses same URL as crypto prices - wss://ws-live-data.polymarket.com)
	// Only pass values when market is loaded to avoid multiple subscriptions
	const rtdsMarketWs = useRTDSMarketWebSocket({
		conditionIds: market?.conditionId ? [market.conditionId] : [],
		assetIds: assetIds.length > 0 ? assetIds : [],
		eventSlugs: market?.slug ? [market.slug] : [], // Use market slug for activity subscription (like Polymarket website)
		onPriceUpdate: (update) => {
			// Map RTDS market update to our price format
			const assetId = update.asset_id || update.token_id
			if (assetId) {
				console.log('RTDS Market: 💰 Price update received:', {
					assetId,
					price: update.price,
					update
				})
				setMarketPrices((prev) => ({
					...prev,
					[assetId]: {
						price: update.price,
						timestamp: update.timestamp
					}
				}))
				setMarketError(null)
			} else {
				console.warn('RTDS Market: ⚠️ Price update without asset_id:', update)
			}
		},
		onActivityUpdate: (update) => {
			// Log activity updates for debugging
			// console.log('RTDS Market: 📊 Activity update (orders_matched):', update)

			// Extract price and outcome from activity update
			if (update && typeof update === 'object') {
				const price = update.price
				const outcome = update.outcome
				// Timestamp from payload is in seconds (Unix timestamp), convert to milliseconds for consistency
				const timestamp = update.timestamp
					? update.timestamp < 10000000000
						? update.timestamp * 1000
						: update.timestamp // Convert seconds to ms if needed
					: Date.now()

				if (price !== undefined && typeof price === 'number') {
					// Determine if this is Up or Down based on outcome field
					const isUp =
						outcome &&
						(outcome.toString().toUpperCase().includes('UP') ||
							outcome.toString().toUpperCase().includes('YES'))
					const isDown = outcome && outcome.toString().toUpperCase().includes('DOWN')

					setActivityPrices((prev) => {
						const updated = { ...prev }
						if (isUp) {
							updated.up = { price, timestamp }
						} else if (isDown) {
							updated.down = { price, timestamp }
						}
						return updated
					})

					// Also update marketPrices with the asset ID if available
					if (update.asset) {
						setMarketPrices((prev) => ({
							...prev,
							[update.asset]: {
								price,
								timestamp
							}
						}))
					}
				}
			}
		},
		onError: (err) => {
			setMarketError(err.message || 'RTDS Market WebSocket connection error')
		},
		autoConnect: false
	})

	// CLOB WebSocket for market ticker (legacy - doesn't work)
	const marketWs = usePolymarketWebSocket({
		assetIds,
		wsUrl: WS_URLS[0],
		onPriceUpdate: (update) => {
			setMarketPrices((prev) => ({
				...prev,
				[update.asset_id]: {
					price: update.price,
					timestamp: update.timestamp
				}
			}))
			setMarketError(null)
		},
		onError: (err) => {
			setMarketError(err.message || 'Market WebSocket connection error')
		},
		autoConnect: false
	})

	// CLOB Market WebSocket (wss://ws-subscriptions-clob.polymarket.com/ws/market)
	// Uses asset IDs (from market outcomes), not market addresses
	// Use useRef to store current assetIds to avoid closure issues
	const assetIdsRef = useRef<string[]>([])
	useEffect(() => {
		assetIdsRef.current = assetIds
	}, [assetIds])

	const clobMarketWs = useCLOBMarketWebSocket({
		assetIds: assetIds.length > 0 ? assetIds : [],
		onPriceUpdate: (update) => {
			// Use ref to get current assetIds (avoids closure issue)
			const currentAssetIds = assetIdsRef.current

			// Nur aktualisieren, wenn die Asset-ID zu unserem aktuellen Markt gehört
			if (!currentAssetIds.includes(update.asset_id)) {
				return // Ignoriere Updates für andere Assets
			}

			// console.log('CLOB Market: 💰 Price update received:', {
			// 	asset_id: update.asset_id,
			// 	price: update.price,
			// 	side: update.side,
			// 	best_bid: update.best_bid,
			// 	best_ask: update.best_ask,
			// })

			setMarketPrices((prev) => ({
				...prev,
				[update.asset_id]: {
					price: update.price,
					timestamp: update.timestamp
				}
			}))
			setMarketError(null)
		},
		onLastTradePriceUpdate: (update) => {
			// Use ref to get current assetIds (avoids closure issue)
			const currentAssetIds = assetIdsRef.current

			// Nur aktualisieren, wenn die Asset-ID zu unserem aktuellen Markt gehört
			if (!currentAssetIds.includes(update.asset_id)) {
				return // Ignoriere Updates für andere Assets
			}

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
			setMarketError(err.message || 'CLOB Market WebSocket connection error')
		},
		autoConnect: false
	})

	// Load market on mount
	useEffect(() => {
		async function loadMarket() {
			try {
				setMarketLoading(true)
				setMarketError(null)

				const defaultSlug = getDefaultBTCMarketSlug()
				const marketData = await fetchMarketBySlugFromGamma(defaultSlug)
				if (marketData && marketData.id && marketData.question) {
					setMarket(marketData)
					// Extract asset IDs from outcomes
					const ids = marketData.outcomes.map((outcome) => outcome.id).filter(Boolean)
					setAssetIds(ids)

					// Initialize market prices with current prices
					const initialPrices: Record<string, { price: number; timestamp: number }> = {}
					marketData.outcomes.forEach((outcome) => {
						if (outcome.id) {
							initialPrices[outcome.id] = {
								price: outcome.price,
								timestamp: Date.now()
							}
						}
					})
					setMarketPrices(initialPrices)

					// Fetch price to beat for crypto up/down markets
					// Extract symbol and timestamps from slug (e.g., "btc-updown-15m-1764509400")
					// IMPORTANT: Use timestamps from slug, not from market data!
					// The slug timestamp represents the start of the 15-minute window
					const slugMatch = defaultSlug.match(/^([a-z]+)-updown-15m-(\d+)$/i)
					console.log('🔍 Price to Beat Debug:', {
						slug: defaultSlug,
						slugMatch: slugMatch ? 'matched' : 'no match',
						slugTimestamp: slugMatch ? slugMatch[2] : null
					})

					if (slugMatch) {
						const symbol = slugMatch[1].toUpperCase() // e.g., "BTC"

						// Calculate timestamps directly from slug (like the website does)
						// The slug timestamp is in seconds (Unix timestamp)
						const slugTimestamp = parseInt(slugMatch[2], 10)
						const startTimestamp = slugTimestamp * 1000 // Convert to milliseconds
						const endTimestamp = startTimestamp + 15 * 60 * 1000 // Add 15 minutes

						// Format as ISO strings (UTC)
						const eventStartTime = new Date(startTimestamp).toISOString()
						const endDate = new Date(endTimestamp).toISOString()

						console.log('📊 Fetching price to beat (using slug timestamps):', {
							symbol,
							slugTimestamp,
							eventStartTime,
							endDate,
							variant: 'fifteen'
						})

						setPriceToBeatLoading(true)
						try {
							const priceToBeatValue = await fetchCryptoPriceToBeat(
								symbol,
								eventStartTime,
								endDate,
								'fifteen'
							)
							console.log('✅ Price to beat received:', priceToBeatValue)
							setPriceToBeat(priceToBeatValue)
						} catch (error) {
							console.warn('❌ Failed to fetch price to beat:', error)
							setPriceToBeat(null)
						} finally {
							setPriceToBeatLoading(false)
						}
					} else {
						console.log(
							'⚠️ Slug does not match crypto up/down pattern, skipping price to beat fetch'
						)
					}
				} else {
					setMarketError('Market not found. Please check if the market is active.')
				}
			} catch (error) {
				console.error('Error loading market:', error)
				setMarketError(error instanceof Error ? error.message : 'Failed to load market')
			} finally {
				setMarketLoading(false)
			}
		}

		loadMarket()
	}, [])

	// Polling fallback for market prices (since WebSocket doesn't work)
	useEffect(() => {
		if (!useMarketPolling || !market || !market.conditionId) return

		let pollCount = 0
		let useClobApi = true

		const pollPrices = async () => {
			try {
				pollCount++
				// Only log every 10th attempt to reduce console spam
				if (pollCount % 10 === 1) {
					console.log(
						`🔄 Polling market prices (attempt ${pollCount}, using ${useClobApi ? 'CLOB' : 'Gamma'} API, interval: ${pollingInterval}ms)...`
					)
				}

				let newPriceData: Record<string, { price: number; timestamp: number }> = {}

				// Try CLOB API first for real-time prices (faster than Gamma)
				if (useClobApi && market.conditionId) {
					try {
						const clobPrices = await fetchMarketPricesFromClob(market.conditionId)
						if (clobPrices && Object.keys(clobPrices).length > 0) {
							market.outcomes.forEach((outcome) => {
								const price = clobPrices[outcome.id]
								if (price !== undefined) {
									newPriceData[outcome.id] = {
										price: price,
										timestamp: Date.now()
									}
								}
							})

							if (Object.keys(newPriceData).length > 0) {
								setMarketPrices((prevPriceData) => {
									return { ...prevPriceData, ...newPriceData }
								})
								setMarketError(null)
								return
							}
						}
					} catch (clobError) {
						// Only log error occasionally to reduce spam
						if (pollCount % 10 === 1) {
							console.warn(
								'⚠️ CLOB API polling failed, falling back to Gamma API:',
								clobError
							)
						}
						useClobApi = false
					}
				}

				// Fallback to Gamma API (slower, but more reliable)
				if (!useClobApi || Object.keys(newPriceData).length === 0) {
					const updatedMarket = await fetchMarketBySlugFromGamma(market.slug || '')
					if (updatedMarket && updatedMarket.outcomes) {
						setMarketPrices((prevPriceData) => {
							const gammaPriceData: Record<
								string,
								{ price: number; timestamp: number }
							> = {}

							updatedMarket.outcomes.forEach((outcome) => {
								if (outcome.id) {
									gammaPriceData[outcome.id] = {
										price: outcome.price,
										timestamp: Date.now()
									}
								}
							})

							return { ...prevPriceData, ...gammaPriceData }
						})
						setMarketError(null)
					}
				}
			} catch (error) {
				// Only log error occasionally
				if (pollCount % 10 === 1) {
					console.error('❌ Error polling market prices:', error)
				}
				setMarketError('Failed to fetch market prices')
			}
		}

		// Poll with configurable interval (default: 1 second for real-time)
		const interval = setInterval(pollPrices, pollingInterval)
		pollPrices() // Initial fetch

		return () => {
			clearInterval(interval)
		}
	}, [useMarketPolling, market, pollingInterval])

	// Update symbols when source changes
	useEffect(() => {
		if (source === 'binance') {
			setSelectedSymbols(BINANCE_SYMBOLS.slice(0, 4))
		} else {
			setSelectedSymbols(CHAINLINK_SYMBOLS.slice(0, 4))
		}
	}, [source])

	const handleCryptoConnect = () => {
		setCryptoError(null)
		cryptoWs.connect()
	}

	const handleCryptoDisconnect = () => {
		cryptoWs.disconnect()
	}

	const handleMarketConnect = () => {
		setMarketError(null)
		setUseMarketPolling(false) // Disable polling when using WebSocket
		if (assetIds.length > 0 || (market && market.conditionId)) {
			// Try RTDS Market WebSocket first (same URL as crypto, might work)
			rtdsMarketWs.connect()
		} else {
			setMarketError(
				'No asset IDs or condition ID available. Please wait for market to load.'
			)
		}
	}

	const handleMarketDisconnect = () => {
		console.log('🛑 User requested disconnect - stopping WebSocket')
		rtdsMarketWs.disconnect()
		marketWs.disconnect() // Also disconnect CLOB WS if connected
		clobMarketWs.disconnect() // Disconnect CLOB Market WS
		// Don't automatically enable polling - let user choose
	}

	const handleCLOBMarketConnect = () => {
		setMarketError(null)
		setUseMarketPolling(false) // Disable polling when using WebSocket
		if (assetIds.length > 0) {
			clobMarketWs.connect()
		} else {
			setMarketError('No asset IDs available. Please wait for market to load.')
		}
	}

	const handleCLOBMarketDisconnect = () => {
		console.log('🛑 User requested disconnect - stopping CLOB Market WebSocket')
		clobMarketWs.disconnect()
	}

	const handleStartPolling = () => {
		setMarketError(null)
		setUseMarketPolling(true)
		marketWs.disconnect() // Make sure WebSocket is stopped
	}

	const handleStopPolling = () => {
		setUseMarketPolling(false)
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
				return <Wifi className='h-4 w-4' />
			default:
				return <WifiOff className='h-4 w-4' />
		}
	}

	const formatMarketPrice = (price: number): string => {
		return (price * 100).toFixed(2) + '%'
	}

	return (
		<div className='flex flex-1 flex-col gap-6 p-4 pt-0 pb-16'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-3xl font-bold'>Real-Time Ticker</h1>
					<p className='text-muted-foreground mt-1'>
						Crypto prices (RTDS) & Market ticker (CLOB)
					</p>
				</div>
			</div>

			{/* Market Ticker Section */}
			<Card>
				<CardHeader>
					<div className='flex items-center justify-between'>
						<div>
							<CardTitle>Market Ticker (RTDS & CLOB WebSocket)</CardTitle>
							<CardDescription>
								{market ? market.question : 'Loading market...'}
								<br />
								<span className='text-xs'>
									RTDS: wss://ws-live-data.polymarket.com | CLOB:
									wss://ws-subscriptions-clob.polymarket.com/ws/market
								</span>
							</CardDescription>
						</div>
						<div className='flex items-center gap-4'>
							{/* RTDS Market WebSocket Status */}
							<div
								className={cn(
									'flex items-center gap-2',
									getStatusColor(rtdsMarketWs.status)
								)}>
								{getStatusIcon(rtdsMarketWs.status)}
								<span className='text-sm capitalize'>
									RTDS WS: {rtdsMarketWs.status}
								</span>
							</div>

							{/* CLOB Market WebSocket Status */}
							<div
								className={cn(
									'flex items-center gap-2',
									getStatusColor(clobMarketWs.status)
								)}>
								{getStatusIcon(clobMarketWs.status)}
								<span className='text-sm capitalize'>
									CLOB WS: {clobMarketWs.status}
								</span>
							</div>

							{/* RTDS WebSocket Controls */}
							{rtdsMarketWs.status === 'disconnected' ? (
								<Button
									onClick={handleMarketConnect}
									variant='default'
									size='sm'
									disabled={
										(assetIds.length === 0 && !market?.conditionId) ||
										marketLoading ||
										useMarketPolling
									}>
									<Play className='h-4 w-4 mr-2' />
									Use RTDS WS
								</Button>
							) : (
								<Button
									onClick={handleMarketDisconnect}
									variant='destructive'
									size='sm'>
									<Square className='h-4 w-4 mr-2' />
									Stop RTDS WS
								</Button>
							)}

							{/* CLOB Market WebSocket Controls */}
							{clobMarketWs.status === 'disconnected' ? (
								<Button
									onClick={handleCLOBMarketConnect}
									variant='default'
									size='sm'
									disabled={
										assetIds.length === 0 || marketLoading || useMarketPolling
									}>
									<Play className='h-4 w-4 mr-2' />
									Use CLOB WS
								</Button>
							) : (
								<Button
									onClick={handleCLOBMarketDisconnect}
									variant='destructive'
									size='sm'>
									<Square className='h-4 w-4 mr-2' />
									Stop CLOB WS
								</Button>
							)}

							{/* Polling Controls */}
							{!useMarketPolling ? (
								<div className='flex items-center gap-2'>
									<Button
										onClick={handleStartPolling}
										variant='default'
										size='sm'
										disabled={marketLoading}>
										<Play className='h-4 w-4 mr-2' />
										Use Polling
									</Button>
									<select
										value={pollingInterval}
										onChange={(e) => setPollingInterval(Number(e.target.value))}
										className='text-sm border rounded px-2 py-1 bg-background'
										disabled={useMarketPolling}>
										<option value={500}>500ms</option>
										<option value={1000}>1s</option>
										<option value={2000}>2s</option>
										<option value={3000}>3s</option>
									</select>
								</div>
							) : (
								<div className='flex items-center gap-2'>
									<span className='text-sm text-muted-foreground'>
										Polling ({pollingInterval}ms)
									</span>
									<select
										value={pollingInterval}
										onChange={(e) => setPollingInterval(Number(e.target.value))}
										className='text-sm border rounded px-2 py-1 bg-background'>
										<option value={500}>500ms</option>
										<option value={1000}>1s</option>
										<option value={2000}>2s</option>
										<option value={3000}>3s</option>
									</select>
									<Button onClick={handleStopPolling} variant='outline' size='sm'>
										<Square className='h-4 w-4 mr-2' />
										Stop
									</Button>
								</div>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{marketLoading ? (
						<Skeleton className='h-32 w-full' />
					) : marketError ? (
						<div className='flex items-center gap-2 text-red-600 dark:text-red-400'>
							<AlertCircle className='h-4 w-4' />
							<span>{marketError}</span>
						</div>
					) : market ? (
						<div className='space-y-4'>
							{/* Display Price to Beat - Show for crypto up/down markets */}
							{market.slug.match(/^([a-z]+)-updown-15m-(\d+)$/i) && (
								<Card className='bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'>
									<CardContent className='pt-6'>
										<div className='flex items-center justify-between'>
											<div>
												<div className='text-sm font-semibold text-muted-foreground mb-2'>
													Price to Beat
												</div>
												{priceToBeatLoading ? (
													<Skeleton className='h-8 w-32' />
												) : priceToBeat !== null ? (
													<div className='text-3xl font-bold text-indigo-600 dark:text-indigo-400'>
														$
														{priceToBeat.toLocaleString('en-US', {
															maximumFractionDigits: 2
														})}
													</div>
												) : (
													<div className='text-sm text-muted-foreground'>
														Not available
														{priceToBeat === null &&
															!priceToBeatLoading && (
																<span className='text-xs ml-2'>
																	(Check console for details)
																</span>
															)}
													</div>
												)}
											</div>
											<div className='text-xs text-muted-foreground'>
												Reference price for market resolution
											</div>
										</div>
									</CardContent>
								</Card>
							)}
							{/* Display crypto price from crypto_prices_chainlink if available */}
							{Object.entries(marketPrices).some(([key]) => key.includes('/')) && (
								<Card className='bg-blue-50 dark:bg-blue-900/20'>
									<CardContent className='pt-6'>
										<div className='text-sm text-muted-foreground mb-2'>
											Real-time BTC/USD Price (Chainlink)
										</div>
										{Object.entries(marketPrices)
											.filter(([key]) => key.includes('/'))
											.map(([symbol, priceData]) => (
												<div
													key={symbol}
													className='flex items-center justify-between'>
													<div>
														<div className='text-2xl font-bold'>
															{formatMarketPrice(priceData.price)}
														</div>
														<div className='text-xs text-muted-foreground mt-1'>
															Updated:{' '}
															{new Date(
																priceData.timestamp
															).toLocaleTimeString()}
														</div>
													</div>
													<div className='text-sm text-muted-foreground uppercase'>
														{symbol}
													</div>
												</div>
											))}
									</CardContent>
								</Card>
							)}
							{/* Display Activity Prices from orders_matched events */}
							{(activityPrices.up || activityPrices.down) && (
								<Card className='bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'>
									<CardContent className='pt-6'>
										<div className='text-sm font-semibold text-muted-foreground mb-3'>
											Activity Prices (from orders_matched)
										</div>
										<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
											{activityPrices.up && (
												<div className='flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg'>
													<div>
														<div className='text-xs text-muted-foreground mb-1'>
															UP
														</div>
														<div className='text-2xl font-bold text-green-600 dark:text-green-400'>
															{formatMarketPrice(
																activityPrices.up.price
															)}
														</div>
														<div className='text-xs text-muted-foreground mt-1'>
															{new Date(
																activityPrices.up.timestamp
															).toLocaleTimeString()}
														</div>
													</div>
													<TrendingUp className='h-8 w-8 text-green-600 dark:text-green-400' />
												</div>
											)}
											{activityPrices.down && (
												<div className='flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg'>
													<div>
														<div className='text-xs text-muted-foreground mb-1'>
															DOWN
														</div>
														<div className='text-2xl font-bold text-red-600 dark:text-red-400'>
															{formatMarketPrice(
																activityPrices.down.price
															)}
														</div>
														<div className='text-xs text-muted-foreground mt-1'>
															{new Date(
																activityPrices.down.timestamp
															).toLocaleTimeString()}
														</div>
													</div>
													<TrendingDown className='h-8 w-8 text-red-600 dark:text-red-400' />
												</div>
											)}
										</div>
									</CardContent>
								</Card>
							)}
							{/* Display Last Trade Prices from last_trade_price events */}
							{Object.keys(lastTradePrices).length > 0 && (
								<Card className='bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'>
									<CardContent className='pt-6'>
										<div className='text-sm font-semibold text-muted-foreground mb-3'>
											Last Trade Prices (from last_trade_price)
										</div>
										<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
											{market.outcomes.map((outcome) => {
												const lastTrade = lastTradePrices[outcome.id]
												if (!lastTrade) return null

												const isBuy = lastTrade.side === 'BUY'

												return (
													<div
														key={outcome.id}
														className={cn(
															'flex items-center justify-between p-3 rounded-lg',
															isBuy
																? 'bg-green-50 dark:bg-green-900/20'
																: 'bg-red-50 dark:bg-red-900/20'
														)}>
														<div>
															<div className='text-xs text-muted-foreground mb-1'>
																{outcome.title} ({lastTrade.side})
															</div>
															<div
																className={cn(
																	'text-2xl font-bold',
																	isBuy
																		? 'text-green-600 dark:text-green-400'
																		: 'text-red-600 dark:text-red-400'
																)}>
																{formatMarketPrice(lastTrade.price)}
															</div>
															<div className='text-xs text-muted-foreground mt-1'>
																Size: {lastTrade.size.toFixed(2)} |{' '}
																{new Date(
																	lastTrade.timestamp
																).toLocaleTimeString()}
															</div>
														</div>
														{isBuy ? (
															<TrendingUp className='h-8 w-8 text-green-600 dark:text-green-400' />
														) : (
															<TrendingDown className='h-8 w-8 text-red-600 dark:text-red-400' />
														)}
													</div>
												)
											})}
										</div>
									</CardContent>
								</Card>
							)}
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								{market.outcomes.map((outcome) => {
									const priceData = marketPrices[outcome.id]
									const price = priceData?.price ?? outcome.price
									const isUp =
										outcome.title.toUpperCase().includes('UP') ||
										outcome.title.toUpperCase().includes('YES')

									return (
										<Card key={outcome.id} className='relative overflow-hidden'>
											<CardContent className='pt-6'>
												<div className='flex items-center justify-between'>
													<div>
														<div className='text-sm text-muted-foreground mb-1'>
															{outcome.title}
														</div>
														<div className='text-3xl font-bold'>
															{formatMarketPrice(price)}
														</div>
														{priceData && (
															<div className='text-xs text-muted-foreground mt-1'>
																Updated:{' '}
																{new Date(
																	priceData.timestamp
																).toLocaleTimeString()}
															</div>
														)}
													</div>
													<div
														className={cn(
															'p-3 rounded-full',
															isUp
																? 'bg-green-100 dark:bg-green-900/20'
																: 'bg-red-100 dark:bg-red-900/20'
														)}>
														{isUp ? (
															<TrendingUp className='h-6 w-6 text-green-600 dark:text-green-400' />
														) : (
															<TrendingDown className='h-6 w-6 text-red-600 dark:text-red-400' />
														)}
													</div>
												</div>
											</CardContent>
										</Card>
									)
								})}
							</div>
						</div>
					) : (
						<div className='text-muted-foreground'>No market data available</div>
					)}
				</CardContent>
			</Card>

			{/* Crypto Prices Section */}
			<Card>
				<CardHeader>
					<div className='flex items-center justify-between'>
						<div>
							<CardTitle>Crypto Prices (RTDS WebSocket)</CardTitle>
							<CardDescription>
								Real-time cryptocurrency prices from Polymarket RTDS
							</CardDescription>
						</div>
						<div className='flex items-center gap-4'>
							{/* Source Selection */}
							<div className='flex items-center gap-2'>
								<Button
									variant={source === 'binance' ? 'default' : 'outline'}
									size='sm'
									onClick={() => setSource('binance')}
									disabled={cryptoWs.status === 'connected'}>
									Binance
								</Button>
								<Button
									variant={source === 'chainlink' ? 'default' : 'outline'}
									size='sm'
									onClick={() => setSource('chainlink')}
									disabled={cryptoWs.status === 'connected'}>
									Chainlink
								</Button>
							</div>

							{/* Connection Status */}
							<div
								className={cn(
									'flex items-center gap-2',
									getStatusColor(cryptoWs.status)
								)}>
								{getStatusIcon(cryptoWs.status)}
								<span className='text-sm capitalize'>
									Crypto WS: {cryptoWs.status}
								</span>
							</div>

							{/* Connect/Disconnect Button */}
							{cryptoWs.status === 'disconnected' ? (
								<Button onClick={handleCryptoConnect} variant='default' size='sm'>
									<Play className='h-4 w-4 mr-2' />
									Connect Crypto
								</Button>
							) : (
								<Button
									onClick={handleCryptoDisconnect}
									variant='destructive'
									size='sm'>
									<Square className='h-4 w-4 mr-2' />
									Disconnect
								</Button>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{/* Error Display */}
					{cryptoError && (
						<div className='mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md'>
							<div className='flex items-center gap-2 text-red-600 dark:text-red-400'>
								<AlertCircle className='h-4 w-4' />
								<span className='text-sm'>{cryptoError}</span>
							</div>
						</div>
					)}

					{/* Price Cards */}
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
						{selectedSymbols.map((symbol) => {
							const price = prices[symbol]
							const priceChange = price ? getPriceChange(price) : null
							const isPositive = priceChange && priceChange.change > 0

							return (
								<Card key={symbol} className='relative overflow-hidden'>
									<CardHeader className='pb-3'>
										<CardTitle className='text-lg'>
											{formatSymbol(symbol)}
										</CardTitle>
										<CardDescription>
											{source === 'binance' ? 'Binance' : 'Chainlink'} Price
											Feed
										</CardDescription>
									</CardHeader>
									<CardContent>
										{price ? (
											<>
												<div className='flex items-baseline justify-between mb-2'>
													<div className='text-3xl font-bold'>
														${formatPrice(price.value)}
													</div>
													{priceChange && (
														<div
															className={cn(
																'flex items-center gap-1 text-sm font-medium',
																isPositive
																	? 'text-green-600 dark:text-green-400'
																	: 'text-red-600 dark:text-red-400'
															)}>
															{isPositive ? (
																<TrendingUp className='h-4 w-4' />
															) : (
																<TrendingDown className='h-4 w-4' />
															)}
															<span>
																{isPositive ? '+' : ''}
																{priceChange.percent.toFixed(2)}%
															</span>
														</div>
													)}
												</div>
												<div className='text-xs text-muted-foreground'>
													Updated:{' '}
													{new Date(price.timestamp).toLocaleTimeString()}
												</div>
											</>
										) : (
											<div className='text-muted-foreground'>
												{cryptoWs.status === 'connected'
													? 'Waiting for data...'
													: 'Not connected'}
											</div>
										)}
									</CardContent>
								</Card>
							)
						})}
					</div>
				</CardContent>
			</Card>

			{/* Info Card */}
			<Card>
				<CardHeader>
					<CardTitle>Connection Info</CardTitle>
					<CardDescription>Real-time data from Polymarket WebSockets</CardDescription>
				</CardHeader>
				<CardContent>
					<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
						{/* Crypto Info */}
						<div className='space-y-2 text-sm'>
							<h3 className='font-semibold mb-2'>Crypto Prices (RTDS)</h3>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Source:</span>
								<span className='font-medium capitalize'>{source}</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Status:</span>
								<span
									className={cn(
										'font-medium capitalize',
										getStatusColor(cryptoWs.status)
									)}>
									{cryptoWs.status}
								</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Symbols:</span>
								<span className='font-medium'>{selectedSymbols.length}</span>
							</div>
							{cryptoWs.lastPriceUpdate && (
								<div className='flex items-center justify-between'>
									<span className='text-muted-foreground'>Last Update:</span>
									<span className='font-medium'>
										{new Date(
											cryptoWs.lastPriceUpdate.timestamp
										).toLocaleTimeString()}
									</span>
								</div>
							)}
						</div>

						{/* Market Info */}
						<div className='space-y-2 text-sm'>
							<h3 className='font-semibold mb-2'>Market Ticker (RTDS)</h3>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Market:</span>
								<span className='font-medium'>
									{market ? 'Loaded' : 'Loading...'}
								</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Status:</span>
								<span
									className={cn(
										'font-medium capitalize',
										getStatusColor(rtdsMarketWs.status)
									)}>
									{rtdsMarketWs.status}
								</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Condition ID:</span>
								<span className='font-medium'>
									{market?.conditionId ? 'Yes' : 'No'}
								</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Asset IDs:</span>
								<span className='font-medium'>{assetIds.length}</span>
							</div>
							{rtdsMarketWs.lastPriceUpdate && (
								<div className='flex items-center justify-between'>
									<span className='text-muted-foreground'>Last Update:</span>
									<span className='font-medium'>
										{new Date(
											rtdsMarketWs.lastPriceUpdate.timestamp
										).toLocaleTimeString()}
									</span>
								</div>
							)}
						</div>

						{/* CLOB Market Info */}
						<div className='space-y-2 text-sm'>
							<h3 className='font-semibold mb-2'>Market Ticker (CLOB)</h3>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Market:</span>
								<span className='font-medium'>
									{market ? 'Loaded' : 'Loading...'}
								</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Status:</span>
								<span
									className={cn(
										'font-medium capitalize',
										getStatusColor(clobMarketWs.status)
									)}>
									{clobMarketWs.status}
								</span>
							</div>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground'>Asset IDs:</span>
								<span className='font-medium'>{assetIds.length}</span>
							</div>
							{clobMarketWs.lastPriceUpdate && (
								<div className='flex items-center justify-between'>
									<span className='text-muted-foreground'>Last Update:</span>
									<span className='font-medium'>
										{new Date(
											clobMarketWs.lastPriceUpdate.timestamp
										).toLocaleTimeString()}
									</span>
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

/*
{
    "action": "subscribe",
    "subscriptions": [
        {
            "topic": "activity",
            "type": "orders_matched",
            "filters": "{\"event_slug\":\"btc-updown-15m-1764280800\"}"
        },
        {
            "topic": "comments",
            "type": "*",
            "filters": "{\"parentEntityID\":10192,\"parentEntityType\":\"Series\"}"
        },
        {
            "topic": "crypto_prices_chainlink",
            "type": "update",
            "filters": "{\"symbol\":\"btc/usd\"}"
        }
    ]
}
*/
