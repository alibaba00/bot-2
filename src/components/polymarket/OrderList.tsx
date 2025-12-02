import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import type { Order } from '@/lib/polymarket/types'
import { X } from 'lucide-react'
import { usePolymarketOrders } from '@/lib/polymarket/store'

interface OrderListProps {
	orders: Order[]
	loading: boolean
	showCancel?: boolean
}

export function OrderList({ orders, loading, showCancel = true }: OrderListProps) {
	const { cancelOrder } = usePolymarketOrders()

	const handleCancel = async (orderId: string) => {
		if (confirm('Are you sure you want to cancel this order?')) {
			try {
				await cancelOrder(orderId)
			} catch (error) {
				console.error('Error cancelling order:', error)
				alert('Failed to cancel order')
			}
		}
	}

	if (loading) {
		return (
			<div className='space-y-2'>
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className='h-16 w-full' />
				))}
			</div>
		)
	}

	if (orders.length === 0) {
		return (
			<div className='text-center py-8 text-muted-foreground'>
				<p>No orders found</p>
			</div>
		)
	}

	return (
		<div className='space-y-2'>
			{orders.map((order) => (
				<div
					key={order.id}
					className='flex items-center justify-between p-3 border rounded-lg'>
					<div className='flex-1'>
						<div className='flex items-center gap-2'>
							<span
								className={`font-semibold ${
									order.side === 'BUY' ? 'text-green-600' : 'text-red-600'
								}`}>
								{order.side}
							</span>
							<span className='text-sm text-muted-foreground'>{order.outcome}</span>
						</div>
						<div className='text-sm text-muted-foreground mt-1'>
							Price: {(order.price * 100).toFixed(1)}% | Qty:{' '}
							{order.quantity.toFixed(2)}
							{order.remainingQuantity !== undefined &&
								order.remainingQuantity !== order.quantity && (
									<span className='ml-2'>
										(Remaining: {order.remainingQuantity.toFixed(2)})
									</span>
								)}
						</div>
						<div className='text-xs text-muted-foreground mt-1'>
							Status: {order.status} | {new Date(order.createdAt).toLocaleString()}
						</div>
					</div>
					{showCancel && (order.status === 'OPEN' || order.status === 'PENDING') && (
						<Button
							variant='ghost'
							size='sm'
							onClick={() => handleCancel(order.id)}
							className='ml-2'>
							<X className='h-4 w-4' />
						</Button>
					)}
				</div>
			))}
		</div>
	)
}
