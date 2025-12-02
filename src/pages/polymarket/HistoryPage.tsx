import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePolymarketTransactions } from '@/lib/polymarket/store'
import { RefreshCw } from 'lucide-react'
import type { Transaction } from '@/lib/polymarket/types'

export default function HistoryPage() {
	const { transactions, loading, fetchTransactions } = usePolymarketTransactions()

	useEffect(() => {
		fetchTransactions()
	}, [])

	const handleRefresh = () => {
		fetchTransactions()
	}

	return (
		<div className='flex flex-1 flex-col gap-6 p-4 pt-0 pb-16'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-3xl font-bold'>Transaction History</h1>
					<p className='text-muted-foreground mt-1'>
						View your trading history and transactions
					</p>
				</div>
				<Button variant='outline' onClick={handleRefresh}>
					<RefreshCw className='h-4 w-4 mr-2' />
					Refresh
				</Button>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Transactions</CardTitle>
					<CardDescription>
						{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}{' '}
						found
					</CardDescription>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className='space-y-2'>
							{[1, 2, 3, 4, 5].map((i) => (
								<Skeleton key={i} className='h-20 w-full' />
							))}
						</div>
					) : transactions.length === 0 ? (
						<div className='text-center py-8 text-muted-foreground'>
							<p>No transactions found</p>
						</div>
					) : (
						<div className='space-y-2'>
							{transactions.map((tx) => (
								<TransactionItem key={tx.id} transaction={tx} />
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
	return (
		<div className='flex items-center justify-between p-4 border rounded-lg'>
			<div className='flex-1'>
				<div className='flex items-center gap-2'>
					<span
						className={`font-semibold ${
							transaction.type === 'BUY' ? 'text-green-600' : 'text-red-600'
						}`}>
						{transaction.type}
					</span>
					{transaction.outcome && (
						<span className='text-sm text-muted-foreground'>{transaction.outcome}</span>
					)}
					{transaction.price && (
						<span className='text-sm text-muted-foreground'>
							@ {(transaction.price * 100).toFixed(1)}%
						</span>
					)}
				</div>
				<div className='text-sm text-muted-foreground mt-1'>
					Amount: {transaction.amount.toFixed(2)} | Status: {transaction.status}
				</div>
				<div className='text-xs text-muted-foreground mt-1'>
					{new Date(transaction.timestamp).toLocaleString()}
					{transaction.hash && (
						<span className='ml-2 font-mono'>{transaction.hash.slice(0, 10)}...</span>
					)}
				</div>
			</div>
		</div>
	)
}
