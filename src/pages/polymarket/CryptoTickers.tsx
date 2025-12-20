import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEffect, useState } from 'react'
import PageView from '@/components/PageView'
import PolymarketApi from './PolymarketApi'
import CryptoTickerPage from './CryptoTickerPage'
import type { MarketState } from '@/lib/polymarket/types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

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
	const [activeNode, setActiveNode] = useState(content[0])
	// const [markets, setMarkets] = useState([])
	// const onTimer = useMarketTimer(15)
	// console.log('onTimer', onTimer)
	const tradingActive = PolymarketApi.use('tradingActive')
	const tickerActive = PolymarketApi.use('tickerActive')
	const isActive = PolymarketApi.use('marketActive')
	const isLogging = PolymarketApi.use('loggingActive')
	const pollingActive = PolymarketApi.use('pollingActive')


	return (
		<div className='p-4 w-full'>
			<Tabs
				value={(activeNode as any)?.value ?? ''}
				onValueChange={(value) =>
					setActiveNode(content.find((node) => node.value === value) ?? content[0] as any)
				}
				className='w-full'>

				<div className='flex items-center gap-2 h-8'>
					{isActive &&
					<div className='flex items-center gap-4'>
						<MarketTimer />
						<Button
							onClick={() => PolymarketApi.set('tickerActive', !tickerActive)}
							variant={tickerActive ? 'destructive' : 'outline'}
							size='sm'
							>
							{tickerActive ? 'Stop Ticker' : 'Start Ticker'}
						</Button>
						<Button
							onClick={() => PolymarketApi.set('pollingActive', !pollingActive)}
							variant={pollingActive ? 'destructive' : 'outline'}
							size='sm'
							>
							{pollingActive ? 'Stop Polling' : 'Start Polling'}
						</Button>
						<Button
							onClick={() => PolymarketApi.set('tradingActive', !tradingActive)}
							variant={tradingActive ? 'destructive' : 'outline'}
							size='sm'
							>
							{tradingActive ? 'Stop Trading' : 'Start Trading'}
						</Button>
					</div>
					}
					<div className='text-sm text-muted-foreground ml-auto mr-6'>Root: {PolymarketApi.rootPath}</div>
					<Label className='text-sm text-muted-foreground'>Activ</Label>
					<Switch
						checked={isActive}
						onCheckedChange={() => PolymarketApi.set('marketActive', !isActive)}
						className='ml-0'
					/>
					<Label className='text-sm text-muted-foreground ml-4'>Logging</Label>
					<Switch
						checked={isLogging}
						onCheckedChange={() => PolymarketApi.set('loggingActive', !isLogging)}
						className='ml-0'
					/>
				</div>

				{isActive &&
				<>
				<TabsList className='text-foreground h-auto w-full rounded-none border-b bg-transparent px-0 py-1'>
					{content.map((tab) => (
						<TabsTrigger
							key={tab.value}
							value={tab.value}
							className='flex-1 hover:bg-accent hover:text-foreground data-[state=active]:after:bg-primary data-[state=active]:hover:bg-accent relative after:absolute after:inset-x-0 after:bottom-0 after:-mb-1 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none'>
							{tab.label}
							<MarketStateIndicator symbol={tab.value} />
						</TabsTrigger>
					))}
				</TabsList>

				<PageView
					content={content}
					selectedNode={activeNode}
					autoMount={true}
					// autoUnmount={false}
				/>
				</>
				}
			</Tabs>
		</div>
	)
}

// MarketState = 'init' | 'pending' | 'started' | 'running' | 'completed' | 'closed' | 'failed'
const marketStateColors = {
	// trading: '#36f',
	running: 'green',
	completed: 'yellow',
	pending: 'yellow',
	started: 'orange',
	failed: 'red',
	init: 'gray',
	closed: 'gray',
}
const MarketStateIndicator = ({ symbol }: { symbol: string }) => {
	const marketState = PolymarketApi.use('marketState_' + symbol)

	return (
		<div className='flex flex-col items-center justify-center'>
			<div className='text-2xl font-bold rounded-full w-3 h-3 bg-green-500 ml-2 mt-0.5'
			style={{backgroundColor: marketStateColors[marketState as MarketState]}}></div>
		</div>
	)
}


const MarketTimer = () => {
	const timer = useMarketTimer(15, () => {
		console.log('timer expired!')
		// PolymarketApi.set('tradingActive', false)
		PolymarketApi.set('marketCompleted', true)
		setTimeout(() => {
			PolymarketApi.set('marketCompleted', false)
		}, 1000)	//wait 1 seconds before resetting marketCompleted
	})
	
	return (
		<div className='flex flex-col items-center justify-center'>
			<div className='text-2xl font-bold'>{timer.timeString}</div>
		</div>
	)
}


// ---------------------------------------------------------------------------- useMarketTimer
// minutes: 15
// onExpired: () => void
// return: {minutes: number, seconds: number, timeString: string}
const useMarketTimer = (minutes: number = 15, onExpired?: () => void) => {
	const [timer, setTimer] = useState<{minutes: number, seconds: number, timeString: string}>({
		minutes: 0,
		seconds: 0,
		timeString: '--:--'
	})

	useEffect(() => {
		let interval: NodeJS.Timeout | null = null
		const now = Date.now()
		const past = now % (minutes * 60 * 1000)
		const diffToNextSecond = 1000 - past % 1000
		const maxTime = Math.ceil(minutes * 60)
		let time = maxTime - Math.ceil(past / 1000)

		setTimeout(() => {
			interval = setInterval(() => {
				time --
				if (time <= 0){
					onExpired?.()
					time = maxTime
				}
				setTimer({
					minutes: Math.floor(time / 60),
					seconds: time % 60,
					timeString: `${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`
				})
			}, 1000)
		}, diffToNextSecond)

		return () => {
			if (interval) clearInterval(interval)
		}
	}, [])

	return timer
}
