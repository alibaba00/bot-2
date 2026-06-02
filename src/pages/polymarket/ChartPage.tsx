import { Button } from "@/components/ui/button";
import { Label } from '@/components/ui/label';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import ReactEcharts from 'echarts-for-react';
import { useEffect, useRef, useState } from "react";
import PolymarketApi from "./PolymarketApi";
import * as PolymarketChart from "./PolymarketChart";
import moment from "moment";
import { Switch } from "@/components/ui/switch";
import { lineChartOptions, barChartOptions, distChartOptions, scatterChartOptions, heatmapChartOptions } from "./ChartOptions";

const parseNumber = (num: number) => {
	return parseFloat(num.toFixed(12))
}

const assetContent = [
	{
		label: 'BTC',
		value: 'btc',
	},
	{
		label: 'ETH',
		value: 'eth',
	},
	{
		label: 'SOL',
		value: 'sol',
	},
	{
		label: 'XRP',
		value: 'xrp',
	},
	{
		label: 'DOGE',
		value: 'doge',
	},
	{
		label: 'HYPE',
		value: 'hype',
	},
	{
		label: 'BNB',
		value: 'bnb',
	},
	{
		label: 'ALL',
		value: 'all',
	},
	{
		label: 'Filtered',
		value: 'filtered',
	},
] as any


const lineStyle: any = {
	dist: {
		color: '#0fcc',
		width: 0.5,
	},
	up: {
		color: '#0f0c',
		width: 0.5,
	},
	down: {
		color: '#f00c',
		width: 0.5,
	},
	chainline: {
		color: '#06fc',
		width: 0.5,
	},
	polling: {
		color: '#93fc',
		width: 0.5,
	},
	coinbase: {
		color: '#ff06',
		width: 0.5,
	},
	grid: {
		color: 'green',
		width: 0.5,
	},
	binance: {
		color: 'violet',
		width: 0.5,
	},
} as any





// const chartData = {} as any
const seriesContent = ['up', 'down', 'chainline', 'coinbase', 'kraken', 'dist', 'binance', 'polling']
const chartDistributionData: any = {} as any
const autpUpdateInterval = 1000 * 60 * 60 // 1 hour
let autoUpdateTimer: any = null


