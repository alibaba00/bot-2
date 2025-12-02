import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MarketList } from '@/components/polymarket/MarketList'
import { OrderForm } from '@/components/polymarket/OrderForm'
import { usePolymarketMarkets } from '@/lib/polymarket/store'
import { Search } from 'lucide-react'

export default function MarketsPage() {
	const { markets, loading, fetchMarkets, selectMarket, selectedMarket } = usePolymarketMarkets()
	const [searchQuery, setSearchQuery] = useState('')
	const [filteredMarkets, setFilteredMarkets] = useState(markets)

	useEffect(() => {
		fetchMarkets()
	}, [])

	useEffect(() => {
		if (searchQuery.trim() === '') {
			setFilteredMarkets(markets)
		} else {
			const filtered = markets.filter(
				(market) =>
					market.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
					market.description?.toLowerCase().includes(searchQuery.toLowerCase())
			)
			setFilteredMarkets(filtered)
		}
	}, [searchQuery, markets])

	return (
		<div className='flex flex-1 flex-col gap-6 p-4 pt-0 pb-16'>
			<div>
				<h1 className='text-3xl font-bold'>Markets</h1>
				<p className='text-muted-foreground mt-1'>Browse and search prediction markets</p>
			</div>

			<div className='flex gap-4'>
				<div className='flex-1 space-y-4'>
					<Card>
						<CardHeader>
							<CardTitle>Search Markets</CardTitle>
						</CardHeader>
						<CardContent>
							<div className='relative'>
								<Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
								<Input
									placeholder='Search markets...'
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className='pl-10'
								/>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>All Markets</CardTitle>
							<CardDescription>
								{filteredMarkets.length} market
								{filteredMarkets.length !== 1 ? 's' : ''} found
							</CardDescription>
						</CardHeader>
						<CardContent>
							<MarketList
								markets={filteredMarkets}
								loading={loading}
								onMarketSelect={selectMarket}
							/>
						</CardContent>
					</Card>
				</div>

				{selectedMarket && (
					<div className='w-96'>
						<OrderForm marketId={selectedMarket.id} />
					</div>
				)}
			</div>
		</div>
	)
}
