import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePolymarketConnection, usePolymarketMarkets, usePolymarketOrders, usePolymarketWallet } from '@/lib/polymarket/store'
import { WalletStatus } from '@/components/polymarket/WalletStatus'
import { MarketList } from '@/components/polymarket/MarketList'
import { OrderList } from '@/components/polymarket/OrderList'
import { PolymarketErrorBoundary } from '@/components/polymarket/ErrorBoundary'
import { WalletSetupGuide } from '@/components/polymarket/WalletSetupGuide'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function DashboardPage() {
	const { status, error, isConnected, connect, refresh } = usePolymarketConnection()
	const { markets, loading: marketsLoading, fetchMarkets } = usePolymarketMarkets()
	const { orders, loading: ordersLoading, fetchOrders } = usePolymarketOrders()
	const { balance, loading: walletLoading, fetchWallet } = usePolymarketWallet()

	useEffect(() => {
		if (isConnected) {
			fetchMarkets()
			fetchOrders()
			fetchWallet()
		}
	}, [isConnected])

	const handleConnect = async () => {
		await connect()
		if (isConnected) {
			fetchMarkets()
			fetchOrders()
			fetchWallet()
		}
	}

	const handleRefresh = async () => {
		await refresh()
		if (isConnected) {
			fetchMarkets(true)
			fetchOrders()
			fetchWallet()
		}
	}

	return (
		<PolymarketErrorBoundary>
			<div className="flex flex-1 flex-col gap-6 p-4 pt-0 pb-16">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Polymarket Dashboard</h1>
					<p className="text-muted-foreground mt-1">
						Manage your trading activities and monitor markets
					</p>
				</div>
				<div className="flex gap-2">
					{!isConnected && (
						<Button onClick={handleConnect} disabled={status === 'connecting'}>
							{status === 'connecting' ? 'Connecting...' : 'Connect'}
						</Button>
					)}
					{isConnected && (
						<Button variant="outline" onClick={handleRefresh}>
							<RefreshCw className="h-4 w-4 mr-2" />
							Refresh
						</Button>
					)}
				</div>
			</div>

			{/* Connection Status */}
			{status === 'error' && (
				<Card className="border-destructive">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-destructive">
							<AlertCircle className="h-5 w-5" />
							Connection Error
						</CardTitle>
						<CardDescription>{error || 'Failed to connect to Polymarket'}</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={handleConnect}>Retry Connection</Button>
					</CardContent>
				</Card>
			)}

			{!isConnected && status !== 'error' && (
				<Card>
					<CardHeader>
						<CardTitle>Not Connected</CardTitle>
						<CardDescription>
							Please connect to Polymarket to start trading
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={handleConnect} disabled={status === 'connecting'}>
							{status === 'connecting' ? 'Connecting...' : 'Connect to Polymarket'}
						</Button>
					</CardContent>
				</Card>
			)}

			{isConnected && (
				<>
					{/* Show wallet setup guide if no private key is configured */}
					{!import.meta.env.VITE_PRIVATE_KEY && (
						<WalletSetupGuide />
					)}

					{/* Wallet Status */}
					<WalletStatus balance={balance} loading={walletLoading} />

					{/* Markets and Orders Grid */}
					<div className="grid gap-6 md:grid-cols-2">
						{/* Markets */}
						<Card>
							<CardHeader>
								<CardTitle>Active Markets</CardTitle>
								<CardDescription>
									Browse and search prediction markets
								</CardDescription>
							</CardHeader>
							<CardContent>
								<MarketList 
									markets={markets.slice(0, 5)} 
									loading={marketsLoading}
								/>
							</CardContent>
						</Card>

						{/* Recent Orders */}
						<Card>
							<CardHeader>
								<CardTitle>Recent Orders</CardTitle>
								<CardDescription>
									View your open and recent orders
								</CardDescription>
							</CardHeader>
							<CardContent>
								<OrderList 
									orders={orders.slice(0, 5)} 
									loading={ordersLoading}
								/>
							</CardContent>
						</Card>
					</div>
				</>
			)}
			</div>
		</PolymarketErrorBoundary>
	)
}

