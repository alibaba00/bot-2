import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable";

import { ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactEcharts from 'echarts-for-react';
import { useEffect, useState } from "react";
import PolymarketApi from "./PolymarketApi";

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

export default function ChartPage() {
	const [activeNode, setActiveNode] = useState(content[0])
	const [selectedDate, setSelectedDate] = useState(new Date())

	useEffect(() => {

	}, [])


	useEffect(() => {
		PolymarketApi.getMarketDataFromDate(activeNode?.value, selectedDate)
		.then((markets) => {
			console.log('markets:', markets)
		})
	}, [selectedDate])

	return (
		<ResizablePanelGroup direction='vertical'>
			<ResizablePanel defaultSize={25}>
				<div className='flex h-full items-center justify-center p-6'>
					<ReactEcharts
						option={{
							xAxis: {
								type: 'category',
								data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
							},
							yAxis: {
								type: 'value'
							},
							series: [{
								data: [120, 200, 150, 80, 70, 110, 130],
								type: 'line'
							}]
						}}
						style={{ height: '100%', width: '100%' }}
					/>

				</div>
			</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel defaultSize={75}>
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
						<div className='flex flex-col gap-4 h-full'>
							{activeNode?.label} Chart

						</div>
					</Tabs>
				</div>
			</ResizablePanel>
		</ResizablePanelGroup>
	)
}
