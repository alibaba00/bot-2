import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, Search, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'

export default function HistoryPage() {
	// Mock history data
	const historyItems = [
		{
			id: 1,
			title: 'Machine Learning Model Training',
			description: 'Trained a neural network for image classification',
			timestamp: '2 hours ago',
			type: 'Model Training'
		},
		{
			id: 2,
			title: 'Data Analysis Pipeline',
			description: 'Created automated data processing workflow',
			timestamp: '1 day ago',
			type: 'Pipeline'
		},
		{
			id: 3,
			title: 'API Integration Test',
			description: 'Tested REST API endpoints for user authentication',
			timestamp: '3 days ago',
			type: 'Testing'
		},
		{
			id: 4,
			title: 'Database Migration',
			description: 'Migrated user data to new schema version',
			timestamp: '1 week ago',
			type: 'Database'
		}
	]

	return (
		<div className='flex flex-1 flex-col gap-4 p-4 pt-0 pb-16'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-2xl font-bold'>History</h1>
					<p className='text-sm text-muted-foreground'>
						View your recent playground activities and experiments
					</p>
				</div>
				<div className='flex items-center gap-2'>
					<div className='relative'>
						<Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
						<Input placeholder='Search history...' className='pl-8 w-[250px]' />
					</div>
					<Button variant='outline' size='sm'>
						<Trash2 className='h-4 w-4 mr-2' />
						Clear All
					</Button>
				</div>
			</div>

			<div className='grid gap-4'>
				{historyItems.map((item) => (
					<Card
						key={item.id}
						className='hover:shadow-md transition-shadow cursor-pointer'>
						<CardHeader className='pb-3'>
							<div className='flex items-start justify-between'>
								<div className='flex-1'>
									<CardTitle className='text-lg'>{item.title}</CardTitle>
									<CardDescription className='mt-1'>
										{item.description}
									</CardDescription>
								</div>
								<div className='flex items-center gap-2 text-sm text-muted-foreground'>
									<Clock className='h-4 w-4' />
									{item.timestamp}
								</div>
							</div>
						</CardHeader>
						<CardContent className='pt-0'>
							<div className='flex items-center justify-between'>
								<div className='flex items-center gap-2'>
									<span className='inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10'>
										{item.type}
									</span>
								</div>
								<div className='flex items-center gap-2'>
									<Button variant='ghost' size='sm'>
										View Details
									</Button>
									<Button variant='ghost' size='sm'>
										Rerun
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{historyItems.length === 0 && (
				<div className='flex flex-col items-center justify-center py-12 text-center'>
					<Clock className='h-12 w-12 text-muted-foreground mb-4' />
					<h3 className='text-lg font-semibold'>No history yet</h3>
					<p className='text-sm text-muted-foreground max-w-sm'>
						Start experimenting in the playground to see your activity history here.
					</p>
				</div>
			)}
		</div>
	)
}