export default function ChartPage() {
	const [asset, setAsset] = useState(assetContent[0])
	const [selectedDate, setSelectedDate] = useState(new Date())
	// const [chartOptions, setChartOptions] = useState({line: lineChartOptions, bar: barChartOptions, heatmap: heatmapChartOptions})
	const [chartOptions, setChartOptions] = useState({})
	const [chartType, setChartType] = useState('line')
	const [marketType, setMarketType] = useState('all')
	const [side, setSide] = useState('up')
	const [selectedMarket, setSelectedMarket] = useState<any>(null)
	const [isAutoUpdate, setIsAutoUpdate] = useState(true)
	// const isLogging = PolymarketApi.use('loggingActive')
	const [selectedSeries, setSelectedSeries] = useState<string[]>(seriesContent)


	useEffect(() => {
		if (autoUpdateTimer) clearInterval(autoUpdateTimer)
		if (isAutoUpdate){
			console.log('-------------autoUpdateTimer:', isAutoUpdate, autpUpdateInterval)
			autoUpdateTimer = setInterval(() => {
				PolymarketChart.updateAllMarketData_clob()
			}, autpUpdateInterval)
		}
		return () => {
			if (autoUpdateTimer) clearInterval(autoUpdateTimer)
		}
	}, [isAutoUpdate])


	// ---------------------------------------------------------------------------- parseLineData
	const parseLineData = (chartData: any) => {
		// if (!chartData.up.length || !chartData.down.length || !chartData.ticker.length) return
		// if (!chartData.ticker.length) return
		if (!selectedMarket || !chartData){
			setChartOptions({})
			return
		}
		const market = selectedMarket?.data
		const openPrice = market.openPrice
		const startTime = market.startTimestamp - PolymarketChart.preOffset
		const endTime = market.endTimestamp + PolymarketChart.postOffset
		const clobData = chartData.clob

		// add data to the end of the array if the last timestamp is less than the endTimestamp
		if (clobData.up?.length && clobData.down?.length) {
			if (clobData.up[clobData.up.length-1][0] < endTime) {
				clobData.up.push([endTime, clobData.up[clobData.up.length-1][1]])
			}
			if (clobData.down[clobData.down.length-1][0] < endTime) {
				clobData.down.push([endTime, clobData.down[clobData.down.length-1][1]])
			}
		}

		let minValue = Infinity
		let maxValue = -Infinity
		let value: number
		const chainlinkData = chartData.ticker?.chainlink?.map((item: any) => {
			value = ((item[1] / openPrice) - 1 ) * 100
			minValue = Math.min(minValue, value)
			maxValue = Math.max(maxValue, value)
			return [item[0], value] as any
		})
		// const minValue = chainlinkData.reduce((min: number, item: any) => Math.min(min, item[1]), Infinity)
		// const maxValue = chainlinkData.reduce((max: number, item: any) => Math.max(max, item[1]), -Infinity)
		// const scale = parseNumber(parseFloat(Math.max(Math.abs(minValue), Math.abs(maxValue)).toFixed(1)) + 0.2)
		const scale = parseNumber(parseFloat(Math.max(Math.abs(minValue), Math.abs(maxValue)).toFixed(2)) + 0.02)
		// const scale = 0.4

		// const firstPrice = chartData.ticker?.binance?.[0]?.[1]
		// const binanceData = chartData.ticker?.binance?.map((item: any) => {
		// 	return [item[0], ((item[1] / firstPrice) - 1 ) * 1000] as any
		// })
		// const minValue = binanceData.reduce((min: number, item: any) => Math.min(min, item[1]), Infinity)
		// const maxValue = binanceData.reduce((max: number, item: any) => Math.max(max, item[1]), -Infinity)
		// const scale = parseNumber(parseFloat((Math.max(Math.abs(minValue), Math.abs(maxValue)).toFixed(1))) + 0.2)

		const binanceData = chartData.ticker?.binance?.map((item: any) => {
			return [item[0], ((item[1] / openPrice) - 1 ) * 100] as any
		})
		// const minValue = binanceData.reduce((min: number, item: any) => Math.min(min, item[1]), Infinity)
		// const maxValue = binanceData.reduce((max: number, item: any) => Math.max(max, item[1]), -Infinity)
		// const scale = parseNumber(parseFloat(Math.max(Math.abs(minValue), Math.abs(maxValue)).toFixed(1)) + 0.2)
		const series: any[] = []

		const coinbaseData = chartData.ticker?.coinbase?.map((item: any) => {
			value = ((item[1] / openPrice) - 1 ) * 100		//coinbase price change in +/-percent
			return [item[0], value] as any
		})

		const targetPrice = chartData.dist || calcDistData()
		if (!targetPrice) return

		if (selectedSeries.includes('dist')) series.push({
			...lineChartOptions.series[0],
			data: targetPrice.dist,
			lineStyle: lineStyle.dist,
		})

		const firstPrice = chartData.ticker?.polling?.[0]?.[1]
		const pollingData = chartData.ticker?.polling?.map((item: any) => {
			return [item[0], ((item[1] / firstPrice) - 1 ) * 100] as any
		})

		const gridUpData = chartData._grid?.map((item: any) => {
			return [item[0], item[1]] as any
		})

		if (selectedSeries.includes('up')) series.push({
			...lineChartOptions.series[0],
			data: clobData.up						//up data (green)
		})
		if (selectedSeries.includes('down')) series.push({
			...lineChartOptions.series[1],
			data: clobData.down?.map(([timestamp, value]) => [timestamp, 1 - value])	//invert down data (red)
		})
		if (selectedSeries.includes('chainline')) series.push({
			...lineChartOptions.series[2],
			data: chainlinkData					//chainlink data (blue)
		})
		if (selectedSeries.includes('polling')) series.push({
			...lineChartOptions.series[3],
			data: pollingData
		})
		if (selectedSeries.includes('coinbase')) series.push({
			...lineChartOptions.series[4],
			data: coinbaseData
		})
		if (selectedSeries.includes('grid')) series.push({
			...lineChartOptions.series[5],
			data: gridUpData
		})	
		if (selectedSeries.includes('binance')) series.push({
			...lineChartOptions.series[6],
			data: binanceData
		})

		setChartOptions({
			...lineChartOptions,
			xAxis: [{
				...lineChartOptions.xAxis[0],
				min: startTime,
				max: endTime,
			}],
			yAxis: [
				lineChartOptions.yAxis[0] as any,
				{
					...lineChartOptions.yAxis[1] as any,
					min: -scale,
					max: +scale,
				} as any
			],
			series: series,
		})
	}


	// ---------------------------------------------------------------------------- parseDistData
	const parseDistData = () => {
		const market = selectedMarket?.data
		if (!market) return
		const chartData = market?.chartData
		const startTime = market.startTimestamp - PolymarketChart.preOffset
		const endTime = market.endTimestamp + PolymarketChart.postOffset
		const targetPrice = chartData.dist || calcDistData()
		if (!targetPrice) return

		setChartOptions({
			...distChartOptions,
			xAxis: [{
				...lineChartOptions.xAxis[0],
				min: startTime,
				max: endTime,
			}],
			series: [
				{
					...distChartOptions.series[0],
					data: targetPrice.dist,
					lineStyle: lineStyle.dist,
				},
				{
					...distChartOptions.series[1],
					data: targetPrice.up.map((item: any) => [item[0], item[1]]),
					lineStyle: lineStyle.up,
				},
				// {
				// 	...distChartOptions.series[2],
				// 	data: targetPrice.down.map((item: any) => [item[0], 1-item[1]]),
				// 	lineStyle: lineStyle.down,
				// },
				{
					...distChartOptions.series[2],
					data: targetPrice.up.map((item: any) => [item[0], item[3]])
				}
			],
		})
	}


	// ---------------------------------------------------------------------------- calcDistData
	const calcDistData = () => {
		const market = selectedMarket?.data
		if (!market) return
		// console.log('calcDistData:', market.symbol, '...')

		const distData = chartDistributionData[market.symbol]
		if (!distData) return null
		const endTimestamp = market.endTimestamp
		if (!endTimestamp) return null

		const openPrice = market.openPrice
		const baseData = market.chartData.ticker?.chainlink?.filter((item: any) => item[0] < endTimestamp)
			.map((item: any) => {
				const value = ((item[1] / openPrice) - 1 ) * 100		//coinbase price change in percent
				return [item[0], value] as any
			})
		if (!baseData) return null

		let float, fract_a, a0, a1, a, b, c, d, e, f, g, t0, t1, float_t, fract_t

		const targetData = baseData.filter((item: any) => item[0] < endTimestamp)
			.map((item: any) => {

			float = Math.max(Math.min(item[1] / 0.01 + 50, 100), 0)
		
			a0 = Math.floor(float)
			fract_a = float - a0
			a0 = Math.max(Math.min(a0, 99), 0) // 0 - 99
			a1 = a0 < 99 ? a0 + 1 : a0
		
			float_t = (endTimestamp - item[0]) / 60000
			t0 = Math.floor(float_t)
			fract_t = float_t - t0
		
			t0 = Math.max(Math.min(t0, 14), 0) - 1
			t1 = t0 < 14 ? t0 + 1 : t0
		
			a = distData[t1].bars[a0].ratio
			b = distData[t1].bars[a1].ratio
			c = t0 >= 0 ? distData[t0].bars[a0].ratio : item[1] > 0 ? 1 : 0
			d = t0 >= 0 ? distData[t0].bars[a1].ratio : item[1] > 0 ? 1 : 0
		
			e = a + (b - a) * fract_a
			f = c + (d - c) * fract_a
			g = f - (f - e) * fract_t

			return [item[0], g] as any
		})

		const upData = market.chartData.clob.up
		const downData = market.chartData.clob.down

		const up: any[] = mergeData(upData, targetData)
		const down: any[] = mergeData(downData, targetData)

		market.chartData.dist = {
			dist: targetData,
			up: calcData(up),
			down: calcData(down),
		}

		return market.chartData.dist
	}


	// ---------------------------------------------------------------------------- mergeData
	// data1 = upDownData, data2 = targetData
	const mergeData = (data1: any[], data2: any[]) => {
		let i1 = 0
		let i2 = 0
		const data: any[] = []

		while (data1[i1]){
			while (data2[i2] && data2[i2][0] < data1[i1][0]){
				if (data1[i1-1]) data.push([data2[i2][0], data1[i1-1][1], data2[i2][1]])
				i2++
			}
			if (data2[i2]?.[0] === data1[i1]?.[0]) i2++
			if (data2[i2-1]) data.push([data1[i1][0], data1[i1][1], data2[i2-1][1]])
			i1++
		}
		return data
	}


	// ---------------------------------------------------------------------------- calcData
	/*
	0 = timestamp
	1 = up/down price
	2 = target price
	3 = ratio
	*/
	const calcData = (data: any[]) => {
		let t, ud, v
		return data.map((item) => {
			ud = item[1]	//up/down price
			t = item[2]		//target price
			v = (t > ud) ? (t / ud - 1) : (1 - (1 - t) / (1 - ud))
			item[3] = v
			return item
			// return [item[0], v] as any
		})
	}


	// ---------------------------------------------------------------------------- useEffect selectedSeries
	useEffect(() => {
		updateChart()
	}, [selectedSeries])


	// ---------------------------------------------------------------------------- updateChart
	const updateChart = async () => {
		const symbol = asset?.value.toLowerCase()
		// console.log('updateChart:', chartType, symbol, selectedMarket?.slug || '')
		if (!symbol) return

		if (!chartDistributionData[symbol]){
			chartDistributionData[symbol] = 'loading...'
			chartDistributionData[symbol] = await PolymarketChart.getChartDistributionData(symbol)
		}

		if (chartType === 'bar'){
			console.log('updateChart:', symbol, chartType)
			
			// const heatmap = await PolymarketApi.store.getItem('heatmap')
			// const chartDistributionData = await PolymarketApi.store.getItem(symbol + '-chartDistributionData')
			// if (!chartDistributionData) return setChartOptions({})

			setChartOptions({
				...barChartOptions,
				series: [{
					...barChartOptions.series[0],
					// data: data.map((item) => [item.value, item.count])
					// data: data.map((item) => [item.index, item.value])
					data: chartDistributionData[symbol]?.[14]?.bars?.length ?
						chartDistributionData[symbol][14].bars.map((item) => [item.index, item.value_s])  : []
					// data: data.map((item) => [item.index, item.ratio])
				},
				// {
				// 	...barChartOptions.series[0],
				// 	data: chartDistributionData[0].bars.map((item) => [item.index, item.value_s])
				// }
			],
			})
			return
		}

		if (chartType === 'dist'){
			// console.log('updateChart:', symbol, chartType)
			parseDistData()
			return
		}

		if (chartType === 'heatmap'){
			// console.log('updateChart:', symbol, chartType)
			// const data = await PolymarketChart.getChartDistributionData(symbol, '2026-02-08')
			const heatmap = await PolymarketApi.store.getItem('heatmap')
			if (!heatmap) return
			const map = heatmap[symbol + '-updown-15m']
			if (!map?.map){
				setChartOptions({})
				return
			}

			const data = map.map
			console.log('data:', data)
			const hmap: any[] = []
			data.forEach((item, colIndex) => {
				item.forEach((row, rowIndex) => {
					hmap.push([colIndex, rowIndex, ((row.up * 2) - 1) * 8 * row.weight])
				})
			})
			setChartOptions({
				...heatmapChartOptions,
				series: [{
					...heatmapChartOptions.series[0],
					data: hmap,
				}],
			})
			return
		}

		const chartData = selectedMarket?.data?.chartData
		if (!chartData) return setChartOptions({})

		switch (chartType) {
		case 'line':
			parseLineData(chartData)		//symbol is in selectedMarket.symbol
			break

		case 'heatmap':
			// if (!chartData.heatmap){
			// 	const data2 = await PolymarketChart.heatmapData()
			// 	console.log('data:', data2)
			// 	chartData.heatmap = data2
			// }
			// setChartOptions({
			// 	...heatmapChartOptions,
			// 	series: [{
			// 		...heatmapChartOptions.series[0],
			// 		data: chartData.heatmap[asset.value][side].map((item) => [item.col, item.row, item.value]),
			// 	}],
			// })
			break

		case 'scatter':
			if (!chartData.scatter){
				const data2 = await PolymarketChart.scatterData()
				console.log('data:', data2)
				chartData.scatter = data2
			}
			setChartOptions({
				...scatterChartOptions,
				series: [
					{
						...scatterChartOptions.series[0],
						data: chartData.scatter[asset.value][side].win.map((item) => [item.time, item.value]),
					},
					{
						...scatterChartOptions.series[1],
						data: chartData.scatter[asset.value][side].lose.map((item) => [item.time, item.value]),
					}
				],
			})
			break
		}
	}

	useEffect(() => {
		updateChart()
	}, [chartType, asset, side, selectedMarket])


	return (
		<ResizablePanelGroup direction='vertical'>
			<ResizablePanel defaultSize={50}>
				<div className='h-full w-full flex flex-col gap-4 p-4'>
					<div className='flex flex-row flex-wrap items-center gap-4'>
						<Label className='text-sm text-muted-foreground ml-4'>Logging</Label>
						{/* <Switch
							checked={isLogging}
							onCheckedChange={() => PolymarketApi.set('loggingActive', !isLogging)}
							className='ml-0'
						/> */}

						{/* <Button onClick={() => PolymarketChart.updateLogfiles()}>Update logfiles</Button> */}

						{/* <Button onClick={() => PolymarketChart.updateOldLogs()}>
							Update old logs
						</Button> */}

						<Button onClick={() => PolymarketChart.updateAllMarketData_clob()}>
							Update clob data
						</Button>

						<Button onClick={() => PolymarketChart.updateAllMarketData_clob(true)}>
							Update all clob data
						</Button>

						<Button onClick={() => PolymarketChart.fixingClobData()}>
							Fixing clob data
						</Button>

						<ToggleGroup type='single' defaultValue='line' value={chartType}
							onValueChange={(value: string) => {if (value) setChartType(value)}}>
							<ToggleGroupItem value='line' variant='outline'>Line</ToggleGroupItem>
							<ToggleGroupItem value='bar' variant='outline'>Bar</ToggleGroupItem>
							<ToggleGroupItem value='dist' variant='outline'>Dist</ToggleGroupItem>
							<ToggleGroupItem value='heatmap' variant='outline'>Heatmap</ToggleGroupItem>
							<ToggleGroupItem value='scatter' variant='outline'>Scatter</ToggleGroupItem>
						</ToggleGroup>

						<ToggleGroup type='single' defaultValue='up' value={side}
							onValueChange={(value: string) => {if (value) setSide(value)}}>
							<ToggleGroupItem value='up' variant='outline'>Up</ToggleGroupItem>
							<ToggleGroupItem value='down' variant='outline'>Down</ToggleGroupItem>
						</ToggleGroup>

						<Button onClick={() => PolymarketChart.getChartDistributionData(asset?.value)}>
							data test
						</Button>
						{/* <Button onClick={() => PolymarketChart.fixingClobData()}>
							fixing data
						</Button> */}
						<Label className="text-sm font-medium select-none ml-4">auto update</Label>
						<Switch
							checked={isAutoUpdate}
							onCheckedChange={() => setIsAutoUpdate(!isAutoUpdate)}
							className='ml-0'
						/>
					</div>
					<div className="flex flex-row items-center gap-2">
						<Label className="text-sm font-medium select-none mr-2">show chart:</Label>
						<ToggleGroup
							type="multiple"
							className="flex flex-row"
							value={selectedSeries}
							onValueChange={(values: string[]) => {
								setSelectedSeries(values)
							}}
						>
							{seriesContent.map((series) => (
								<ToggleGroupItem key={series} value={series} variant="outline">{series}</ToggleGroupItem>
							))}
						</ToggleGroup>
					</div>
					<ReactEcharts
						option={chartOptions}
						style={{ height: '100%', width: '100%' }}
						notMerge={true}
						lazyUpdate={true}
					/>
				</div>
			</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel defaultSize={50}>
				<div className='flex h-full p-4 flex-col gap-4 w-full'>
					<div className='flex flex-row items-center justify-center gap-4 w-full'>

					<ToggleGroup type='single' size='sm' defaultValue='all' onValueChange={(e: string) => setMarketType(e)}>
						<ToggleGroupItem value='5m' variant='outline' size='sm'>5m</ToggleGroupItem>
						<ToggleGroupItem value='15m' variant='outline' size='sm'>15m</ToggleGroupItem>
						<ToggleGroupItem value='1h' variant='outline' size='sm'>1h</ToggleGroupItem>
						<ToggleGroupItem value='4h' variant='outline' size='sm'>4h</ToggleGroupItem>
						<ToggleGroupItem value='1d' variant='outline' size='sm'>1d</ToggleGroupItem>
						<ToggleGroupItem value='all' variant='outline' size='sm'>all</ToggleGroupItem>
					</ToggleGroup>

					<Tabs
						value={asset?.value}
						onValueChange={(value) => {
							setSelectedMarket(null)
							setAsset(assetContent.find((node) => node.value === value) ?? assetContent[0])
						}}
						className='w-full h-full flex'>
						<TabsList className='text-foreground h-auto w-full rounded-none border-b bg-transparent px-0 py-1'>
							{assetContent.map((tab) => (
								<TabsTrigger
									key={tab.value}
									value={tab.value}
									className='flex-1 hover:bg-accent hover:text-foreground data-[state=active]:after:bg-primary data-[state=active]:hover:bg-accent relative after:absolute after:inset-x-0 after:bottom-0 after:-mb-1 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none'>
									{tab.label}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>

					<input
						type="date"
						className="ml-4 px-2 py-1 border rounded bg-background text-foreground"
						onChange={(e) => {
							setSelectedDate(new Date(e.target.value))
						}}
						value={selectedDate ? selectedDate.toISOString().slice(0, 10) : ''}
					/>
					</div>

					<MarketList symbol={asset?.value} marketType={marketType}
						selectedDate={selectedDate}
						selectedMarket={selectedMarket}
						onSelectMarket={setSelectedMarket}
					/>
				</div>
			</ResizablePanel>
		</ResizablePanelGroup>
	)
}


// ---------------------------------------------------------------------------- MarketList
const MarketList = ({ symbol, marketType, selectedDate, selectedMarket, onSelectMarket }:
	{ symbol: string, marketType: string, selectedDate: Date, selectedMarket: any, onSelectMarket: (market: any) => void }) => {
	const [markets, setMarkets] = useState<any[]>([])
	
	const getMarkets = async () => {
		// console.log('symbol:', symbol, 'marketType:', marketType, 'selectedDate:', selectedDate)

		let filter: any = null
		if (symbol === 'filtered'){
			filter = await PolymarketApi.store.getItem('marketFilter') as any
			if (filter){
				symbol = null as any
				selectedDate = null as any
			}
		}

		PolymarketChart.getAllMarkets_clob(symbol === 'all' ? null : symbol, selectedDate)
		.then((files) => {
			if (!files) return

			if (filter){
				files = files.filter((market) => filter[market.slug])
			}else if (marketType !== 'all'){
				files = files.filter((market) => market.slug.includes('-' + marketType))
			}
			files = files.sort((b, a) => a.timestamp - b.timestamp)

			setMarkets(files)
		})
	}

	useEffect(() => {
		setMarkets([])	//clear markets
		getMarkets()

	}, [symbol, selectedDate, marketType])

	
	return (
		<div className='flex flex-col h-full overflow-y-auto w-full'>
			{markets?.map((market) => (
				<div key={market.slug} className={`flex flex-row items-center justify-between border-b border-gray-700 cursor-pointer ${selectedMarket?.slug === market.slug ? 'bg-accent' : ''}`}
				 onClick={() => {
					console.log('selectedMarket:', market)
					onSelectMarket(market)
				}}>
					<MarketItem key={market.slug} market={market} />
				</div>
			))}
		</div>
	)
}


// ---------------------------------------------------------------------------- MarketItem
const MarketItem = ({ market }: { market: any }) => {
	const [data, setData] = useState<any>(null)

	useEffect(() => {
		PolymarketApi.fetchMarketBySlug(market.slug)
		// fetchMarketBySlugFromGamma(market.slug)
		.then((data) => {
			// console.log('marketData:', marketData)
			market.data = data
			setData(data)
		})
	}, [market.slug])

	const timeRange = (startTimestamp: number, endTimestamp: number) => {
		return startTimestamp && endTimestamp ?
			(moment.utc(startTimestamp).format('HH:mm') + ' - '
			+ moment.utc(endTimestamp).format('HH:mm'))
			+ ' (' + (moment(startTimestamp).format('HH:mm') + ' - '
			+ moment(endTimestamp).format('HH:mm')) + ')'
			: ''
	}	

	return (
		<div className={`flex flex-row items-center justify-between p-2 w-full`}>
			<div className='flex flex-row items-center justify-between gap-8 w-full'>
				<div className='text-sm font-medium'>{market.slug}</div>
				<div className='text-xs text-muted-foreground'>{data?.marketData?.question}</div>
				<div className='text-xs text-muted-foreground'>
					{timeRange(data?.startTimestamp, data?.endTimestamp)}
				</div>
				<div className='text-sm font-medium ml-auto'>{data?.outcome || ''}</div>
				<div className='text-sm font-medium'>{data?.state || ''}</div>
				<Button variant='outline' className='text-xs text-gray-500 h-auto px-2 py-1'
					onClick={e => {
						e.stopPropagation()

						// PolymarketChart.updateTestData(market.data as any)

						PolymarketChart.updateMarketData_clob(market.slug, market.filePath, false)
						.then(({market: _market, updated}) => {
							if (updated) {
								console.log('updated market:', _market)
								setData(_market)
								market.data = _market
							}
						})
					}}>Update</Button>
				<span
					className={`inline-block w-3 h-3 rounded-full mr-2 ${data?.closed
						? (data?.chartData?.ticker?.chainlink?._complete && data?.chartData?.clob?._complete === 1)
						? 'bg-green-500' : 'bg-yellow-500'
						: 'bg-red-500'}`}
				></span>
			</div>
		</div>
	)
}
