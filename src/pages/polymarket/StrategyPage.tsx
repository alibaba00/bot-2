import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Strategy3 } from "./Strategy";
import { Strategy4 } from "./Strategy_4";
import ReactEcharts from 'echarts-for-react';
import { Label } from "@/components/ui/label";

// const Strategy1 = {
// 	name: 'Strategy 1',
// 	description: 'Strategy 1 description',
// 	active: false,
// 	createdAt: new Date().getTime(),
// 	updatedAt: new Date().getTime(),
// 	stack: [
// 		{
// 			side: 'up',
// 			openLimit: 0.02,
// 		},
// 		{}
// 	]
// }

const lineChartOptions = {
	// Choose axis ticks based on UTC time.
	useUTC: true,
	// title: {
	// 	text: 'Intraday Chart with Breaks (Single Day)',
	// 	left: 'center'
	// },
	tooltip: {
		show: true,
		trigger: 'axis',
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
			scale: true,
			// interval: 0.1,
			splitLine: {
				show: true,
				lineStyle: {
					color: '#fff3',
					width: 0.5
				}
			}
		},
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
			tooltip: {
				show: true,
			},
			name: "up",
		},
	],
	grid: {
		top: 0,
		left: 0,
		right: 0,
	}
} as any

export default function StrategyPage() {
	// const [strategies, setStrategies] = useState<Strategy[]>([]);
	const [selectedFromDate, setSelectedFromDate] = useState(new Date('2026-04-29'))
	const [selectedToDate, setSelectedToDate] = useState(new Date('2026-04-30'))
	const [chartOptions, setChartOptions] = useState(lineChartOptions)


	useEffect(() => {
		// const strategies = await Strategy1.getStrategies();
		// setStrategies(strategies);
	}, []);


	const handleStrategy3 = async () => {
		console.log('handleStrategy3 ...')
		await Strategy3.run()
		console.log('handleStrategy3 complete!', Strategy3.setup)

		const upData = Strategy3.setup.up
		const upTrades = upData.trades

		let pnl = 1
		const win = (upData.sellLimit - upData.buyLimit) / upData.buyLimit
		const loss = (upData.closeLimit - upData.buyLimit) / upData.buyLimit

		if (upTrades.length > 0){
			const upData = upTrades.map((trade: any) => {
				pnl += trade.won ? win : loss
				return [trade.close, pnl]
			})
			setChartOptions({
				...lineChartOptions,
				series: [{
					...lineChartOptions.series[0],
					data: upData						//up data (green)
				}],
			})
		}
	}
	
	
	const handleStrategy3Multi = async () => {
		console.log('handleStrategy3Multi ...')
		await Strategy3.run_multi()
		console.log('handleStrategy3Multi complete!', Strategy3.setup)
		
		if (Strategy3.setup.up.trades){
			// const upTrades = Strategy3.setup.up.trades
			// const upData = upTrades.map((trade: any) => [trade.close, trade.won])
			// setChartOptions({
			// 	...lineChartOptions,
			// 	series: [{...lineChartOptions.series[0], data: upData}],
			// })
		}
	}

	const handleStrategy4 = async () => {
		console.log('handleStrategy4 ...')
		await Strategy4.run()
		console.log('handleStrategy4 complete!', Strategy4.setup)
	}

	return (
		<div className="flex flex-col gap-4 p-4 h-full w-full justify-start items-start">
			<h2>Strategies:</h2>
			<div className="flex gap-2 flex-wrap">
				<Button variant='default' onClick={handleStrategy3}>Strategy 3</Button>
				<Button variant='default' onClick={handleStrategy3Multi}>Strategy 3 Multi</Button>
				<Button variant='default' onClick={handleStrategy4}>Strategy 4</Button>
			</div>

			<div className="flex gap-2 flex-wrap">
				<Label>From Date</Label>
				<input
					type="date"
					className="px-2 py-1 border rounded bg-background text-foreground"
					onChange={(e) => {
						setSelectedFromDate(new Date(e.target.value))
					}}
					value={selectedFromDate ? selectedFromDate.toISOString().slice(0, 10) : ''}
				/>
				<Label className="ml-4">To Date</Label>
				<input
					type="date"
					className="px-2 py-1 border rounded bg-background text-foreground"
					onChange={(e) => {
						setSelectedToDate(new Date(e.target.value))
					}}
					value={selectedToDate ? selectedToDate.toISOString().slice(0, 10) : ''}
				/>
			</div>

			<ReactEcharts
				option={chartOptions}
				style={{ height: '50%', width: '100%' }}
				notMerge={true}
				lazyUpdate={true}
			/>

		</div>
	)
}
