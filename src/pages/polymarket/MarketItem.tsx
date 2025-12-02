export default function MarketItem(props: { market: { slug?: string; description?: string } }) {
	const market = props.market

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex flex-col gap-2'>
				<div className='text-sm text-muted-foreground'>{market.slug}</div>
			</div>
			<div className='flex flex-col gap-2'>
				<div className='text-sm text-muted-foreground'>{market.description}</div>
			</div>
		</div>
	)
}
