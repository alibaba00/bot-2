import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useState } from 'react'
import DemoTab1 from './DemoTab1'
import DemoTab2 from './DemoTab2'
import DemoTab3 from './DemoTab3'
import PageView from '@/components/PageView'

const content = [
	{
		label: 'Tab 1',
		value: 'tab-1',
		page: <DemoTab1 />
	},
	{
		label: 'Tab 2',
		value: 'tab-2',
		page: <DemoTab2 />,
		autoUnmount: false
	},
	{
		label: 'Tab 3',
		value: 'tab-3',
		page: <DemoTab3 />,
		autoMount: true
	}
]

export default function DemoPage() {
	const [activeNode, setActiveNode] = useState(content[0])

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
					// autoMount
					// autoUnmount={false}
				/>
			</Tabs>
		</div>
	)
}
