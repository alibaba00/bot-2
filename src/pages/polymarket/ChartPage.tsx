import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import ReactEcharts from 'echarts-for-react';
import { useEffect, useState } from "react";
import * as PolymarketChart from "./PolymarketChart";
import PolymarketApi from "./PolymarketApi";


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
		label: 'ALL',
		value: 'all',
	},
] as any

const heatmapChartOptions = {
	tooltip: {
		show: false,
		trigger: 'axis'
	},
	xAxis: {
		type: 'category',
		// data: ['0-3', '3-6', '6-9', '9-12', '12-15'],
		data: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
	},
	yAxis: {
		type: 'category',
		// data: ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9'],
		data: ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9'],
	},
	visualMap: {
		min: -1,
		max: 1,
		calculable: true,
		orient: 'horizontal',
		left: 'center',
		// bottom: '15%',
		inRange: {
			color: [
			'#f00c',
			'#3303',
			'#3f0c',
			]
		  }
	  
	  },	
	series: [
		{
			type: 'heatmap',
			data: []	as any
		}
	],
	grid: {
		top: 0,
		bottom: 0,
		left: 0,
		right: 0,
		containLabel: true
	}
} as any

const scatterChartOptions = {
	xAxis: {
		type: 'value',
		min: 0,
		max: 15,
		name: 'Minuten',
	},

	yAxis: {
		type: 'value',
	},
	series: [
		{
			type: 'scatter',
			name: 'Up',
			data: [] as any[],
			itemStyle: {
				color: 'green'
			},
			symbolSize: 5,
		},
		{
			type: 'scatter',
			name: 'Down',
			data: [] as any[],
			itemStyle: {
				color: 'red'
			},
			symbolSize: 5,
		}
	],
} as any

const barChartOptions = {
	xAxis: {
		type: 'category',
	},
	yAxis: {
		type: 'value',
		splitLine: {
			show: true,
			lineStyle: {
				color: '#fff3',
				width: 0.5
			}
		}
	},
	series: [
		{
			data: [] as any[],
			type: 'bar',
			barGap: 0,
			barCategoryGap: 0
		}
	],
	grid: {
		top: 0,
		bottom: 0,
		left: 0,
		right: 0,
		containLabel: true
	}
} as any


const lineChartOptions = {
	// Choose axis ticks based on UTC time.
	useUTC: true,
	title: {
		text: 'Intraday Chart with Breaks (Single Day)',
		left: 'center'
	},
	tooltip: {
		show: true,
		trigger: 'axis'
	},
	xAxis: [
		{
			type: 'time',
			boundaryGap: false,
			axisLabel: {
				showMinLabel: true,
				showMaxLabel: true,
			},
			data: [] as any[],
			// show a vertical line every X minutes
			splitLine: {
				show: true,
				lineStyle: {
					color: '#fff3',
					width: 1,
					type: 'dashed'
				}
			}
		}
	],
	yAxis: [
		{
			type: 'value',
			scale: false,
			min: 0,
			max: 1,
			interval: 0.1,
			splitLine: {
				show: true,
				lineStyle: {
					color: '#fff3',
					width: 0.5
				}
			}
		},
		{
			type: 'value',
			scale: false,
			min: -2,
			max: +2,
			data: [] as any[],
			splitLine: {
				show: true,
				lineStyle: {
					color: (value: number) => value === 0 ? '#FF6600' : '#fff3',
					width: (value: number) => value === 0 ? 2 : 0.5,
				}
			},
		}
	],
	dataZoom: [
		{
			type: 'inside',
			xAxisIndex: 0
		},
		{
			type: 'slider',
			xAxisIndex: 0
		}
	],
	series: [
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: '#0f0c',
			},
			symbolSize: 0,
			data: [] as any[],
			step: 'end',
		},
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: '#f00c',
			},
			symbolSize: 0,
			data: [] as any[],
			step: 'end',
		},
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: '#06fc', // set to visible color (e.g. yellow)
			},
			symbolSize: 0,
			data: [] as any[],
			yAxisIndex: 1,
			step: 'end',
		}
	]
} as any


// const chartData = {} as any

