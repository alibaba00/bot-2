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
				<div className="space-y-4">
					<div className="grid gap-4 md:grid-cols-3">
						<div>
							<p className="text-sm text-muted-foreground">CLOB Exchange Balance</p>
							<p className="text-2xl font-bold">
								{balance.total.toFixed(2)} {balance.currency}
							</p>
							<p className="text-xs text-muted-foreground mt-1">
								Available for API trading
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
					{balance.onChainBalance !== undefined && balance.onChainBalance > 0 && (
						<div className="pt-4 border-t">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-muted-foreground">On-Chain Wallet Balance</p>
									<p className="text-xl font-semibold">
										{balance.onChainBalance.toFixed(2)} {balance.currency}
									</p>
									<p className="text-xs text-muted-foreground mt-1">
										On Polygon network (not deposited to CLOB)
									</p>
								</div>
								{balance.onChainBalance > 0 && balance.total === 0 && (
									<div className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-950 px-3 py-2 rounded-md">
										⚠️ Deposit funds to CLOB exchange to trade via API
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	)
}

