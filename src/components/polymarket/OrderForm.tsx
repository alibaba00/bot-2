import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import type { PlaceOrderParams } from '@/lib/polymarket/types'
import { usePolymarketOrders, usePolymarketMarkets } from '@/lib/polymarket/store'

interface OrderFormProps {
	marketId?: string
	onSuccess?: () => void
	onCancel?: () => void
}

export function OrderForm({ marketId, onSuccess, onCancel }: OrderFormProps) {
	const { placeOrder } = usePolymarketOrders()
	const { markets, selectedMarket } = usePolymarketMarkets()

	const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
	const [outcome, setOutcome] = useState<'YES' | 'NO'>('YES')
	const [price, setPrice] = useState<string>('')
	const [quantity, setQuantity] = useState<string>('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const market = selectedMarket || markets.find((m) => m.id === marketId)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		if (!market) {
			setError('Please select a market')
			return
		}

		const priceNum = parseFloat(price)
		const quantityNum = parseFloat(quantity)

		if (isNaN(priceNum) || priceNum <= 0 || priceNum > 1) {
			setError('Price must be between 0 and 1')
			return
		}

		if (isNaN(quantityNum) || quantityNum <= 0) {
			setError('Quantity must be greater than 0')
			return
		}

		setLoading(true)
		try {
			const params: PlaceOrderParams = {
				marketId: market.id,
				outcome,
				side,
				price: priceNum,
				quantity: quantityNum
			}

			await placeOrder(params)
			onSuccess?.()

			// Reset form
			setPrice('')
			setQuantity('')
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to place order')
		} finally {
			setLoading(false)
		}
	}

	if (!market) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Place Order</CardTitle>
					<CardDescription>Please select a market first</CardDescription>
				</CardHeader>
			</Card>
		)
	}

	const yesOutcome = market.outcomes.find((o) => o.title.toUpperCase().includes('YES'))
	const noOutcome = market.outcomes.find((o) => o.title.toUpperCase().includes('NO'))

	return (
		<Card>
			<CardHeader>
				<CardTitle>Place Order</CardTitle>
				<CardDescription>{market.question}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className='space-y-4'>
					{error && (
						<div className='p-3 text-sm text-destructive bg-destructive/10 rounded-md'>
							{error}
						</div>
					)}

					<div className='space-y-2'>
						<Label>Side</Label>
						<Select value={side} onValueChange={(v) => setSide(v as 'BUY' | 'SELL')}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='BUY'>Buy</SelectItem>
								<SelectItem value='SELL'>Sell</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className='space-y-2'>
						<Label>Outcome</Label>
						<Select
							value={outcome}
							onValueChange={(v) => setOutcome(v as 'YES' | 'NO')}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{yesOutcome && (
									<SelectItem value='YES'>
										YES ({(yesOutcome.price * 100).toFixed(1)}%)
									</SelectItem>
								)}
								{noOutcome && (
									<SelectItem value='NO'>
										NO ({(noOutcome.price * 100).toFixed(1)}%)
									</SelectItem>
								)}
							</SelectContent>
						</Select>
					</div>

					<div className='space-y-2'>
						<Label>Price (0-1)</Label>
						<Input
							type='number'
							step='0.01'
							min='0'
							max='1'
							value={price}
							onChange={(e) => setPrice(e.target.value)}
							placeholder='0.50'
							required
						/>
						<p className='text-xs text-muted-foreground'>
							Current:{' '}
							{(outcome === 'YES' ? yesOutcome?.price : noOutcome?.price)
								? (
										(outcome === 'YES' ? yesOutcome!.price : noOutcome!.price) *
										100
									).toFixed(1) + '%'
								: 'N/A'}
						</p>
					</div>

					<div className='space-y-2'>
						<Label>Quantity</Label>
						<Input
							type='number'
							step='0.01'
							min='0'
							value={quantity}
							onChange={(e) => setQuantity(e.target.value)}
							placeholder='10'
							required
						/>
					</div>

					<div className='flex gap-2'>
						<Button type='submit' disabled={loading} className='flex-1'>
							{loading ? 'Placing...' : 'Place Order'}
						</Button>
						{onCancel && (
							<Button type='button' variant='outline' onClick={onCancel}>
								Cancel
							</Button>
						)}
					</div>
				</form>
			</CardContent>
		</Card>
	)
}
