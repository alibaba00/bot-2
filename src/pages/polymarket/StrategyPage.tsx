import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Strategy3 } from "./Strategy";
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
	series: [
		{
			type: 'line',
			lineStyle: {
				width: 1,
				color: '#0f0c',
			},
			symbolSize: 0,
			data: [1,2,3,4,5,6,7,8,9,10] as any[],
			step: 'end',
			tooltip: {
				show: true,
			},
			name: "up",
		}
	] as any[],
	xAxis: [
		{
			type: 'category',
			data: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as any[],
			splitLine: {
				show: true,
				lineStyle: {
					color: '#fff3',
					width: 1,
					type: 'dashed'
				}
			}
		}
	] as any[],
	yAxis: [
		{
			type: 'value',
			min: 0,
			max: 10,
			splitLine: {
				show: true,
				lineStyle: {
					color: '#fff3',
					width: 0.5
				}
			}
		}
	] as any[],
}


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
		Strategy3.run()
	}
	
	
	const handleStrategy3Multi = async () => {
		console.log('handleStrategy3Multi ...')
		await Strategy3.run_multi()
		console.log('handleStrategy3Multi complete!', Strategy3.setup)
		
		if (Strategy3.setup.up.trades){
			const upTrades = Strategy3.setup.up.trades
			// const upData = upTrades.map((trade: any) => [trade.close, trade.won])
			// setChartOptions({
			// 	...lineChartOptions,
			// 	series: [{...lineChartOptions.series[0], data: upData}],
			// })
		}
	}

	
	return (
		<div className="flex flex-col gap-4 p-4 h-full w-full justify-start items-start">
			<h2>Strategies:</h2>
			<div className="flex gap-2 flex-wrap">
				<Button variant='default' onClick={handleStrategy3}>Strategy 3</Button>
				<Button variant='default' onClick={handleStrategy3Multi}>Strategy 3 Multi</Button>
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
