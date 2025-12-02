import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'

export default function DemoTab3() {
	return (
		<div className='p-4 w-full space-y-4'>
			<ResizablePanelGroup direction='horizontal' className='w-full rounded-lg border h-full'>
				<ResizablePanel defaultSize={50}>
					<div className='flex h-[400px] items-center justify-center p-6'>
						<span className='font-semibold'>One</span>
					</div>
				</ResizablePanel>
				<ResizableHandle />
				<ResizablePanel defaultSize={50}>
					<ResizablePanelGroup direction='vertical'>
						<ResizablePanel defaultSize={25}>
							<div className='flex h-full items-center justify-center p-6'>
								<span className='font-semibold'>Two</span>
							</div>
						</ResizablePanel>
						<ResizableHandle />
						<ResizablePanel defaultSize={75}>
							<div className='flex h-full items-center justify-center p-6'>
								<span className='font-semibold'>Three</span>
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	)
}
