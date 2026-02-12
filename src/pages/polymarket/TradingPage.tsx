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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select";
import { getAccountInfo, getTransactionHistory, getWalletBalance } from "@/lib/polymarket/wallet";
import { fetchMarketBySlugFromGamma, fetchMarkets } from "@/lib/polymarket/markets";
import { cancelOrder, getOpenOrders, placeOrder } from "@/lib/polymarket/orders";
import { useUserChannelWebSocket } from "@/hooks/use-user-channel-websocket";
import type { Order, WalletBalance } from "@/lib/polymarket/types";
import { RefreshCw } from "lucide-react";
// import { Side } from "@polymarket/clob-client";
import { Strategy1, Strategy2 } from "./Strategy";

export default function TradingPage() {
	const { status, connect } = usePolymarketConnection()

	// Trading console state
	const [marketSlug, setMarketSlug] = useState('btc-updown-15m-1770896700')
	const [orderType, setOrderType] = useState<'up' | 'down' | 'buy' | 'sell'>('up')
	const [price, setPrice] = useState('')
	const [size, setSize] = useState('')
	const [logEntries, setLogEntries] = useState<Array<{ timestamp: string; action: string; data: any }>>([])
	const [selectedOrderId, setSelectedOrderId] = useState('')
	const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null)
	const [orderStats, setOrderStats] = useState<{ total: number; open: number; pending: number }>({
		total: 0,
		open: 0,
		pending: 0
	})

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
		onOrderUpdate: (order) => {
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

	// --- cancel order
	const handleCancelOrder = async () => {
		console.log('handleCancelOrder ...')
		// const orderId = '0x3eb73f7df073f02049648d90871d2d411b2f3c4eefd3c8d84ea7d344d0a37f03';
		const orders = await getOpenOrders();
		const orderId = orders[0].id;
		console.log('orderId:', orderId);
		const order = await cancelOrder(orderId);
		console.log('order:', order);
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
	const handleOrderNow = async () => {
		try {
			addLogEntry('Order Now - Start', { marketSlug, orderType, price, size })
			
			if (!marketSlug || !price || !size) {
				addLogEntry('Order Now - Error', { error: 'Please fill in all fields' })
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

			// Determine side and outcome title based on orderType
			let side: 'BUY' | 'SELL' = 'BUY'
			let targetOutcomeTitle: string = ''

			if (orderType === 'up') {
				side = 'BUY'
				targetOutcomeTitle = 'UP'
			} else if (orderType === 'down') {
				side = 'BUY'
				targetOutcomeTitle = 'DOWN'
			} else if (orderType === 'buy') {
				side = 'BUY'
				// For buy, try UP first, then YES as fallback
				targetOutcomeTitle = 'UP'
			} else if (orderType === 'sell') {
				side = 'SELL'
				// For sell, try UP first, then YES as fallback
				targetOutcomeTitle = 'UP'
			}

			// Find outcome token ID - try exact match first, then fallback to YES/NO
			let outcomeObj = market.outcomes.find(o => 
				o.title.toUpperCase() === targetOutcomeTitle.toUpperCase()
			)

			// Fallback: if UP/DOWN not found, try YES/NO
			if (!outcomeObj) {
				if (orderType === 'up' || orderType === 'buy') {
					outcomeObj = market.outcomes.find(o => o.title.toUpperCase() === 'YES')
				} else if (orderType === 'down') {
					outcomeObj = market.outcomes.find(o => o.title.toUpperCase() === 'NO')
				} else if (orderType === 'sell') {
					outcomeObj = market.outcomes.find(o => o.title.toUpperCase() === 'YES')
				}
			}

			if (!outcomeObj) {
				addLogEntry('Order Now - Error', { 
					error: `Outcome not found in market. Available outcomes: ${market.outcomes.map(o => o.title).join(', ')}`,
					availableOutcomes: market.outcomes.map(o => o.title)
				})
				return
			}

			// Use the actual outcome title from the market for the API call
			const actualOutcome = outcomeObj.title.toUpperCase()

			// Place order
			const orderParams = {
				marketId: market.conditionId,
				price: parseFloat(price),
				quantity: parseFloat(size),
				side,
				outcome: actualOutcome,
				outcomeId: outcomeObj.id
			}

			addLogEntry('Place Order', orderParams)
			const result = await placeOrder(orderParams)
			addLogEntry('Order Now - Success', result)
		} catch (error: any) {
			addLogEntry('Order Now - Error', { error: error.message || String(error) })
			console.error('Error placing order:', error)
		}
	}

	const handleConsoleGetOrders = async () => {
		try {
			addLogEntry('Get Orders - Start', {})
			const orders = await getOpenOrders()
			updateOrderStats(orders)
			addLogEntry('Get Orders - Success', orders)
		} catch (error: any) {
			addLogEntry('Get Orders - Error', { error: error.message || String(error) })
			console.error('Error getting orders:', error)
		}
	}

	const handleConsoleCancelOrder = async () => {
		try {
			if (!selectedOrderId) {
				addLogEntry('Cancel Order - Error', { error: 'Please select an order ID' })
				return
			}

			addLogEntry('Cancel Order - Start', { orderId: selectedOrderId })
			const result = await cancelOrder(selectedOrderId)
			addLogEntry('Cancel Order - Success', result)
			setSelectedOrderId('') // Clear selection
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
				<Button variant='default' onClick={handleCancelOrder}>Cancel Order</Button>
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
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="market-slug">Market Slug</Label>
						<Input
							id="market-slug"
							value={marketSlug}
							onChange={(e) => setMarketSlug(e.target.value)}
							placeholder="btc-updown-15m-1770896700"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="order-type">Order Type</Label>
						<Select value={orderType} onValueChange={(v: 'up' | 'down' | 'buy' | 'sell') => setOrderType(v)}>
							<SelectTrigger id="order-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="up">Up (Buy YES)</SelectItem>
								<SelectItem value="down">Down (Buy NO)</SelectItem>
								<SelectItem value="buy">Buy</SelectItem>
								<SelectItem value="sell">Sell</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="price">Price (0-1)</Label>
						<Input
							id="price"
							type="number"
							step="0.01"
							min="0"
							max="1"
							value={price}
							onChange={(e) => setPrice(e.target.value)}
							placeholder="0.50"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="size">Size (Shares)</Label>
						<Input
							id="size"
							type="number"
							step="0.1"
							min="0"
							value={size}
							onChange={(e) => setSize(e.target.value)}
							placeholder="10"
						/>
					</div>
				</div>

				<div className="flex gap-2 flex-wrap">
					<Button variant="default" onClick={handleOrderNow}>
						Order Now
					</Button>
					<Button variant="default" onClick={handleConsoleGetOrders}>
						Get Orders
					</Button>
					<Button variant="default" onClick={handleConsoleCancelOrder}>
						Cancel Order
					</Button>
				</div>

				<div className="space-y-2">
					<Label htmlFor="order-id">Order ID (for cancel)</Label>
					<Input
						id="order-id"
						value={selectedOrderId}
						onChange={(e) => setSelectedOrderId(e.target.value)}
						placeholder="Enter order ID to cancel"
					/>
				</div>

				<div className="space-y-2">
					<Label>Log View</Label>
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
