import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OrderList } from '@/components/polymarket/OrderList'
import { OrderForm } from '@/components/polymarket/OrderForm'
import { usePolymarketOrders, usePolymarketMarkets } from '@/lib/polymarket/store'
import { RefreshCw } from 'lucide-react'

export default function OrdersPage() {
	const { orders, loading, fetchOrders, cancelAllOrders } = usePolymarketOrders()
	const { selectedMarket } = usePolymarketMarkets()

	useEffect(() => {
		fetchOrders()
	}, [])

	const handleRefresh = () => {
		fetchOrders()
	}

	const handleCancelAll = async () => {
		if (confirm('Are you sure you want to cancel all orders?')) {
			try {
				await cancelAllOrders()
			} catch (error) {
				console.error('Error cancelling all orders:', error)
				alert('Failed to cancel all orders')
			}
		}
	}

	return (
		<div className='flex flex-1 flex-col gap-6 p-4 pt-0 pb-16'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-3xl font-bold'>Orders</h1>
					<p className='text-muted-foreground mt-1'>Manage your open and recent orders</p>
				</div>
				<div className='flex gap-2'>
					<Button variant='outline' onClick={handleRefresh}>
						<RefreshCw className='h-4 w-4 mr-2' />
						Refresh
					</Button>
					{orders.length > 0 && (
						<Button variant='destructive' onClick={handleCancelAll}>
							Cancel All
						</Button>
					)}
				</div>
			</div>

			<div className='grid gap-6 md:grid-cols-2'>
				<Card>
					<CardHeader>
						<CardTitle>Open Orders</CardTitle>
						<CardDescription>
							{
								orders.filter((o) => o.status === 'OPEN' || o.status === 'PENDING')
									.length
							}{' '}
							open order
							{orders.filter((o) => o.status === 'OPEN' || o.status === 'PENDING')
								.length !== 1
								? 's'
								: ''}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<OrderList
							orders={orders.filter(
								(o) => o.status === 'OPEN' || o.status === 'PENDING'
							)}
							loading={loading}
							showCancel={true}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Place New Order</CardTitle>
						<CardDescription>
							{selectedMarket
								? selectedMarket.question
								: 'Select a market to place an order'}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<OrderForm marketId={selectedMarket?.id} />
					</CardContent>
				</Card>
			</div>

			{orders.filter((o) => o.status !== 'OPEN' && o.status !== 'PENDING').length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Order History</CardTitle>
						<CardDescription>
							Recent completed, cancelled, and expired orders
						</CardDescription>
					</CardHeader>
					<CardContent>
						<OrderList
							orders={orders.filter(
								(o) => o.status !== 'OPEN' && o.status !== 'PENDING'
							)}
							loading={loading}
							showCancel={false}
						/>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
