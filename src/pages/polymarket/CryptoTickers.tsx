import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEffect, useState } from 'react'
import PageView from '@/components/PageView'
// import PolymarketApi from './PolymarketApi'
import CryptoTickerPage from './CryptoTickerPage'

const content = [
	{
		label: 'BTC',
		value: 'btc',
		page: <CryptoTickerPage symbol='btc' type='updown-15m' />
	},
	{
		label: 'ETH',
		value: 'eth',
		page: <CryptoTickerPage symbol='eth' type='updown-15m' />,
	},
	{
		label: 'SOL',
		value: 'sol',
		page: <CryptoTickerPage symbol='sol' type='updown-15m' />,
	},
	{
		label: 'XRP',
		value: 'xrp',
		page: <CryptoTickerPage symbol='xrp' type='updown-15m' />,
	}
]

export default function CryptoTickers() {
	const [activeNode, setActiveNode] = useState(null)
	// const [markets, setMarkets] = useState([])

	useEffect(() => {
		// PolymarketApi.init().then((result) => {
		// 	console.log('result', result)
		// 	setMarkets(result)
		// })
	}, [])

	return (
		<div className='p-4 w-full'>
			<Tabs
				value={activeNode?.value}
				onValueChange={(value) =>
					setActiveNode(content.find((node) => node.value === value) ?? content[0])
				}
				className='w-full'>
				<TabsList className='text-foreground h-auto w-full rounded-none border-b bg-transparent px-0 py-1'>
					{content.map((tab) => (
						<TabsTrigger
							key={tab.value}
							value={tab.value}
							className='flex-1 hover:bg-accent hover:text-foreground data-[state=active]:after:bg-primary data-[state=active]:hover:bg-accent relative after:absolute after:inset-x-0 after:bottom-0 after:-mb-1 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none'>
							{tab.label}
						</TabsTrigger>
					))}
				</TabsList>

				<PageView
					content={content}
					selectedNode={activeNode}
					autoMount={false}
					// autoUnmount={false}
				/>
			</Tabs>
		</div>
	)
}
