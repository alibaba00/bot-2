import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEffect, useState } from 'react'
import PageView from '@/components/PageView'
import PolymarketApi from './PolymarketApi'
import CryptoTickerPage from './CryptoTickerPage'
import type { MarketState } from '@/lib/polymarket/types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useCryptoPricePoller } from '@/hooks/use-crypto-price-poller'
import type { CryptoPriceUpdate } from '@/lib/polymarket/crypto-price-poller'

const content = [
	{
		label: 'BTC',
		value: 'btc',
		binanceSymbol: 'btcusdt',
		page: <CryptoTickerPage symbol='btc' />
	},
	{
		label: 'ETH',
		value: 'eth',
		binanceSymbol: 'ethusdt',
		page: <CryptoTickerPage symbol='eth' />,
	},
	{
		label: 'SOL',
		value: 'sol',
		binanceSymbol: 'solusdt',
		page: <CryptoTickerPage symbol='sol' />,
	},
	{
		label: 'XRP',
		value: 'xrp',
		binanceSymbol: 'xrpusdt',
		page: <CryptoTickerPage symbol='xrp' />,
	}
]

export default function CryptoTickers() {
	const [activeNode, setActiveNode] = useState(content[0])
	// const [markets, setMarkets] = useState([])
	// const onTimer = useMarketTimer(15)
	// console.log('onTimer', onTimer)
	const tradingActive = PolymarketApi.use('tradingActive')
	const tickerActive = PolymarketApi.use('tickerActive')
	const pollingActive = PolymarketApi.use('pollingActive')
	const isActive = PolymarketApi.use('marketActive')
	const isLogging = PolymarketApi.use('loggingActive')

	// Get all symbols for Polling (all 4 assets when active, using Binance format)
	const activePollingSymbols = pollingActive
	? content.map((config) => config.binanceSymbol)
	: []


	const polling = useCryptoPricePoller({
		source: 'binance',
		symbols: activePollingSymbols,
		onPriceUpdate: (update: CryptoPriceUpdate) => {
			const config = content.find(
				(c) => c.binanceSymbol.toLowerCase() === update.symbol.toLowerCase()
			)
			if (config) {
				const symbol = config.value
				const lastPrice = PolymarketApi.get('pollingPrice-' + symbol) as {timestamp: number, price: number} | null
				if (update.value !== lastPrice?.price) {
					PolymarketApi.onPollingLog(symbol, update.timestamp, update.value)
				}
			}
		},
		onError: (err) => {
			console.error('Polling error:', err)
		},
		autoStart: false
	})

	useEffect(() => {
		if (polling.status === 'polling') {
			polling.updateSymbols(activePollingSymbols)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activePollingSymbols.join(',')])

	// Start/stop polling based on active state
	useEffect(() => {
		if (pollingActive) {
			// Start polling if not already polling
			if (polling.status === 'stopped') {
				polling.start()
			}
		} else {
			// Stop polling if active
			if (polling.status === 'polling') {
				polling.stop()
			}
			// Don't clear prices - keep last value but it will be grayed out
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pollingActive])
	

	return (
		<div className='p-4 w-full'>
			<Tabs
				value={(activeNode as any)?.value ?? ''}
				onValueChange={(value) =>
					setActiveNode(content.find((node) => node.value === value) ?? content[0] as any)
				}
				className='w-full'>

				<div className='flex items-center gap-2 h-8'>
					<div className='flex items-center gap-4'>
						<MarketTimer minutes={15} type={'updown-15m'} />
						{/* <MarketTimer minutes={60} type={type} /> */}
						{/* https://polymarket.com/_next/data/FT6aYvzrNjMngWuxKlVC4/event/bitcoin-up-or-down-december-21-7pm-et.json?slug=bitcoin-up-or-down-december-21-7pm-et */}
						<MarketTimer minutes={60 * 4} type={'updown-4h'} offset={-3600} />
						
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
						{isActive &&
							<Button
								onClick={() => PolymarketApi.set('tradingActive', !tradingActive)}
								variant={tradingActive ? 'destructive' : 'outline'}
								size='sm'
								>
								{tradingActive ? 'Stop Trading' : 'Start Trading'}
							</Button>
						}
					</div>
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

				<TabsList className='text-foreground h-auto w-full rounded-none border-b bg-transparent px-0 py-1'>
					{content.map((tab) => (
						<TabsTrigger
							key={tab.value}
							value={tab.value}
							className='flex-1 hover:bg-accent hover:text-foreground data-[state=active]:after:bg-primary data-[state=active]:hover:bg-accent relative after:absolute after:inset-x-0 after:bottom-0 after:-mb-1 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none'>
							{tab.label}
							<MarketStateIndicator type={'updown-15m'} symbol={tab.value} />
							<MarketStateIndicator type={'updown-4h'} symbol={tab.value} />
						</TabsTrigger>
					))}
				</TabsList>

				<PageView
					content={content}
					selectedNode={activeNode}
					autoMount={true}
					// autoUnmount={false}
				/>
			</Tabs>
		</div>
	)
}

// MarketState = 'init' | 'pending' | 'started' | 'running' | 'completed' | 'closed' | 'failed'
const marketStateColors = {
	running: 'green',
	completed: 'yellow',
	pending: 'yellow',
	started: 'orange',
	failed: 'red',
	init: 'gray',
	closed: 'gray',
	undefined: 'gray',
}
const MarketStateIndicator = ({ type, symbol }: { type: string, symbol: string }) => {
	const marketState = PolymarketApi.use('marketState-' + type + '-' + symbol)

	return (
		<div className='flex flex-col items-center justify-center'>
			<div className='text-2xl font-bold rounded-full w-3 h-3 bg-gray-600 ml-2 mt-0.5'
			style={{backgroundColor: marketStateColors[marketState as MarketState]}}></div>
		</div>
	)
}


const MarketTimer = ({minutes, type, offset = 0}: {minutes: number, type: string, offset?: number}) => {
	const timer = useMarketTimer(minutes, offset, () => {
		console.log('timer expired!')
		// PolymarketApi.set('tradingActive', false)
		PolymarketApi.set('marketCompleted-' + type, true)
		setTimeout(() => {
			PolymarketApi.set('marketCompleted-' + type, false)
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
const useMarketTimer = (minutes: number = 15, offset: number = 0, onExpired?: () => void) => {
	const [timer, setTimer] = useState<{hours: number, minutes: number, seconds: number, timeString: string}>({
		hours: 0,
		minutes: 0,
		seconds: 0,
		timeString: '--:--:--'
	})

	useEffect(() => {
		let interval: NodeJS.Timeout | null = null
		const now = Date.now() + offset * 1000
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
					hours: Math.floor(time / 3600),
					minutes: Math.floor((time % 3600) / 60),
					seconds: time % 60,
					timeString: `${Math.floor(time / 3600).toString().padStart(2, '0')}:${Math.floor((time % 3600) / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`
				})
			}, 1000)
		}, diffToNextSecond)

		return () => {
			if (interval) clearInterval(interval)
		}
	}, [])

	return timer
}
