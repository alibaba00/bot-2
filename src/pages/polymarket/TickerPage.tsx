import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePolymarketWebSocket } from '@/hooks/use-polymarket-websocket'
import {
	fetchMarket,
	fetchMarkets,
	fetchMarketBySlugFromGamma,
	fetchMarketPricesFromClob
} from '@/lib/polymarket/markets'
import type { Market } from '@/lib/polymarket/types'
import {
	Activity,
	TrendingUp,
	TrendingDown,
	Wifi,
	WifiOff,
	AlertCircle,
	Play,
	Square
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { WS_URLS } from '@/lib/polymarket/websocket'

// Default Bitcoin market condition IDs from the URL
// Condition ID is in the slug: btc-updown-15m-1764243900
// The tid parameter is a token/transaction ID, not the condition ID
const DEFAULT_BTC_MARKET_CONDITION_IDS = ['1764256500'] // Try both in case
// + 900 = 15min

// Default Bitcoin market slugs to try
const DEFAULT_BTC_MARKET_SLUGS = ['btc-updown-15m-1764256500']

export default function TickerPage() {
	const [market, setMarket] = useState<Market | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [assetIds, setAssetIds] = useState<string[]>([])
	const [priceData, setPriceData] = useState<
		Record<string, { price: number; timestamp: number }>
	>({})
	const [wsError1, setWsError1] = useState<string | null>(null)
	const [wsError2, setWsError2] = useState<string | null>(null)
	const [usePolling, setUsePolling] = useState(false)

	// First WebSocket instance (URL 1)
	const ws1 = usePolymarketWebSocket({
		assetIds,
		wsUrl: WS_URLS[0],
		onPriceUpdate: (update) => {
			setPriceData((prev) => ({
				...prev,
				[update.asset_id]: {
					price: update.price,
					timestamp: update.timestamp
				}
			}))
			setWsError1(null) // Clear error on successful update
		},
		onError: (error) => {
			setWsError1(error.message || 'WebSocket 1 connection error')
		},
		autoConnect: false // We'll connect manually
	})

	// Second WebSocket instance (URL 2)
	const ws2 = usePolymarketWebSocket({
		assetIds,
		wsUrl: WS_URLS[1],
		onPriceUpdate: (update) => {
			setPriceData((prev) => ({
				...prev,
				[update.asset_id]: {
					price: update.price,
					timestamp: update.timestamp
				}
			}))
			setWsError2(null) // Clear error on successful update
		},
		onError: (error) => {
			setWsError2(error.message || 'WebSocket 2 connection error')
		},
		autoConnect: false // We'll connect manually
	})

	// Fetch the default Bitcoin market
	useEffect(() => {
		async function loadMarket() {
			try {
				setLoading(true)
				setError(null)

				let marketData: Market | null = null

				// Strategy: Try direct API first, then fallback to search
				// Direct API might work even if getMarket() fails

				// First, try Gamma API by slug (most reliable)
				console.log('Trying Gamma API by slug...')
				for (const slug of DEFAULT_BTC_MARKET_SLUGS) {
					try {
						const fetchedMarket = await fetchMarketBySlugFromGamma(slug)

						if (
							fetchedMarket &&
							fetchedMarket.id &&
							fetchedMarket.question &&
							fetchedMarket.question.trim() !== ''
						) {
							marketData = fetchedMarket
							console.log(`✅ Found market via Gamma API by slug: ${slug}`, {
								question: marketData.question,
								id: marketData.id,
								conditionId: marketData.conditionId,
								outcomesCount: marketData.outcomes?.length || 0
							})
							break
						}
					} catch (slugError: any) {
						console.log(
							`Gamma API by slug failed for ${slug}:`,
							slugError?.message || slugError
						)
					}
				}

				// If slug search failed, try direct API calls for the condition IDs
				if (!marketData) {
					console.log('Trying direct API calls for condition IDs...')
					for (const conditionId of DEFAULT_BTC_MARKET_CONDITION_IDS) {
						try {
							const fetchedMarket = await fetchMarket(conditionId)

							// Validate that we have a complete market object
							if (
								fetchedMarket &&
								fetchedMarket.id &&
								fetchedMarket.question &&
								fetchedMarket.question.trim() !== ''
							) {
								marketData = fetchedMarket
								console.log(
									`✅ Found market via direct API with condition ID: ${conditionId}`,
									{
										question: marketData.question,
										id: marketData.id,
										conditionId: marketData.conditionId,
										outcomesCount: marketData.outcomes?.length || 0
									}
								)
								break
							} else {
								if (fetchedMarket) {
									console.log(
										`⚠️ Market object incomplete for ID ${conditionId}:`,
										{
											hasId: !!fetchedMarket.id,
											hasQuestion: !!fetchedMarket.question,
											question: fetchedMarket.question
										}
									)
								} else {
									console.log(`Direct API returned null for ID ${conditionId}`)
								}
							}
						} catch (idError: any) {
							// 404 or other errors - market not found via direct API
							const errorMsg =
								idError?.message || idError?.data?.error || String(idError)
							console.log(
								`❌ Direct API call failed for ID ${conditionId}:`,
								errorMsg
							)
							// Don't set marketData here - it should remain null
						}
					}
				}

				// If direct API failed (marketData is still null), try fetching markets list and searching
				if (!marketData) {
					console.log('No market found via direct API, trying market list search...')
					try {
						console.log('Direct API failed, fetching markets list...')
						// Try to load more markets - Bitcoin markets might be further down the list
						let allMarkets = await fetchMarkets(2000) // Increase limit significantly
						console.log(`Fetched ${allMarkets.length} markets`)

						// If we got exactly the limit, try loading even more
						if (allMarkets.length >= 2000) {
							console.log('Reached limit, trying to load more markets...')
							// Try multiple batches
							const batches = [3000, 5000]
							for (const batchSize of batches) {
								const batchMarkets = await fetchMarkets(batchSize)
								if (batchMarkets.length > allMarkets.length) {
									allMarkets = batchMarkets
									console.log(`Loaded ${allMarkets.length} markets`)
								} else {
									break // No more markets available
								}
							}
						}

						// First, try to find market by condition ID in the list
						for (const conditionId of DEFAULT_BTC_MARKET_CONDITION_IDS) {
							const foundMarket = allMarkets.find((m) => {
								const match =
									m.conditionId === conditionId ||
									m.id === conditionId ||
									m.conditionId?.toString() === conditionId ||
									m.id?.toString() === conditionId ||
									String(m.conditionId) === String(conditionId) ||
									String(m.id) === String(conditionId)
								return match
							})
							if (foundMarket) {
								marketData = foundMarket
								console.log(`✅ Found market with condition ID: ${conditionId}`, {
									question: foundMarket.question,
									id: foundMarket.id,
									conditionId: foundMarket.conditionId,
									active: foundMarket.active,
									closed: foundMarket.closed
								})
								break
							}
						}

						// If not found by ID, search for Bitcoin 15min markets
						if (!marketData) {
							console.log(
								'Market not found by ID, searching for Bitcoin 15min markets...'
							)

							// First, let's see what Bitcoin markets exist
							const allBtcMarkets = allMarkets.filter((m) => {
								const question = m.question.toLowerCase()
								return question.includes('bitcoin') || question.includes('btc')
							})
							console.log(`Found ${allBtcMarkets.length} total Bitcoin markets`)

							// Look for Bitcoin 15min markets (try with and without active/closed filter)
							let btcMarkets = allMarkets.filter((m) => {
								const question = m.question.toLowerCase()
								return (
									(question.includes('bitcoin') || question.includes('btc')) &&
									(question.includes('15m') ||
										question.includes('15min') ||
										question.includes('15 min') ||
										question.includes('up or down'))
								)
							})

							console.log(
								`Found ${btcMarkets.length} Bitcoin 15min markets (before filtering active/closed)`
							)

							// Log some examples
							if (btcMarkets.length > 0) {
								console.log(
									'Sample Bitcoin 15min markets:',
									btcMarkets.slice(0, 3).map((m) => ({
										question: m.question,
										id: m.id,
										conditionId: m.conditionId,
										active: m.active,
										closed: m.closed
									}))
								)
							}

							// Filter for active and not closed
							const activeBtcMarkets = btcMarkets.filter((m) => m.active && !m.closed)

							if (activeBtcMarkets.length > 0) {
								// Sort by volume or date to get the most recent/active one
								activeBtcMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0))
								marketData = activeBtcMarkets[0]
								console.log('✅ Found active Bitcoin 15min market:', {
									question: marketData.question,
									id: marketData.id,
									conditionId: marketData.conditionId,
									volume: marketData.volume
								})
							} else if (btcMarkets.length > 0) {
								// Use inactive/closed market if no active ones found
								btcMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0))
								marketData = btcMarkets[0]
								console.log('⚠️ Using Bitcoin 15min market (may be inactive):', {
									question: marketData.question,
									id: marketData.id,
									conditionId: marketData.conditionId,
									active: marketData.active,
									closed: marketData.closed
								})
							} else {
								// Fallback: try to find any Bitcoin market
								const anyBtcMarket = allMarkets.find((m) => {
									const question = m.question.toLowerCase()
									return question.includes('bitcoin') || question.includes('btc')
								})
								if (anyBtcMarket) {
									marketData = anyBtcMarket
									console.log(
										'⚠️ Found Bitcoin market (fallback, may not be 15min):',
										{
											question: marketData.question,
											id: marketData.id,
											conditionId: marketData.conditionId,
											active: marketData.active,
											closed: marketData.closed
										}
									)
								}
							}
						}
					} catch (searchError) {
						console.error('Error searching for markets:', searchError)
					}
				}

				if (marketData) {
					setMarket(marketData)
					// Extract asset IDs (token IDs) from outcomes
					const ids = marketData.outcomes.map((outcome) => outcome.id).filter(Boolean)
					setAssetIds(ids)

					// Initialize price data with current market prices
					const initialPrices: Record<string, { price: number; timestamp: number }> = {}
					marketData.outcomes.forEach((outcome) => {
						if (outcome.id) {
							initialPrices[outcome.id] = {
								price: outcome.price,
								timestamp: Date.now()
							}
						}
					})
					setPriceData(initialPrices)
				} else {
					setError(
						'Bitcoin 15min market not found. Please check if the market is active.'
					)
				}
			} catch (error) {
				console.error('Error loading market:', error)
				setError(error instanceof Error ? error.message : 'Failed to load market')
			} finally {
				setLoading(false)
			}
		}

		loadMarket()
	}, [])

	// Polling fallback to update prices
	useEffect(() => {
		if (!usePolling || !market || !market.conditionId) return

		let pollCount = 0
		let useClobApi = true // Try CLOB API first (more real-time)

		const pollPrices = async () => {
			try {
				pollCount++
				console.log(
					`🔄 Polling prices (attempt ${pollCount}, using ${useClobApi ? 'CLOB' : 'Gamma'} API)...`
				)

				let newPriceData: Record<string, { price: number; timestamp: number }> = {}
				let hasChanges = false

				// Try CLOB API first for real-time prices
				if (useClobApi && market.conditionId) {
					try {
						const clobPrices = await fetchMarketPricesFromClob(market.conditionId)
						if (clobPrices && Object.keys(clobPrices).length > 0) {
							// Map CLOB prices to our outcome IDs
							market.outcomes.forEach((outcome) => {
								// Try to match by token ID or outcome ID
								const price = clobPrices[outcome.id] || Object.values(clobPrices)[0] // Fallback to first price if no match

								if (price !== undefined) {
									newPriceData[outcome.id] = {
										price: price,
										timestamp: Date.now()
									}
								}
							})

							if (Object.keys(newPriceData).length > 0) {
								setPriceData((prevPriceData) => {
									// Check for changes
									Object.keys(newPriceData).forEach((outcomeId) => {
										const oldPrice = prevPriceData[outcomeId]?.price
										const newPrice = newPriceData[outcomeId].price
										if (
											oldPrice !== undefined &&
											Math.abs(oldPrice - newPrice) > 0.0001
										) {
											hasChanges = true
											const outcome = market.outcomes.find(
												(o) => o.id === outcomeId
											)
											console.log(
												`📊 Price change detected for ${outcome?.title || outcomeId}: ${(oldPrice * 100).toFixed(2)}% → ${(newPrice * 100).toFixed(2)}%`
											)
										}
									})

									if (hasChanges || pollCount === 1) {
										console.log('✅ Prices updated via CLOB API polling', {
											prices: Object.entries(newPriceData).map(
												([id, data]) => {
													const outcome = market.outcomes.find(
														(o) => o.id === id
													)
													return `${outcome?.title || id}: ${(data.price * 100).toFixed(2)}%`
												}
											)
										})
										return { ...prevPriceData, ...newPriceData }
									} else {
										console.log('ℹ️ No price changes detected (CLOB API)')
										return prevPriceData
									}
								})
								return // Success, exit early
							}
						}
					} catch (clobError) {
						console.warn(
							'⚠️ CLOB API polling failed, falling back to Gamma API:',
							clobError
						)
						useClobApi = false // Switch to Gamma API on error
					}
				}

				// Fallback to Gamma API
				if (!useClobApi || Object.keys(newPriceData).length === 0) {
					const updatedMarket = await fetchMarketBySlugFromGamma(market.slug || '')
					if (updatedMarket && updatedMarket.outcomes) {
						setPriceData((prevPriceData) => {
							const gammaPriceData: Record<
								string,
								{ price: number; timestamp: number }
							> = {}

							updatedMarket.outcomes.forEach((outcome) => {
								if (outcome.id) {
									const oldPrice = prevPriceData[outcome.id]?.price
									const newPrice = outcome.price

									if (
										oldPrice !== undefined &&
										Math.abs(oldPrice - newPrice) > 0.0001
									) {
										hasChanges = true
										console.log(
											`📊 Price change detected for ${outcome.title}: ${(oldPrice * 100).toFixed(2)}% → ${(newPrice * 100).toFixed(2)}%`
										)
									}

									gammaPriceData[outcome.id] = {
										price: newPrice,
										timestamp: Date.now()
									}
								}
							})

							if (hasChanges || pollCount === 1) {
								console.log('✅ Prices updated via Gamma API polling', {
									prices: updatedMarket.outcomes.map(
										(o) => `${o.title}: ${(o.price * 100).toFixed(2)}%`
									)
								})
								return { ...prevPriceData, ...gammaPriceData }
							} else {
								console.log('ℹ️ No price changes detected (Gamma API)')
								return prevPriceData
							}
						})
					} else {
						console.warn('⚠️ No market data received from polling')
					}
				}
			} catch (error) {
				console.error('❌ Error polling prices:', error)
			}
		}

		// Poll every 3 seconds for more frequent updates
		const interval = setInterval(pollPrices, 3000)
		pollPrices() // Initial fetch

		return () => {
			clearInterval(interval)
			console.log('🛑 Polling stopped')
		}
	}, [usePolling, market]) // Don't include priceData to avoid re-running on every price change

	// Handle WebSocket 1 start/stop
	const handleStartWebSocket1 = () => {
		setWsError1(null) // Clear previous errors
		setUsePolling(false) // Disable polling when using WebSocket
		if (assetIds.length > 0) {
			console.log('Starting WebSocket 1 with asset IDs:', assetIds)
			// Force connect to ensure clean start
			ws1.connect()
		} else {
			setWsError1('No asset IDs available. Please wait for market to load.')
		}
	}

	const handleStopWebSocket1 = () => {
		console.log('🛑 Stopping WebSocket 1...')
		setWsError1(null)
		ws1.disconnect()
	}

	// Handle WebSocket 2 start/stop
	const handleStartWebSocket2 = () => {
		setWsError2(null) // Clear previous errors
		setUsePolling(false) // Disable polling when using WebSocket
		if (assetIds.length > 0) {
			console.log('Starting WebSocket 2 with asset IDs:', assetIds)
			// Force connect to ensure clean start
			ws2.connect()
		} else {
			setWsError2('No asset IDs available. Please wait for market to load.')
		}
	}

	const handleStopWebSocket2 = () => {
		console.log('🛑 Stopping WebSocket 2...')
		setWsError2(null)
		ws2.disconnect()
	}

	const handleStartPolling = () => {
		setWsError1(null)
		setWsError2(null)
		setUsePolling(true)
		ws1.disconnect() // Make sure WebSocket 1 is stopped
		ws2.disconnect() // Make sure WebSocket 2 is stopped
	}

	const handleStopPolling = () => {
		setUsePolling(false)
	}

	// Cleanup on unmount only
	useEffect(() => {
		return () => {
			// Only disconnect on component unmount
			ws1.disconnect()
			ws2.disconnect()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []) // Empty deps - only run on mount/unmount, disconnect is stable via useCallback

	const getPrice = (assetId: string): number => {
		return priceData[assetId]?.price ?? 0
	}

	const formatPrice = (price: number): string => {
		return (price * 100).toFixed(2) + '%'
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

	if (loading) {
		return (
			<div className='flex flex-1 flex-col gap-6 p-4 pt-0 pb-16'>
				<div className='flex items-center justify-between'>
					<div>
						<h1 className='text-3xl font-bold'>Ticker</h1>
					</div>
				</div>
				<Card>
					<CardContent className='pt-6'>
						<Skeleton className='h-32 w-full' />
					</CardContent>
				</Card>
			</div>
		)
	}

	if (!market && !loading) {
		return (
			<div className='flex flex-1 flex-col gap-6 p-4 pt-0 pb-16'>
				<div className='flex items-center justify-between'>
					<div>
						<h1 className='text-3xl font-bold'>Ticker</h1>
						<p className='text-muted-foreground mt-1'>Real-time market prices</p>
					</div>
				</div>
				<Card>
					<CardHeader>
						<CardTitle className='flex items-center gap-2'>
							<AlertCircle className='h-5 w-5 text-yellow-500' />
							Market Not Found
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='space-y-2'>
							<p className='text-muted-foreground'>
								{error || 'The Bitcoin 15min market could not be found.'}
							</p>
							<p className='text-sm text-muted-foreground'>
								The market may be closed, inactive, or the market ID may have
								changed.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className='flex flex-1 flex-col gap-6 p-4 pt-0 pb-16'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-3xl font-bold'>Ticker</h1>
					<p className='text-muted-foreground mt-1'>Real-time market prices</p>
				</div>
				<div className='flex items-center gap-4'>
					{assetIds.length > 0 && (
						<div className='flex items-center gap-2 flex-wrap'>
							{/* WebSocket 1 Controls */}
							<div className='flex items-center gap-2 border-r pr-2'>
								<div
									className={cn(
										'flex items-center gap-2',
										getStatusColor(ws1.status)
									)}>
									{getStatusIcon(ws1.status)}
									<span className='text-sm capitalize'>WS1: {ws1.status}</span>
								</div>
								{ws1.status === 'disconnected' ? (
									<Button
										onClick={handleStartWebSocket1}
										variant='default'
										size='sm'
										disabled={assetIds.length === 0}>
										<Play className='h-4 w-4' />
										Start WS1
									</Button>
								) : (
									<Button
										onClick={handleStopWebSocket1}
										variant='destructive'
										size='sm'>
										<Square className='h-4 w-4' />
										Stop WS1
									</Button>
								)}
							</div>

							{/* WebSocket 2 Controls */}
							<div className='flex items-center gap-2 border-r pr-2'>
								<div
									className={cn(
										'flex items-center gap-2',
										getStatusColor(ws2.status)
									)}>
									{getStatusIcon(ws2.status)}
									<span className='text-sm capitalize'>WS2: {ws2.status}</span>
								</div>
								{ws2.status === 'disconnected' ? (
									<Button
										onClick={handleStartWebSocket2}
										variant='default'
										size='sm'
										disabled={assetIds.length === 0}>
										<Play className='h-4 w-4' />
										Start WS2
									</Button>
								) : (
									<Button
										onClick={handleStopWebSocket2}
										variant='destructive'
										size='sm'>
										<Square className='h-4 w-4' />
										Stop WS2
									</Button>
								)}
							</div>

							{/* Polling Controls */}
							<div className='flex items-center gap-2'>
								{!usePolling ? (
									<Button
										onClick={handleStartPolling}
										variant='outline'
										size='sm'
										disabled={assetIds.length === 0}>
										<Activity className='h-4 w-4' />
										Use Polling
									</Button>
								) : (
									<>
										<span className='text-sm text-muted-foreground'>
											Polling Active
										</span>
										<Button
											onClick={handleStopPolling}
											variant='outline'
											size='sm'>
											<Square className='h-4 w-4' />
											Stop Polling
										</Button>
									</>
								)}
							</div>
						</div>
					)}
				</div>
			</div>

			{market && (
				<Card>
					<CardHeader>
						<CardTitle>{market.question}</CardTitle>
						<CardDescription>
							{market.description || 'Bitcoin Up or Down (15Min)'}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
							{market.outcomes.map((outcome) => {
								const price = getPrice(outcome.id)
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
														{formatPrice(price)}
													</div>
													{priceData[outcome.id] && (
														<div className='text-xs text-muted-foreground mt-1'>
															Updated:{' '}
															{new Date(
																priceData[outcome.id].timestamp
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

						{(wsError1 || wsError2) && (
							<div className='mt-4 pt-4 border-t space-y-2'>
								{wsError1 && (
									<div className='p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md'>
										<div className='flex items-center gap-2 text-red-600 dark:text-red-400'>
											<AlertCircle className='h-4 w-4' />
											<span className='font-medium'>WebSocket 1 Error:</span>
										</div>
										<p className='text-sm text-red-700 dark:text-red-300 mt-1'>
											{wsError1}
										</p>
									</div>
								)}
								{wsError2 && (
									<div className='p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md'>
										<div className='flex items-center gap-2 text-red-600 dark:text-red-400'>
											<AlertCircle className='h-4 w-4' />
											<span className='font-medium'>WebSocket 2 Error:</span>
										</div>
										<p className='text-sm text-red-700 dark:text-red-300 mt-1'>
											{wsError2}
										</p>
									</div>
								)}
							</div>
						)}
						{(ws1.lastPriceUpdate || ws2.lastPriceUpdate) && !wsError1 && !wsError2 && (
							<div className='mt-4 pt-4 border-t'>
								<div className='text-sm text-muted-foreground space-y-1'>
									{ws1.lastPriceUpdate && (
										<div className='flex items-center gap-2'>
											<Activity className='h-4 w-4' />
											<span>
												WS1 last update:{' '}
												{new Date(
													ws1.lastPriceUpdate.timestamp
												).toLocaleTimeString()}
											</span>
										</div>
									)}
									{ws2.lastPriceUpdate && (
										<div className='flex items-center gap-2'>
											<Activity className='h-4 w-4' />
											<span>
												WS2 last update:{' '}
												{new Date(
													ws2.lastPriceUpdate.timestamp
												).toLocaleTimeString()}
											</span>
										</div>
									)}
								</div>
							</div>
						)}

						{assetIds.length > 0 && (
							<div className='mt-2 pt-2 border-t'>
								<div className='text-xs text-muted-foreground'>
									Asset IDs: {assetIds.length} token
									{assetIds.length !== 1 ? 's' : ''} loaded
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	)
}
