// import { Button } from "@/components/ui/button";
// import { fetchMarket, fetchMarketBySlugFromGamma, fetchMarketPricesFromClob, fetchMarkets } from "@/lib/polymarket/markets";
// import { getOpenOrders } from "@/lib/polymarket/orders";
// import { getTransactionHistory, getWalletBalance } from "@/lib/polymarket/wallet";
// import { Side } from "@polymarket/clob-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUserChannelWebSocket } from "@/hooks/use-user-channel-websocket";
import { fetchMarketBySlugFromGamma } from "@/lib/polymarket/markets";
import { cancelOrder, getOpenOrders, placeOrder } from "@/lib/polymarket/orders";
import type { Order, WalletBalance } from "@/lib/polymarket/types";
import { getWalletBalance } from "@/lib/polymarket/wallet";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
// import { Side } from "@polymarket/clob-client";
import moment from "moment";


export default function TradingItem() {
	// Trading console state
	const [marketSlug, setMarketSlug] = useState('btc-updown-15m-1770896700')
	const [orderType, setOrderType] = useState<'up' | 'down'>('up')
	const [buyPrice, setBuyPrice] = useState('0.50')
	const [sellPrice, setSellPrice] = useState('0.50')
	const [buySize, setBuySize] = useState('10')
	const [sellSize, setSellSize] = useState('10')
	const [buyAmount, setBuyAmount] = useState('5.00')
	const [sellAmount, setSellAmount] = useState('5.00')
	// Refs to prevent circular updates when calculating between Amount/Size
	const updatingBuyAmountRef = useRef(false)
	const updatingBuySizeRef = useRef(false)
	const updatingSellAmountRef = useRef(false)
	const updatingSellSizeRef = useRef(false)

	// Helper: Calculate amount from price × size
	const calculateAmount = (price: string, size: string): string => {
		const p = parseFloat(price)
		const s = parseFloat(size)
		if (isNaN(p) || isNaN(s) || p <= 0 || s <= 0) return ''
		return (p * s).toFixed(6)
	}

	// Helper: Calculate size from amount / price
	const calculateSize = (amount: string, price: string): string => {
		const a = parseFloat(amount)
		const p = parseFloat(price)
		if (isNaN(a) || isNaN(p) || a <= 0 || p <= 0) return ''
		return (a / p).toFixed(6)
	}


	const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null)
	const [orderStats, setOrderStats] = useState<{ total: number; open: number; pending: number }>({
		total: 0,
		open: 0,
		pending: 0
	})
	const [openOrders, setOpenOrders] = useState<Order[]>([])
	const [activeCombinedTrade, setActiveCombinedTrade] = useState<{
		buyOrderId: string
		sellPrice: string
		sellSize: string
	} | null>(null)

	const combinedTradeMarketRef = useRef<{ market: any; orderType: 'up' | 'down'; outcomeObj: any } | null>(null)
	// Ref so WebSocket callback always sees current value (avoids stale closure)
	const activeCombinedTradeRef = useRef<typeof activeCombinedTrade>(null)
	
	useEffect(() => {
		activeCombinedTradeRef.current = activeCombinedTrade
	}, [activeCombinedTrade])

	// Helper function to add log entry
	const addLogEntry = (action: string, data: any) => {
		const entry = {
			// timestamp: new Date().toISOString(),
			// timestamp: new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 23),
			// timestamp: new Date().toLocaleString(undefined, { hour12: false }).replace(',', ''),
			timestamp: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
			action,
			data,
			open: true
		}
		console.log('addLogEntry:', entry)
	}

	// Helper to update order statistics shown in header
	const updateOrderStats = (orders: Order[]) => {
		const total = orders.length
		const open = orders.filter(o => o.status === 'OPEN').length
		const pending = orders.filter(o => o.status === 'PENDING').length
		setOrderStats({ total, open, pending })
		setOpenOrders(orders.filter(o => o.status === 'OPEN' || o.status === 'PENDING'))
	}

	// Helper function to find outcome object from market
	const findOutcome = (market: any, orderType: 'up' | 'down') => {
		const targetOutcomeTitle = orderType === 'up' ? 'UP' : 'DOWN'
		
		// Try exact match first
		let outcomeObj = market.outcomes.find((o: any) => 
			o.title.toUpperCase() === targetOutcomeTitle.toUpperCase()
		)

		// Fallback: if UP/DOWN not found, try YES/NO
		if (!outcomeObj) {
			if (orderType === 'up') {
				outcomeObj = market.outcomes.find((o: any) => o.title.toUpperCase() === 'YES')
			} else {
				outcomeObj = market.outcomes.find((o: any) => o.title.toUpperCase() === 'NO')
			}
		}

		return outcomeObj
	}

	// User Channel WebSocket for real-time order/trade updates
	const userChannelWs = useUserChannelWebSocket({
		onTradeUpdate: (trade) => {
			addLogEntry('Trade Update (WebSocket)', {
				id: trade.id,
				status: trade.status,
				side: trade.side,
				price: trade.price,
				size: trade.size,
				asset_id: trade.asset_id,
				market: trade.market
			})
		},
		onOrderUpdate: async (order) => {
			addLogEntry('Order Update (WebSocket)', {
				id: order.id,
				type: order.type,
				side: order.side,
				price: order.price,
				original_size: order.original_size,
				size_matched: order.size_matched,
				asset_id: order.asset_id,
				market: order.market
			})

			// Check if this is the buy order from active combined trade that was fully filled (use ref to avoid stale closure)
			const currentCombined = activeCombinedTradeRef.current
			if (
				currentCombined &&
				currentCombined.buyOrderId === order.id &&
				order.side === 'BUY'
			) {
				const sizeMatched = parseFloat(order.size_matched || '0')
				const originalSize = parseFloat(order.original_size || '0')
				const isFullyFilled = sizeMatched >= originalSize && originalSize > 0

				if (isFullyFilled && order.type === 'UPDATE') {
					addLogEntry('Combined Trade - Buy Order Fully Filled', {
						orderId: order.id,
						size_matched: order.size_matched,
						original_size: order.original_size,
						type: order.type,
						asset_id: order.asset_id,
						outcome: order.outcome,
						market: order.market
					})

					// Retry sell every 2s until success (settlement can take a few seconds)
					const RETRY_INTERVAL_MS = 2000
					const MAX_ATTEMPTS = 10 // ~20 seconds max
					const filledOrder = {
						asset_id: order.asset_id,
						outcome: order.outcome ?? '',
						market: order.market
					}
					let attempt = 0
					while (attempt < MAX_ATTEMPTS) {
						try {
							console.log('!!!!!---try to executeSellOrderForCombinedTrade:', attempt)
							await executeSellOrderForCombinedTrade(filledOrder)
							break
						} catch (error: any) {
							attempt++
							addLogEntry('Combined Trade - Auto Sell Retry', {
								attempt,
								maxAttempts: MAX_ATTEMPTS,
								error: error.message || String(error),
								nextInMs: attempt < MAX_ATTEMPTS ? RETRY_INTERVAL_MS : 0
							})
							if (attempt >= MAX_ATTEMPTS) {
								addLogEntry('Combined Trade - Auto Sell Failed (max retries)', {
									error: error.message || String(error)
								})
								setActiveCombinedTrade(null)
								combinedTradeMarketRef.current = null
								break
							}
							await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS))
						}
					}
				} else if (order.type === 'CANCELLATION') {
					// Order was cancelled, clear active combined trade
					addLogEntry('Combined Trade - Buy Order Cancelled', {
						orderId: order.id
					})
					setActiveCombinedTrade(null)
				}
			}

			// Update orders list
			try {
				const orders = await getOpenOrders()
				updateOrderStats(orders)
			} catch {
				// Ignore update error
			}
		},
		onError: (error) => {
			addLogEntry('User Channel Error', { error: error.message })
		},
		autoConnect: false // Don't auto-connect, user can enable manually
	})

	useEffect(() => {
		// handleConnect()
	}, [])


	// Trading console handlers
	const handleBuyNow = async () => {
		try {
			addLogEntry('Buy Now - Start', { marketSlug, orderType, buyPrice, buySize })
			
			if (!marketSlug || !buyPrice || !buySize) {
				addLogEntry('Buy Now - Error', { error: 'Please fill in market slug, buy price, and buy size' })
				return
			}

			// Fetch market data from slug
			addLogEntry('Fetch Market', { slug: marketSlug })
			const market = await fetchMarketBySlugFromGamma(marketSlug)
			
			if (!market) {
				addLogEntry('Fetch Market - Error', { error: 'Market not found' })
				return
			}

			addLogEntry('Market Data', market)

			// Log available outcomes for debugging
			addLogEntry('Available Outcomes', market.outcomes.map((o: any) => ({ title: o.title, id: o.id })))

			// Find outcome object
			const outcomeObj = findOutcome(market, orderType)
			if (!outcomeObj) {
				addLogEntry('Buy Now - Error', { 
					error: `Outcome not found in market. Available outcomes: ${market.outcomes.map((o: any) => o.title).join(', ')}`,
					availableOutcomes: market.outcomes.map((o: any) => o.title)
				})
				return
			}

			const actualOutcome = outcomeObj.title.toUpperCase()

			// Place buy order
			const orderParams = {
				marketId: market.conditionId,
				price: parseFloat(buyPrice),
				quantity: parseFloat(buySize),
				side: 'BUY' as const,
				outcome: actualOutcome,
				outcomeId: outcomeObj.id
			}

			addLogEntry('Place Buy Order', orderParams)
			console.log('-------------------------------------Place Buy Order:', orderParams)
			const result = await placeOrder(orderParams)
			addLogEntry('Buy Now - Success', result)
			
			// Update orders after placing
			try {
				const orders = await getOpenOrders()
				updateOrderStats(orders)
			} catch {
				// Ignore update error
			}
		} catch (error: any) {
			addLogEntry('Buy Now - Error', { error: error.message || String(error) })
			console.error('Error placing buy order:', error)
		}
	}

	const handleSellNow = async () => {
		try {
			addLogEntry('Sell Now - Start', { marketSlug, orderType, sellPrice, sellSize })
			
			if (!marketSlug || !sellPrice || !sellSize) {
				addLogEntry('Sell Now - Error', { error: 'Please fill in market slug, sell price, and sell size' })
				return
			}

			// Fetch market data from slug
			addLogEntry('Fetch Market', { slug: marketSlug })
			const market = await fetchMarketBySlugFromGamma(marketSlug)
			
			if (!market) {
				addLogEntry('Fetch Market - Error', { error: 'Market not found' })
				return
			}

			addLogEntry('Market Data', market)

			// Log available outcomes for debugging
			addLogEntry('Available Outcomes', market.outcomes.map((o: any) => ({ title: o.title, id: o.id })))

			// Find outcome object
			const outcomeObj = findOutcome(market, orderType)
			if (!outcomeObj) {
				addLogEntry('Sell Now - Error', { 
					error: `Outcome not found in market. Available outcomes: ${market.outcomes.map((o: any) => o.title).join(', ')}`,
					availableOutcomes: market.outcomes.map((o: any) => o.title)
				})
				return
			}

			const actualOutcome = outcomeObj.title.toUpperCase()

			// Place sell order
			const orderParams = {
				marketId: market.conditionId,
				price: parseFloat(sellPrice),
				quantity: parseFloat(sellSize),
				side: 'SELL' as const,
				outcome: actualOutcome,
				outcomeId: outcomeObj.id
			}

			addLogEntry('Place Sell Order', orderParams)
			console.log('-------------------------------------Place Sell Order:', orderParams)
			const result = await placeOrder(orderParams)
			addLogEntry('Sell Now - Success', result)
			
			// Update orders after placing
			try {
				// const orders = await getOpenOrders()
				// updateOrderStats(orders)
			} catch {
				// Ignore update error
			}
		} catch (error: any) {
			addLogEntry('Sell Now - Error', { error: error.message || String(error) })
			console.error('Error placing sell order:', error)
		}
	}

	// Helper: execute sell for combined trade using the filled buy order's token (so we sell what we actually bought)
	const executeSellOrderForCombinedTrade = async (filledOrder: { asset_id: string; outcome: string; market: string }) => {
		const current = activeCombinedTradeRef.current
		if (!current || !combinedTradeMarketRef.current) {
			addLogEntry('Combined Trade - Auto Sell Error', { error: 'No active combined trade or market data found' })
			setActiveCombinedTrade(null)
			combinedTradeMarketRef.current = null
			return
		}

		const { sellPrice, sellSize } = current
		const { market } = combinedTradeMarketRef.current

		try {
			addLogEntry('Combined Trade - Auto Sell Start', { sellPrice, sellSize })

			// Use token and outcome from the filled buy order so we sell exactly what was bought (avoids wrong outcome → "not enough balance")
			const outcomeId = filledOrder.asset_id
			const outcomeLabel = (filledOrder.outcome || '').toUpperCase() || 'YES'

			const orderParams = {
				marketId: filledOrder.market || market.conditionId,
				price: parseFloat(sellPrice),
				quantity: parseFloat(sellSize),
				side: 'SELL' as const,
				outcome: outcomeLabel,
				outcomeId
			}

			addLogEntry('Combined Trade - Place Auto Sell Order', orderParams)
			console.log('-------------------------------------Combined Trade - Place Auto Sell Order:', orderParams)
			const result = await placeOrder(orderParams)
			addLogEntry('Combined Trade - Auto Sell Success', result)
			
			// Clear active combined trade and market ref
			setActiveCombinedTrade(null)
			combinedTradeMarketRef.current = null

			// Update orders after placing
			try {
				// const orders = await getOpenOrders()
				// updateOrderStats(orders)
			} catch {
				// Ignore update error
			}
		} catch (error: any) {
			addLogEntry('Combined Trade - Auto Sell Error', { error: error.message || String(error) })
			console.error('Error placing auto sell order:', error)
			// Re-throw error so retry mechanism can catch it
			throw error
		}
	}

	const handleCombinedTrade = async () => {
		try {
			addLogEntry('Combined Trade - Start', { marketSlug, orderType, buyPrice, buySize, sellPrice, sellSize })
			
			if (!marketSlug || !buyPrice || !buySize || !sellPrice || !sellSize) {
				addLogEntry('Combined Trade - Error', { error: 'Please fill in all fields (market slug, buy price/size, sell price/size)' })
				return
			}

			// Fetch market data from slug
			addLogEntry('Combined Trade - Fetch Market', { slug: marketSlug })
			const market = await fetchMarketBySlugFromGamma(marketSlug)
			
			if (!market) {
				addLogEntry('Combined Trade - Error', { error: 'Market not found' })
				return
			}

			addLogEntry('Combined Trade - Market Data', market)

			// Find outcome object
			const outcomeObj = findOutcome(market, orderType)
			if (!outcomeObj) {
				addLogEntry('Combined Trade - Error', { 
					error: `Outcome not found in market. Available outcomes: ${market.outcomes.map((o: any) => o.title).join(', ')}`
				})
				return
			}

			const actualOutcome = outcomeObj.title.toUpperCase()

			// Place buy order
			const orderParams = {
				marketId: market.conditionId,
				price: parseFloat(buyPrice),
				quantity: parseFloat(buySize),
				side: 'BUY' as const,
				outcome: actualOutcome,
				outcomeId: outcomeObj.id
			}

			addLogEntry('Combined Trade - Place Buy Order', orderParams)
			console.log('-------------------------------------Combined Trade - Place Buy Order:', orderParams)
			const result = await placeOrder(orderParams)
			addLogEntry('Combined Trade - Buy Order Placed', result)

			// Store market data in ref for auto-sell
			combinedTradeMarketRef.current = {
				market,
				orderType,
				outcomeObj
			}

			// Store active combined trade info for auto-sell
			setActiveCombinedTrade({
				buyOrderId: result.orderId,
				sellPrice,
				sellSize
			})

			// Update orders after placing
			try {
				// const orders = await getOpenOrders()
				// updateOrderStats(orders)
			} catch {
				// Ignore update error
			}
		} catch (error: any) {
			addLogEntry('Combined Trade - Error', { error: error.message || String(error) })
			setActiveCombinedTrade(null)
			combinedTradeMarketRef.current = null
			console.error('Error placing combined trade:', error)
		}
	}

	const handleCancelOrder = async (orderId: string) => {
		try {
			addLogEntry('Cancel Order - Start', { orderId })
			
			// If canceling the buy order from active combined trade, clear it
			if (activeCombinedTrade && activeCombinedTrade.buyOrderId === orderId) {
				addLogEntry('Combined Trade - Buy Order Cancelled', { orderId })
				setActiveCombinedTrade(null)
				combinedTradeMarketRef.current = null
			}

			const result = await cancelOrder(orderId)
			addLogEntry('Cancel Order - Success', result)
			
			// Refresh orders after cancellation
			try {
				const orders = await getOpenOrders()
				updateOrderStats(orders)
			} catch {
				// Ignore update error
			}
		} catch (error: any) {
			addLogEntry('Cancel Order - Error', { error: error.message || String(error) })
			console.error('Error cancelling order:', error)
		}
	}

	return (
		<div className="flex flex-col gap-2 p-4">
			<h2>Trading Console:</h2>
			<div className="border rounded-lg p-4 space-y-4">
				{/* Trading console header with balance and order statistics */}
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<div className="text-xs text-muted-foreground uppercase tracking-wide">
							Balance
						</div>
						<div className="text-sm font-semibold">
							{walletBalance
								? `${walletBalance.total.toFixed(2)} ${walletBalance.currency || "USDC"}`
								: "—"}
						</div>
					</div>

					<div className="flex gap-6 text-sm ml-auto">
						<div>
							<span className="block text-xs text-muted-foreground uppercase tracking-wide">
								Laufende Orders
							</span>
							<span className="font-semibold">
								{orderStats.open + orderStats.pending}
							</span>
						</div>
						<div>
							<span className="block text-xs text-muted-foreground uppercase tracking-wide">
								Offene Orders
							</span>
							<span className="font-semibold">{orderStats.open}</span>
						</div>
					</div>

					<div className="flex-shrink-0">
						<Button
							variant="outline"
							size="icon"
							className="h-8 w-8"
							onClick={async () => {
								try {
									// Update balance
									const balance = await getWalletBalance()
									setWalletBalance(balance)
									addLogEntry('Update Balance', balance)
									
									// Update orders
									const orders = await getOpenOrders()
									updateOrderStats(orders)
									addLogEntry('Update Orders', orders)
								} catch (error: any) {
									addLogEntry('Update Error', { error: error.message || String(error) })
								}
							}}
							title="Update Balance & Orders"
						>
							<RefreshCw className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* User Channel WebSocket Status */}
				<div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
					<span className="text-sm font-medium">User Channel WebSocket:</span>
					<span className={`text-sm ${userChannelWs.status === 'connected' ? 'text-green-600' : userChannelWs.status === 'connecting' ? 'text-yellow-600' : 'text-gray-600'}`}>
						{userChannelWs.status}
					</span>
					{userChannelWs.status === 'disconnected' && (
						<Button variant="outline" size="sm" onClick={userChannelWs.connect}>
							Connect
						</Button>
					)}
					{userChannelWs.status !== 'disconnected' && (
						<Button variant="outline" size="sm" onClick={userChannelWs.disconnect}>
							Disconnect
						</Button>
					)}
					{userChannelWs.error && (
						<span className="text-xs text-red-600">{userChannelWs.error.message}</span>
					)}
				</div>

				<div className="space-y-4">
					{/* Market Slug */}
					<div className="space-y-2">
						<Label htmlFor="market-slug">Market Slug: {marketSlug}</Label>
					</div>

					{/* Order Type: Up/Down Toggle */}
					<div className="space-y-2">
						<Label>Order Type: {orderType}</Label>
					</div>

					{/* Buy and Sell Sections */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* Buy Section */}
						<div className="border rounded-lg p-4 space-y-3">
							<div className="space-y-2">
								<Label htmlFor="buy-price">Buy Price (0-1) {buyPrice}</Label>
							</div>
							<div className="space-y-2">
								<Label htmlFor="buy-size">Buy Size (Shares) {buySize}</Label>
							</div>
							<div className="space-y-2">
								<Label htmlFor="buy-amount">Buy Amount (USDC) {buyAmount}</Label>
							</div>
						</div>

						{/* Sell Section */}
						<div className="border rounded-lg p-4 space-y-3">
							<div className="space-y-2">
								<Label htmlFor="sell-price">Sell Price (0-1) {sellPrice}</Label>
							</div>
							<div className="space-y-2">
								<Label htmlFor="sell-size">Sell Size (Shares) {sellSize}</Label>
							</div>
							<div className="space-y-2">
								<Label htmlFor="sell-amount">Sell Amount (USDC) {sellAmount}</Label>
							</div>
						</div>
					</div>
				</div>

				{activeCombinedTrade && (
					<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
						<div className="text-sm text-blue-800">
							<strong>Combined Trade Active:</strong> Waiting for Buy Order ({activeCombinedTrade.buyOrderId.substring(0, 20)}...) to fill, then Sell Order will execute automatically.
						</div>
					</div>
				)}

				{/* Open Orders Display */}
				{openOrders.length > 0 && (
					<div className="space-y-3">
						<Label>Open Orders</Label>
						<div className="space-y-2">
							{openOrders.map((order) => (
								<div
									key={order.id}
									className={`flex items-center justify-between p-3 border rounded-lg ${
										order.side === 'BUY' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
									}`}
								>
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<span
												className={`text-xs font-semibold px-2 py-1 rounded ${
													order.side === 'BUY'
														? 'bg-green-600 text-white'
														: 'bg-red-600 text-white'
												}`}
											>
												{order.side}
											</span>
											<span className="text-xs text-muted-foreground">
												{order.outcome}
											</span>
											<span
												className={`text-xs px-2 py-1 rounded ${
													order.status === 'OPEN'
														? 'bg-blue-100 text-blue-700'
														: 'bg-yellow-100 text-yellow-700'
												}`}
											>
												{order.status}
											</span>
										</div>
										<div className="mt-1 text-xs text-muted-foreground">
											<span>Price: {order.price.toFixed(4)}</span>
											<span className="mx-2">•</span>
											<span>
												Size: {order.quantity} ({order.filledQuantity || 0} filled)
											</span>
										</div>
										<div className="mt-1 text-xs font-mono text-muted-foreground truncate">
											ID: {order.id}
										</div>
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleCancelOrder(order.id)}
										className="ml-4"
									>
										Cancel
									</Button>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
