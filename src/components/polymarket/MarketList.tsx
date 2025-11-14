import { Skeleton } from '@/components/ui/skeleton'
import { MarketCard } from './MarketCard'
import type { Market } from '@/lib/polymarket/types'

interface MarketListProps {
	markets: Market[]
	loading: boolean
	onMarketSelect?: (market: Market) => void
}

export function MarketList({ markets, loading, onMarketSelect }: MarketListProps) {
	if (loading) {
		return (
			<div className="space-y-4">
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-24 w-full" />
				))}
			</div>
		)
	}

	if (markets.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				<p>No markets available</p>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{markets.map((market) => (
				<MarketCard
					key={market.id}
					market={market}
					onClick={() => onMarketSelect?.(market)}
				/>
			))}
		</div>
	)
}