export default function ChartPage() {
	const [asset, setAsset] = useState(assetContent[0])
	const [selectedDate, setSelectedDate] = useState(new Date())
	// const [chartOptions, setChartOptions] = useState({line: lineChartOptions, bar: barChartOptions, heatmap: heatmapChartOptions})
	const [chartOptions, setChartOptions] = useState({})
	const [chartType, setChartType] = useState('line')
	const [side, setSide] = useState('up')
	const [selectedMarket, setSelectedMarket] = useState<any>(null)


	const updateChart = async () => {
		const symbol = asset?.value.toLowerCase()
		if (!symbol) return

		switch (chartType) {
			case 'line':
				let chartData = selectedMarket?.data?.chartData
				if (!chartData) return setChartOptions({})
				
				const openPrice = selectedMarket.data.openPrice
				const startTimestamp = selectedMarket.data.startTimestamp
				const endTimestamp = selectedMarket.data.endTimestamp

				if (chartData.up[chartData.up.length - 1][0] < endTimestamp) {
					chartData.up.push([endTimestamp, chartData.up[chartData.up.length - 1][1]])
				}
				if (chartData.down[chartData.down.length - 1][0] < endTimestamp) {
					chartData.down.push([endTimestamp, chartData.down[chartData.down.length - 1][1]])
				}

				const values = chartData.ticker.map((item: any) => {
					return [item[0], ((item[1] / openPrice) - 1 ) * 1000] as any
				})
				const minValue = values.reduce((min: number, item: any) => Math.min(min, item[1]), Infinity)
				const maxValue = values.reduce((max: number, item: any) => Math.max(max, item[1]), -Infinity)
				let scale = maxValue > -minValue ? maxValue : -minValue
				scale = parseFloat(Math.ceil(scale * 1.01).toFixed(2))

				setChartOptions({
					...lineChartOptions,
					xAxis: [{
						...lineChartOptions.xAxis[0],
						min: startTimestamp,
						max: endTimestamp,
					}],
					yAxis: [
						lineChartOptions.yAxis[0] as any,
						{
							...lineChartOptions.yAxis[1] as any,
							min: -scale,
							max: +scale,
						} as any
					],
					series: [
						{
							...lineChartOptions.series[0],
							data: chartData.up
						},
						{
							...lineChartOptions.series[1],
							data: chartData.down.map(([timestamp, value]) => [timestamp, 1 - value]),
						},
						{
							...lineChartOptions.series[2],
							data: values
						}
					],
				})
				break

			case 'bar':
				const data = await PolymarketChart.getChartDistributionData(symbol, null, 15)	//15
				setChartOptions({
					...barChartOptions,
					series: [{
						...barChartOptions.series[0],
						data: data.map((item) => [item.value, item.count])
					}],
				})
				break

			case 'heatmap':
				if (!chartData.heatmap){
					const data2 = await PolymarketChart.heatmapData()
					console.log('data:', data2)
					chartData.heatmap = data2
				}
				setChartOptions({
					...heatmapChartOptions,
					series: [{
						...heatmapChartOptions.series[0],
						data: chartData.heatmap[asset.value][side].map((item) => [item.col, item.row, item.value]),
					}],
				})
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

/*
	const onClick = async (type: string) => {
		switch (type) {
			case 'load-full-ticker-data':
				// PolymarketChart.testData(activeNode?.value)
				break

			case 'load-ticker-data':
				// if (!activeNode?.value || !selectedDate) return
				// const markets = PolymarketChart.getMarketDataFromDate(activeNode?.value, selectedDate)
				// console.log('markets:', markets)

				if (!asset?.value || !selectedDate) return
				const dateString = PolymarketApi.getUTCDateFormat(selectedDate)		//yyyy-mm-dd
				const data1 = await PolymarketChart.getChartTickerData(asset?.value, dateString)
				const chartData = await PolymarketChart.getChartMinuteData(data1)
				// const normalizedData = PolymarketChart.normalizeData(chartData, 60)
				// For time axis, data must be in format [timestamp, value] pairs
				setChartOptions({
					...lineChartOptions,
					series: [{
						...lineChartOptions.series[0],
						data: chartData.map((item) => [item.timestamp, item.price])
					}],
					xAxis: [{
						...lineChartOptions.xAxis[0],
						// Remove data property for time axis - it's not needed
					}]
				})
				break

			case 'line':
				// const dateString1 = PolymarketApi.getUTCDateFormat(selectedDate)		//yyyy-mm-dd
				const data = await PolymarketChart.getChartDistributionData(asset?.value.toLowerCase())
				// console.log('data:', data)
				setChartOptions({
					...barChartOptions,
					series: [{
						...barChartOptions.series[0],
						data: data.map((item) => [item.value, item.count])
					}],
				})
				break
			case 'market':
				// setChartOptions(null)

				// const markets = await PolymarketChart.getMarketDataFromDate(activeNode?.value, selectedDate)
				// console.log('markets:', markets)
				const dateString2 = PolymarketApi.getUTCDateFormat(selectedDate)		//yyyy-mm-dd
				let marketData = await PolymarketChart.getMarketChartData(null, asset?.value.toLowerCase(), dateString2)
				marketData = marketData.filter((item) => item.direction === 'Up')
				// setTimeout(() => {
					setChartOptions({
						...lineChartOptions,
						series: [{
							...lineChartOptions.series[0],
							data: marketData.map((item) => [item.timestamp, item.price])
						}],
					})
				// }, 1000)
				break

			case 'update data':
				PolymarketChart.updateAllMarketData()
				break

		}
	}
*/

	return (
		<ResizablePanelGroup direction='vertical'>
			<ResizablePanel defaultSize={50}>
				<div className='h-full w-full flex flex-col gap-4 p-4'>
					<div className='flex flex-row items-center justify-center flex-col gap-4'>
						<Button onClick={() => PolymarketChart.updateAllMarketData()}>
							Update Data
						</Button>
						
						<ToggleGroup type='single' defaultValue='line' onValueChange={(e: string) => setChartType(e)}>
							<ToggleGroupItem value='line' variant='outline'>Line</ToggleGroupItem>
							<ToggleGroupItem value='bar' variant='outline'>Bar</ToggleGroupItem>
							<ToggleGroupItem value='heatmap' variant='outline'>Heatmap</ToggleGroupItem>
							<ToggleGroupItem value='scatter' variant='outline'>Scatter</ToggleGroupItem>
						</ToggleGroup>

						<ToggleGroup type='single' defaultValue='up' onValueChange={(e: string) => setSide(e)}>
							<ToggleGroupItem value='up' variant='outline'>Up</ToggleGroupItem>
							<ToggleGroupItem value='down' variant='outline'>Down</ToggleGroupItem>
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
				<div className='flex h-full items-center justify-center p-4 flex-col gap-4'>
					<Tabs
						value={asset?.value}
						onValueChange={(value) =>
							setAsset(assetContent.find((node) => node.value === value) ?? assetContent[0])
						}
						className='w-full h-full'>
						<TabsList className='text-foreground h-auto w-full rounded-none border-b bg-transparent px-0 py-1'>
							{assetContent.map((tab) => (
								<TabsTrigger
									key={tab.value}
									value={tab.value}
									className='flex-1 hover:bg-accent hover:text-foreground data-[state=active]:after:bg-primary data-[state=active]:hover:bg-accent relative after:absolute after:inset-x-0 after:bottom-0 after:-mb-1 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none'>
									{tab.label}
								</TabsTrigger>
							))}
							<input
								type="date"
								className="ml-4 px-2 py-1 border rounded bg-background text-foreground"
								onChange={(e) => {
									setSelectedDate(new Date(e.target.value))
								}}
								value={selectedDate ? selectedDate.toISOString().slice(0, 10) : ''}
							/>
						</TabsList>
						<MarketList symbol={asset?.value} selectedDate={selectedDate}
							onSelectMarket={setSelectedMarket}
						/>
					</Tabs>
				</div>
			</ResizablePanel>
		</ResizablePanelGroup>
	)
}


// ---------------------------------------------------------------------------- MarketList
const MarketList = ({ symbol, selectedDate, onSelectMarket }:
	{ symbol: string, selectedDate: Date, onSelectMarket: (market: any) => void }) => {
	// const [markets, setMarkets] = useState<MarketData[]>([])
	const [markets, setMarkets] = useState<any[]>([])
	const [selectedMarket, setSelectedMarket] = useState<any>(null)
	
	useEffect(() => {
		PolymarketChart.getMarketsFiles(symbol, selectedDate)
		.then((markets) => {
			// console.log('markets:', markets)
			if (!markets) return
			markets = markets.sort((b, a) => a.timestamp - b.timestamp)
			setMarkets(markets)
		})

	}, [symbol, selectedDate])

	
	return (
		<div className='flex flex-col h-full overflow-y-auto'>
			{markets?.map((market) => (
				<div key={market.slug} className={`flex flex-row items-center justify-between border-b border-gray-700 cursor-pointer ${selectedMarket?.slug === market.slug ? 'bg-accent' : ''}`}
				 onClick={() => {
					console.log('selectedMarket:', market)
					setSelectedMarket(market)
					onSelectMarket(market)
				}}>
					<MarketItem market={market} />
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
		.then((data) => {
			// console.log('marketData:', marketData)
			market.data = data
			setData(data)
		})
	}, [market.slug])

	return (
		<div className={`flex flex-row items-center justify-between p-2 w-full`}>
			<div className='flex flex-row items-center justify-between gap-8 w-full'>
				<div className='text-sm font-medium mr-auto'>{market.slug}</div>
				<div className='text-sm font-medium'>{data?.outcome || ''}</div>
				<div className='text-sm font-medium'>{data?.state || ''}</div>
				<Button variant='outline' className='text-xs text-gray-500 h-auto px-2 py-1'
					onClick={() => PolymarketChart.updateMarketData(market.filePath, market.slug)}
					>Update</Button>
				<span
					className={`inline-block w-3 h-3 rounded-full mr-2 ${data?.closed
						? 'bg-green-500'
						: 'bg-red-500'}`}
				></span>
			</div>
		</div>
	)
}
