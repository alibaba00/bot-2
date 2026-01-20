import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useEffect, useState } from "react";
import { beep } from '@/lib/utils'


// const chartData = {} as any
const endpoint = 'https://xtracker.polymarket.com/api/users/elonmusk/posts?startDate=2026-01-17T17:00:00.000Z&endDate=2026-01-19T17:00:00.000Z'

let interval: NodeJS.Timeout | null = null

export default function MuskPage() {
	const [isWatching, setIsWatching] = useState(false)
	const [length, setLength] = useState(0)

	const fetchData = () => {
		fetch(endpoint)
			.then(response => response.json())
			.then(data => {
				if (data.success) {
					setLength(last => {
						if (data.data.length !== last) {
							beep()
						}
						return data.data.length
					})
				} else {
					console.error('Error:', data.error)
				}
			})
			.catch(error => console.error('Error:', error))
		console.log('fetching data')
	}

	useEffect(() => {
		if (interval) {
			clearInterval(interval as any)
			interval = null
		}
		if (isWatching) {
			interval = setInterval(fetchData, 10000)
			fetchData()
		}
		return () => {
			if (interval) {
				clearInterval(interval as any)
				interval = null
			}
		}
	}, [isWatching])

	return (
		<ResizablePanelGroup direction='vertical'>
			<ResizablePanel defaultSize={50}>
				<div className='h-full w-full flex flex-col gap-4 p-4'>
					<div className='flex flex-row items-center justify-center gap-4'>
						<Button
							onClick={() => setIsWatching(!isWatching)}
							variant={isWatching ? 'destructive' : 'outline'}
							size='sm'
							>
							{isWatching ? 'Stop Watching' : 'Start Watching'}
						</Button>

						<div className='text-xl text-muted-foreground'>{length} posts</div>
					</div>
				</div>
			</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel defaultSize={50}>
				<div className='flex h-full p-4 flex-col gap-4 w-full'>

				</div>
			</ResizablePanel>
		</ResizablePanelGroup>
	)
}
