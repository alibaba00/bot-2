import { Button } from "@/components/ui/button";
import { useUserChannelWebSocket } from "@/hooks/use-user-channel-websocket";
import { getOpenOrders } from "@/lib/polymarket/orders";
import type { WalletBalance } from "@/lib/polymarket/types";
import { getWalletBalance } from "@/lib/polymarket/wallet";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { TradeMessage, OrderMessage } from "@/lib/polymarket/user-channel-websocket";


export default function useUserChannel(
	{onTradeUpdate, onOrderUpdate, onError, onConnect, onDisconnect, autoConnect = false}:{
		onTradeUpdate: (trade: TradeMessage) => void,
		onOrderUpdate: (order: OrderMessage) => void,
		onError: (error: Error) => void,
		onConnect: () => void,
		onDisconnect: () => void,
		autoConnect?: boolean
	}) {

	const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null)
	const [orderStats, setOrderStats] = useState<{ total: number; open: number; pending: number }>({
		total: 0,
		open: 0,
		pending: 0
	})


	// Helper to update order statistics shown in header
	const updateOrderStats = (orders: OrderMessage[]) => {
		const total = orders.length
		const open = orders.filter(o => o.type === 'PLACEMENT').length
		const pending = orders.filter(o => o.type === 'UPDATE').length
		setOrderStats({ total, open, pending })
	}

	// ---------------------------------------------------------------------------- userChannelWs
	// User Channel WebSocket for real-time order/trade updates

	const userChannelWs = useUserChannelWebSocket({
		onTradeUpdate,
		onOrderUpdate,
		onError,
		onConnect,
		onDisconnect,
		autoConnect: autoConnect
	})

	useEffect(() => {
		// handleConnect()
	}, [])


	return {
		connect: () => userChannelWs.connect(),
		disconnect: () => userChannelWs.disconnect(),
		update: async () => {
			try {
				const balance = await getWalletBalance()
				setWalletBalance(balance)
				const orders = await getOpenOrders()
				updateOrderStats(orders as unknown as unknown as OrderMessage[])
			} catch (error: any) {
				console.error('Update Error', error)
			}
		},
		view: () => (
			<div className="border rounded-lg p-4 space-y-4 flex-1">
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
									// addLogEntry('Update Balance', balance)
									
									// Update orders
									const orders = await getOpenOrders()
									updateOrderStats(orders as unknown as unknown as OrderMessage[])
									// addLogEntry('Update Orders', orders)

								} catch (error: any) {
									console.error('Update Error', error)
									// addLogEntry('Update Error', { error: error.message || String(error) })
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
					<span className="text-sm font-medium mr-auto">User Channel WebSocket:</span>
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
			</div>
		)
	}
}

