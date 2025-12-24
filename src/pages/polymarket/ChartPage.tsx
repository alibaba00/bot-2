import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactEcharts from 'echarts-for-react';
import { useEffect, useState } from "react";
import * as PolymarketChart from "./PolymarketChart";
import PolymarketApi from "./PolymarketApi";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";


const content = [
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
]

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
		min: -100,
		max: 100,
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
			interval: 1000 * 60 * 30,
			axisLabel: {
				showMinLabel: true,
				showMaxLabel: true,
			},
			data: [] as any[],
		}
	],
	yAxis: {
		type: 'value',
		min: 'dataMin'
	},
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
			symbolSize: 0,
			data: [] as any[],
		}
	]
} as any


export default function ChartPage() {
	const [activeNode, setActiveNode] = useState(content[0])
	const [selectedDate, setSelectedDate] = useState(new Date())
	// const [chartOptions, setChartOptions] = useState({line: lineChartOptions, bar: barChartOptions, heatmap: heatmapChartOptions})
	const [chartOptions, setChartOptions] = useState({})
	const [chartType, setChartType] = useState('line')

	useEffect(() => {
	}, [])


	useEffect(() => {
		// .then((markets) => {
		// 	console.log('markets:', markets)
		// })
	}, [selectedDate])


	const onClick = async (type: string) => {
		switch (type) {
			case 'load-full-ticker-data':
				// PolymarketChart.testData(activeNode?.value)
				break

			case 'load-ticker-data':
				// if (!activeNode?.value || !selectedDate) return
				// const markets = PolymarketChart.getMarketDataFromDate(activeNode?.value, selectedDate)
				// console.log('markets:', markets)

				if (!activeNode?.value || !selectedDate) return
				const dateString = PolymarketApi.getUTCDateFormat(selectedDate)		//yyyy-mm-dd
				const data1 = await PolymarketChart.getChartTickerData(activeNode?.value, dateString)
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
				const data = await PolymarketChart.getChartDistributionData(activeNode?.value.toLowerCase())
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
				let marketData = await PolymarketChart.getMarketChartData(null, activeNode?.value.toLowerCase(), dateString2)
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

			case 'test data':
				const data2 = await PolymarketChart.testData(activeNode?.value)
				console.log('data:', data2)

				// let data3 = data2[activeNode?.value]?.up.map((item) => [item.col, item.row, item.value]) || []
				let data3 = data2.all.up.map((item) => [item.col, item.row, item.value]) || []
				console.log('data3:', data3[0], data3[1], data3[2])
data3 = data3.slice(1, 1000)
				setChartOptions({
					...heatmapChartOptions,
					series: [{
						...heatmapChartOptions.series[0],
						data: data3,
					}],
				})
				// setChartOptions({
				// 	...scatterChartOptions,
				// 	xAxis: {
				// 		...scatterChartOptions.xAxis,
				// 	},
				// 	series: [
				// 		{
				// 			...scatterChartOptions.series[0],
				// 			data: data2[activeNode?.value]?.up.map((item) => [item[0], item[1]]) || [],
				// 		},
				// 		{
				// 			...scatterChartOptions.series[1],
				// 			data: data2[activeNode?.value]?.down.map((item) => [item[0], item[1]]) || [],
				// 		}
				// 	],
				// })
				break
			case 'heatmap':
				// setChartOptions(null)
				// setTimeout(() => {
					setChartOptions({
						...heatmapChartOptions,
					})
				// }, 1000)
				break
		}
	}


	return (
		<ResizablePanelGroup direction='vertical'>
			<ResizablePanel defaultSize={50}>
				<div className='flex h-full items-center justify-center p-6 flex-col gap-4'>
					<ButtonGroup>
						<Button variant='outline' onClick={() => onClick('load-full-ticker-data')}>load full Ticker data</Button>
						<Button variant='outline' onClick={() => onClick('load-ticker-data')}>load Ticker data</Button>
						<Button variant='outline' onClick={() => onClick('line')}>Line</Button>
						<Button variant='outline' onClick={() => onClick('market')}>Market</Button>
						<Button variant='outline' onClick={() => onClick('update data')}>update data</Button>
						<Button variant='outline' onClick={() => onClick('test data')}>test data</Button>
						<Button variant='outline' onClick={() => onClick('heatmap')}>heatmap</Button>
					</ButtonGroup>

					<ToggleGroup type='single' defaultValue='line' onValueChange={(e: string) => setChartType(e)}>
						<ToggleGroupItem value='line' variant='outline'>Line</ToggleGroupItem>
						<ToggleGroupItem value='bar' variant='outline'>Bar</ToggleGroupItem>
						<ToggleGroupItem value='heatmap' variant='outline'>Heatmap</ToggleGroupItem>
					</ToggleGroup>

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
						value={activeNode?.value}
						onValueChange={(value) =>
							setActiveNode(content.find((node) => node.value === value) ?? content[0])
						}
						className='w-full h-full'>
						<TabsList className='text-foreground h-auto w-full rounded-none border-b bg-transparent px-0 py-1'>
							{content.map((tab) => (
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
						<MarketList symbol={activeNode?.value} selectedDate={selectedDate} />
					</Tabs>
				</div>
			</ResizablePanel>
		</ResizablePanelGroup>
	)
}


const MarketList = ({ symbol, selectedDate }: { symbol: string, selectedDate: Date }) => {
	// const [markets, setMarkets] = useState<MarketData[]>([])
	
	useEffect(() => {
	}, [symbol, selectedDate])

	return (
		<div className='flex flex-col gap-4 h-full'>
			{symbol} Chart {selectedDate.toISOString().slice(0, 10)}

		</div>
	)
}
