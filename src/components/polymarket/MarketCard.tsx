import { Card, CardContent } from '@/components/ui/card'
import type { MarketData } from '@/lib/polymarket/types'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface MarketCardProps {
	market: MarketData
	onClick?: () => void
}

export function MarketCard({ market, onClick }: MarketCardProps) {
	const yesOutcome = market.outcomes.find((o) => o.title.toUpperCase().includes('YES'))
	const noOutcome = market.outcomes.find((o) => o.title.toUpperCase().includes('NO'))

	const yesPrice = yesOutcome?.price || 0
	const noPrice = noOutcome?.price || 0

	return (
		<Card
			className={onClick ? 'cursor-pointer hover:bg-accent transition-colors' : ''}
			onClick={onClick}>
			<CardContent className='p-4'>
				<div className='space-y-3'>
					<h3 className='font-semibold line-clamp-2'>{market.question}</h3>

					<div className='flex items-center justify-between gap-4'>
						<div className='flex-1'>
							<div className='flex items-center gap-2 text-sm text-muted-foreground'>
								<span>Volume:</span>
								<span className='font-medium'>{market.volume.toFixed(2)}</span>
							</div>
							<div className='flex items-center gap-2 text-sm text-muted-foreground'>
								<span>Liquidity:</span>
								<span className='font-medium'>{market.liquidity.toFixed(2)}</span>
							</div>
						</div>

						<div className='flex gap-4'>
							{yesOutcome && (
								<div className='text-right'>
									<div className='text-xs text-muted-foreground'>YES</div>
									<div className='flex items-center gap-1 font-bold text-green-600'>
										<TrendingUp className='h-3 w-3' />
										{(yesPrice * 100).toFixed(1)}%
									</div>
								</div>
							)}
							{noOutcome && (
								<div className='text-right'>
									<div className='text-xs text-muted-foreground'>NO</div>
									<div className='flex items-center gap-1 font-bold text-red-600'>
										<TrendingDown className='h-3 w-3' />
										{(noPrice * 100).toFixed(1)}%
									</div>
								</div>
							)}
						</div>
					</div>

					{market.closed && (
						<div className='text-xs text-muted-foreground'>Market Closed</div>
					)}
				</div>
			</CardContent>
		</Card>
	)
}
