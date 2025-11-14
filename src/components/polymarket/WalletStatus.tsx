import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { WalletBalance } from '@/lib/polymarket/types'
import { Wallet } from 'lucide-react'

interface WalletStatusProps {
	balance: WalletBalance | null
	loading: boolean
}

export function WalletStatus({ balance, loading }: WalletStatusProps) {
	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Wallet className="h-5 w-5" />
						Wallet Balance
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						<Skeleton className="h-8 w-32" />
						<Skeleton className="h-4 w-24" />
					</div>
				</CardContent>
			</Card>
		)
	}

	if (!balance) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Wallet className="h-5 w-5" />
						Wallet Balance
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground">No balance data available</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Wallet className="h-5 w-5" />
					Wallet Balance
				</CardTitle>
				<CardDescription>Your current trading balance</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4 md:grid-cols-3">
					<div>
						<p className="text-sm text-muted-foreground">Total Balance</p>
						<p className="text-2xl font-bold">
							{balance.total.toFixed(2)} {balance.currency}
						</p>
					</div>
					<div>
						<p className="text-sm text-muted-foreground">Available</p>
						<p className="text-2xl font-semibold text-green-600">
							{balance.available.toFixed(2)} {balance.currency}
						</p>
					</div>
					<div>
						<p className="text-sm text-muted-foreground">Locked in Orders</p>
						<p className="text-2xl font-semibold text-orange-600">
							{balance.locked.toFixed(2)} {balance.currency}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

