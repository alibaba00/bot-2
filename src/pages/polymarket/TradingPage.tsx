// import { Button } from "@/components/ui/button";
// import { fetchMarket, fetchMarketBySlugFromGamma, fetchMarketPricesFromClob, fetchMarkets } from "@/lib/polymarket/markets";
// import { getOpenOrders } from "@/lib/polymarket/orders";
import { usePolymarketConnection } from "@/lib/polymarket/store";
// import { getTransactionHistory, getWalletBalance } from "@/lib/polymarket/wallet";
// import { Side } from "@polymarket/clob-client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getAccountInfo, getTransactionHistory, getWalletBalance } from "@/lib/polymarket/wallet";
import { fetchMarketBySlugFromGamma, fetchMarkets } from "@/lib/polymarket/markets";
import { cancelOrder, getOpenOrders, placeOrder } from "@/lib/polymarket/orders";
import { useUserChannelWebSocket } from "@/hooks/use-user-channel-websocket";
import type { Order, WalletBalance } from "@/lib/polymarket/types";
import { RefreshCw, X } from "lucide-react";
// import { Side } from "@polymarket/clob-client";
import { Strategy1, Strategy2 } from "./Strategy";

export default function TradingPage() {
	const { status, connect } = usePolymarketConnection()

	// Trading console state
	const [marketSlug, setMarketSlug] = useState('btc-updown-15m-1770896700')
	const [orderType, setOrderType] = useState<'up' | 'down'>('up')
	const [buyPrice, setBuyPrice] = useState('')
	const [sellPrice, setSellPrice] = useState('')
	const [buySize, setBuySize] = useState('')
	const [sellSize, setSellSize] = useState('')
	const [logEntries, setLogEntries] = useState<Array<{ timestamp: string; action: string; data: any }>>([])
	const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null)
	const [orderStats, setOrderStats] = useState<{ total: number; open: number; pending: number }>({
		total: 0,
		open: 0,
		pending: 0
	})
	const [openOrders, setOpenOrders] = useState<Order[]>([])
	const [activeCombinedTrade, setActiveCombinedTrade] = useState<{
		buyOrderId: string
		marketSlug: string
		orderType: 'up' | 'down'
		sellPrice: string
		sellSize: string
	} | null>(null)

	// Helper function to add log entry
	const addLogEntry = (action: string, data: any) => {
		const entry = {
			timestamp: new Date().toISOString(),
			action,
			data
		}
		setLogEntries(prev => [entry, ...prev])
	}

	// Helper to update order statistics shown in header
	const updateOrderStats = (orders: Order[]) => {
		const total = orders.length
		const open = orders.filter(o => o.status === 'OPEN').length
		const pending = orders.filter(o => o.status === 'PENDING').length
		setOrderStats({ total, open, pending })
		setOpenOrders(orders.filter(o => o.status === 'OPEN' || o.status === 'PENDING'))
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

			// Check if this is the buy order from active combined trade that was fully filled
			if (
				activeCombinedTrade &&
				activeCombinedTrade.buyOrderId === order.id &&
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
						type: order.type
					})

					// Execute sell order automatically
					try {
						await executeSellOrderForCombinedTrade()
					} catch (error: any) {
						addLogEntry('Combined Trade - Auto Sell Error', {
							error: error.message || String(error)
						})
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

	const handleConnect = async () => {	
		console.log('handleConnect ...')
		await connect()

		// Nach dem Connect gleich Balance & Orders aktualisieren
		try {
			const balance = await getWalletBalance()
			setWalletBalance(balance)
			addLogEntry('Auto Get Balance after Connect', balance)
		} catch (error: any) {
			addLogEntry('Auto Get Balance Error', { error: error.message || String(error) })
		}

		try {
			const orders = await getOpenOrders()
			updateOrderStats(orders)
			addLogEntry('Auto Get Orders after Connect', orders)
		} catch (error: any) {
			addLogEntry('Auto Get Orders Error', { error: error.message || String(error) })
		}
	}

	// --- get Account Info
	const handleGetAccountInfo = async () => {
		console.log('handleGetAccountInfo ...')
		const accountInfo = await getAccountInfo();
		console.log(accountInfo);
	}

	// --- get wallet balance
	const handleGetBalance = async () => {
		console.log('handleGetBalance ...')
		const balance = await getWalletBalance();
		console.log(balance);
		setWalletBalance(balance);
		addLogEntry('Get Balance', balance)
	}

	// --- get orders
	const handleGetOrders = async () => {
		console.log('handleGetOrders ...')
		const orders = await getOpenOrders();
		console.log(orders);
		updateOrderStats(orders);
		addLogEntry('Get Orders (Top Buttons)', orders)
	}

	// --- get transaction history
	const handleGetTrades = async () => {
		console.log('handleGetTrades ...')
		// View your trade history
		const transactions = await getTransactionHistory();
		console.log(`You've made ${transactions.length} trades`);
		console.log(transactions);
	}

	// --- fetch markets
	const handleFetchMarkets = async () => {
		console.log('handleFetchMarkets ...')
		const markets = await fetchMarkets();
		console.log(markets);
	}

	// --- fetch market by slug from gamma
	// https://gamma-api.polymarket.com/markets/slug/elon-musk-of-tweets-january-26-january-28-90-114
	const handleFetchMarketBySlugFromGamma = async () => {
		console.log('handleFetchMarketBySlugFromGamma ...')
		const market = await fetchMarketBySlugFromGamma('elon-musk-of-tweets-january-26-january-28-90-114');
		// const market = await fetchMarketBySlugFromGamma(currentSlug)
		console.log(market);
	}

	// --- set order
	const handleSetOrder = async () => {
		console.log('handleSetOrder ...')
		// Market + YES token from Gamma
		const conditionId = '0x0f26097ce1de840eefd0b64e3a1dc542e2e09320e1f3854dc4592657e33c3cfc';
		const yesTokenId = '18891856818799422062874545461735956983602641799890124905298658195207910642583';
		const price = 0.2;		//price per share
		const size = 10;		//10 shares
		// const side = Side.BUY;

		const order = await placeOrder({
			marketId: conditionId,
			price: price,
			quantity: size,
			side: 'BUY',
			outcome: 'YES',
			outcomeId: yesTokenId
		});
		console.log(order);
	}

	// --- cancel order (old function for top buttons - kept for compatibility)
	const handleCancelOrderTop = async () => {
		console.log('handleCancelOrderTop ...')
		// const orderId = '0x3eb73f7df073f02049648d90871d2d411b2f3c4eefd3c8d84ea7d344d0a37f03';
		const orders = await getOpenOrders();
		if (orders.length > 0) {
			const orderId = orders[0].id;
			console.log('orderId:', orderId);
			const order = await cancelOrder(orderId);
			console.log('order:', order);
		}
	}


	const handleStrategy1 = async () => {
		console.log('handleStrategy1 ...')
		Strategy1.run()
	}

	const handleStrategy2 = async () => {
		console.log('handleStrategy2 ...')
		Strategy2.run()
	}

	const handleStrategy3 = async () => {
		console.log('handleStrategy3 ...')
	}

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
			addLogEntry('Available Outcomes', market.outcomes.map(o => ({ title: o.title, id: o.id })))

			// Determine outcome title based on orderType (Up/Down)
			const targetOutcomeTitle: string = orderType === 'up' ? 'UP' : 'DOWN'

			// Find outcome token ID - try exact match first, then fallback to YES/NO
			let outcomeObj = market.outcomes.find(o => 
				o.title.toUpperCase() === targetOutcomeTitle.toUpperCase()
			)

			// Fallback: if UP/DOWN not found, try YES/NO
			if (!outcomeObj) {
				if (orderType === 'up') {
					outcomeObj = market.outcomes.find(o => o.title.toUpperCase() === 'YES')
				} else {
					outcomeObj = market.outcomes.find(o => o.title.toUpperCase() === 'NO')
				}
			}

			if (!outcomeObj) {
				addLogEntry('Buy Now - Error', { 
					error: `Outcome not found in market. Available outcomes: ${market.outcomes.map(o => o.title).join(', ')}`,
					availableOutcomes: market.outcomes.map(o => o.title)
				})
				return
			}

			// Use the actual outcome title from the market for the API call
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
			addLogEntry('Available Outcomes', market.outcomes.map(o => ({ title: o.title, id: o.id })))

			// Determine outcome title based on orderType (Up/Down)
			const targetOutcomeTitle: string = orderType === 'up' ? 'UP' : 'DOWN'

			// Find outcome token ID - try exact match first, then fallback to YES/NO
			let outcomeObj = market.outcomes.find(o => 
				o.title.toUpperCase() === targetOutcomeTitle.toUpperCase()
			)

			// Fallback: if UP/DOWN not found, try YES/NO
			if (!outcomeObj) {
				if (orderType === 'up') {
					outcomeObj = market.outcomes.find(o => o.title.toUpperCase() === 'YES')
				} else {
					outcomeObj = market.outcomes.find(o => o.title.toUpperCase() === 'NO')
				}
			}

			if (!outcomeObj) {
				addLogEntry('Sell Now - Error', { 
					error: `Outcome not found in market. Available outcomes: ${market.outcomes.map(o => o.title).join(', ')}`,
					availableOutcomes: market.outcomes.map(o => o.title)
				})
				return
			}

			// Use the actual outcome title from the market for the API call
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
			const result = await placeOrder(orderParams)
			addLogEntry('Sell Now - Success', result)
			
			// Update orders after placing
			try {
				const orders = await getOpenOrders()
				updateOrderStats(orders)
			} catch {
				// Ignore update error
			}
		} catch (error: any) {
			addLogEntry('Sell Now - Error', { error: error.message || String(error) })
			console.error('Error placing sell order:', error)
		}
	}

	// Helper function to execute sell order for combined trade
	const executeSellOrderForCombinedTrade = async () => {
		if (!activeCombinedTrade) {
			addLogEntry('Combined Trade - Auto Sell Error', { error: 'No active combined trade found' })
			return
		}

		const { marketSlug, orderType, sellPrice, sellSize } = activeCombinedTrade

		try {
			addLogEntry('Combined Trade - Auto Sell Start', { marketSlug, orderType, sellPrice, sellSize })

			// Fetch market data from slug
			const market = await fetchMarketBySlugFromGamma(marketSlug)
			
			if (!market) {
				addLogEntry('Combined Trade - Auto Sell Error', { error: 'Market not found' })
				setActiveCombinedTrade(null)
				return
			}

			// Determine outcome title based on orderType (Up/Down)
			const targetOutcomeTitle: string = orderType === 'up' ? 'UP' : 'DOWN'

			// Find outcome token ID
			let outcomeObj = market.outcomes.find(o => 
				o.title.toUpperCase() === targetOutcomeTitle.toUpperCase()
			)

			// Fallback: if UP/DOWN not found, try YES/NO
			if (!outcomeObj) {
				if (orderType === 'up') {
					outcomeObj = market.outcomes.find(o => o.title.toUpperCase() === 'YES')
				} else {
					outcomeObj = market.outcomes.find(o => o.title.toUpperCase() === 'NO')
				}
			}

			if (!outcomeObj) {
				addLogEntry('Combined Trade - Auto Sell Error', { 
					error: `Outcome not found in market. Available outcomes: ${market.outcomes.map(o => o.title).join(', ')}`
				})
				setActiveCombinedTrade(null)
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

			addLogEntry('Combined Trade - Place Auto Sell Order', orderParams)
			const result = await placeOrder(orderParams)
			addLogEntry('Combined Trade - Auto Sell Success', result)
			
			// Clear active combined trade
			setActiveCombinedTrade(null)

			// Update orders after placing
			try {
				const orders = await getOpenOrders()
				updateOrderStats(orders)
			} catch {
				// Ignore update error
			}
		} catch (error: any) {
			addLogEntry('Combined Trade - Auto Sell Error', { error: error.message || String(error) })
			setActiveCombinedTrade(null)
			console.error('Error placing auto sell order:', error)
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

			// Determine outcome title based on orderType (Up/Down)
			const targetOutcomeTitle: string = orderType === 'up' ? 'UP' : 'DOWN'

			// Find outcome token ID
			let outcomeObj = market.outcomes.find(o => 
				o.title.toUpperCase() === targetOutcomeTitle.toUpperCase()
			)

			// Fallback: if UP/DOWN not found, try YES/NO
			if (!outcomeObj) {
				if (orderType === 'up') {
					outcomeObj = market.outcomes.find(o => o.title.toUpperCase() === 'YES')
				} else {
					outcomeObj = market.outcomes.find(o => o.title.toUpperCase() === 'NO')
				}
			}

			if (!outcomeObj) {
				addLogEntry('Combined Trade - Error', { 
					error: `Outcome not found in market. Available outcomes: ${market.outcomes.map(o => o.title).join(', ')}`
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
			const result = await placeOrder(orderParams)
			addLogEntry('Combined Trade - Buy Order Placed', result)

			// Store active combined trade info for auto-sell
			setActiveCombinedTrade({
				buyOrderId: result.orderId,
				marketSlug,
				orderType,
				sellPrice,
				sellSize
			})

			// Update orders after placing
			try {
				const orders = await getOpenOrders()
				updateOrderStats(orders)
			} catch {
				// Ignore update error
			}
		} catch (error: any) {
			addLogEntry('Combined Trade - Error', { error: error.message || String(error) })
			setActiveCombinedTrade(null)
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

	console.log('status:', status)

	return (
		<div className="flex flex-col gap-2 p-4">
			<h1>Trading Page</h1>
			<div className="flex gap-2 flex-wrap">
				<Button variant='default' onClick={handleConnect}>Connect to Polymarket</Button>
				<Button variant='default' onClick={handleGetAccountInfo}>Get Account Info</Button>
				<Button variant='default' onClick={handleGetBalance}>Get Balance</Button>
				<Button variant='default' onClick={handleGetOrders}>Get Orders</Button>
				<Button variant='default' onClick={handleGetTrades}>Get Trades</Button>
				<Button variant='default' onClick={handleFetchMarkets}>Fetch Markets</Button>
				<Button variant='default' onClick={handleFetchMarketBySlugFromGamma}>Fetch Market By Slug From Gamma</Button>
				<Button variant='default' onClick={handleSetOrder}>Set Order</Button>
				<Button variant='default' onClick={handleCancelOrderTop}>Cancel Order</Button>
			</div>
			<h2>Strategies:</h2>
			<div className="flex gap-2 flex-wrap">
				<Button variant='default' onClick={handleStrategy1}>Strategy 1</Button>
				<Button variant='default' onClick={handleStrategy2}>Strategy 2</Button>
				<Button variant='default' onClick={handleStrategy3}>Strategy 3</Button>
			</div>

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
						<Label htmlFor="market-slug">Market Slug</Label>
						<Input
							id="market-slug"
							value={marketSlug}
							onChange={(e) => setMarketSlug(e.target.value)}
							placeholder="btc-updown-15m-1770896700"
						/>
					</div>

					{/* Order Type: Up/Down Toggle */}
					<div className="space-y-2">
						<Label>Order Type</Label>
						<ToggleGroup
							type="single"
							value={orderType}
							onValueChange={(value) => {
								if (value) setOrderType(value as 'up' | 'down')
							}}
							variant="outline"
						>
							<ToggleGroupItem value="up" aria-label="Up">
								Up
							</ToggleGroupItem>
							<ToggleGroupItem value="down" aria-label="Down">
								Down
							</ToggleGroupItem>
						</ToggleGroup>
					</div>

					{/* Buy and Sell Sections */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* Buy Section */}
						<div className="border rounded-lg p-4 space-y-3">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-semibold text-green-600">Buy (Open Order)</h3>
							</div>
							<div className="space-y-2">
								<Label htmlFor="buy-price">Buy Price (0-1)</Label>
								<Input
									id="buy-price"
									type="number"
									step="0.01"
									min="0"
									max="1"
									value={buyPrice}
									onChange={(e) => setBuyPrice(e.target.value)}
									placeholder="0.50"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="buy-size">Buy Size (Shares)</Label>
								<Input
									id="buy-size"
									type="number"
									step="0.1"
									min="0"
									value={buySize}
									onChange={(e) => setBuySize(e.target.value)}
									placeholder="10"
								/>
							</div>
							<Button 
								variant="default" 
								onClick={handleBuyNow}
								className="w-full bg-green-600 hover:bg-green-700"
							>
								Buy Now
							</Button>
						</div>

						{/* Sell Section */}
						<div className="border rounded-lg p-4 space-y-3">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-semibold text-red-600">Sell (Close Order)</h3>
							</div>
							<div className="space-y-2">
								<Label htmlFor="sell-price">Sell Price (0-1)</Label>
								<Input
									id="sell-price"
									type="number"
									step="0.01"
									min="0"
									max="1"
									value={sellPrice}
									onChange={(e) => setSellPrice(e.target.value)}
									placeholder="0.50"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="sell-size">Sell Size (Shares)</Label>
								<Input
									id="sell-size"
									type="number"
									step="0.1"
									min="0"
									value={sellSize}
									onChange={(e) => setSellSize(e.target.value)}
									placeholder="10"
								/>
							</div>
							<Button 
								variant="default" 
								onClick={handleSellNow}
								className="w-full bg-red-600 hover:bg-red-700"
							>
								Sell Now
							</Button>
						</div>
					</div>
				</div>

				{/* Combined Trade Button */}
				<div className="flex justify-center">
					<Button
						variant="default"
						onClick={handleCombinedTrade}
						disabled={
							userChannelWs.status !== 'connected' ||
							openOrders.length > 0 ||
							!marketSlug ||
							!buyPrice ||
							!buySize ||
							!sellPrice ||
							!sellSize
						}
						className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{activeCombinedTrade ? 'Combined Trade Active...' : 'Combined Trade (Buy → Auto Sell)'}
					</Button>
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

				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label>Log View</Label>
						{logEntries.length > 0 && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setLogEntries([])}
								className="h-7 px-2"
								title="Clear Log"
							>
								<X className="h-3 w-3" />
							</Button>
						)}
					</div>
					<div className="border rounded-md p-4 bg-muted/50 max-h-96 overflow-y-auto">
						{logEntries.length === 0 ? (
							<div className="text-muted-foreground text-sm">No log entries yet...</div>
						) : (
							<div className="space-y-2 font-mono text-xs">
								{logEntries.map((entry, index) => (
									<div key={index} className="border-b pb-2 last:border-0">
										<div className="flex gap-2 mb-1">
											<span className="text-muted-foreground">{entry.timestamp}</span>
											<span className="font-semibold">{entry.action}</span>
										</div>
										<pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
											{JSON.stringify(entry.data, null, 2)}
										</pre>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

		</div>
	)
}

/*
user channel websocket examples:

order placement:
{
    "id": "0x75e0888f1c91704db329ae582d30c4d1b0a31e0ac2335adaf48dfa11aae782fe",
    "type": "PLACEMENT",
    "side": "BUY",
    "price": "0.01",
    "original_size": "100",
    "size_matched": "0",
    "asset_id": "57061352122631432781883234753452233313802472679003458000984345030541545099404",
    "market": "0xc0e5e40386a753109cd818c4689b4ab19ff2c7fc2fa60152ebaf41f46516b7c0"
}
source data:
{
  "id": "0x75e0888f1c91704db329ae582d30c4d1b0a31e0ac2335adaf48dfa11aae782fe",
  "owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
  "market": "0xc0e5e40386a753109cd818c4689b4ab19ff2c7fc2fa60152ebaf41f46516b7c0",
  "asset_id": "57061352122631432781883234753452233313802472679003458000984345030541545099404",
  "side": "BUY",
  "order_owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
  "original_size": "100",
  "size_matched": "0",
  "price": "0.01",
  "associate_trades": [],
  "outcome": "Up",
  "type": "PLACEMENT",
  "created_at": "1770900788",
  "expiration": "0",
  "order_type": "GTC",
  "status": "LIVE",
  "maker_address": "0xC41997C65144683AB62051EDd1f80B034756E588",
  "timestamp": "1770900788146",
  "event_type": "order"
}

//--------------------------------
trade update:
{
    "id": "0x75e0888f1c91704db329ae582d30c4d1b0a31e0ac2335adaf48dfa11aae782fe",
    "type": "CANCELLATION",
    "side": "BUY",
    "price": "0.01",
    "original_size": "100",
    "size_matched": "0",
    "asset_id": "57061352122631432781883234753452233313802472679003458000984345030541545099404",
    "market": "0xc0e5e40386a753109cd818c4689b4ab19ff2c7fc2fa60152ebaf41f46516b7c0"
}
source data:
{
    "id": "0x75e0888f1c91704db329ae582d30c4d1b0a31e0ac2335adaf48dfa11aae782fe",
    "owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
    "market": "0xc0e5e40386a753109cd818c4689b4ab19ff2c7fc2fa60152ebaf41f46516b7c0",
    "asset_id": "57061352122631432781883234753452233313802472679003458000984345030541545099404",
    "side": "BUY",
    "order_owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
    "original_size": "100",
    "size_matched": "0",
    "price": "0.01",
    "associate_trades": [],
    "outcome": "Up",
    "type": "CANCELLATION",
    "created_at": "1770900788",
    "expiration": "0",
    "order_type": "GTC",
    "status": "CANCELED",
    "maker_address": "0xC41997C65144683AB62051EDd1f80B034756E588",
    "timestamp": "1770900818485",
    "event_type": "order"
}
*/
