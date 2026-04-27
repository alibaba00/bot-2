import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Strategy1, Strategy2, Strategy3 } from "./Strategy";
import ReactEcharts from 'echarts-for-react';

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

const chartOptions = {
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


const handleStrategy1 = async () => {
	console.log('handleStrategy1 ...')
	Strategy1.run()
}

const handleStrategy2 = async () => {
	console.log('handleStrategy2 ...')
	Strategy2.run()
}

const handleStrategy3 = async () => {
	console.log('handleStrategy3 ...')
	Strategy3.run()
}


export default function StrategyPage() {
	// const [strategies, setStrategies] = useState<Strategy[]>([]);


	useEffect(() => {
		// const strategies = await Strategy1.getStrategies();
		// setStrategies(strategies);
	}, []);

	return (
		<div className="flex flex-col gap-2 p-4 h-full w-full">
			<h2>Strategies:</h2>
			<div className="flex gap-2 flex-wrap">
				<Button variant='default' onClick={handleStrategy1}>Strategy 1</Button>
				<Button variant='default' onClick={() => Strategy1.run_multi('btc')}>Strategy 1 Multi</Button>
				<Button variant='default' onClick={handleStrategy2}>Strategy 2</Button>
				<Button variant='default' onClick={handleStrategy3}>Strategy 3</Button>
				<Button variant='default' onClick={() => Strategy3.run_multi()}>Strategy 3 Multi</Button>
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
