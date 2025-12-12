import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable";

import { ResizablePanelGroup } from "@/components/ui/resizable";

export default function ChartPage() {
	return (
		<div className='w-full h-full'>
			<ResizablePanelGroup direction='horizontal' className='w-full border h-full'>
				<ResizablePanel defaultSize={50}>
					<ResizablePanelGroup direction='vertical'>
						<ResizablePanel defaultSize={25}>
							<div className='flex h-full items-center justify-center p-6'>

							</div>
						</ResizablePanel>
						<ResizableHandle />
						<ResizablePanel defaultSize={75}>
							<div className='flex h-full items-center justify-center p-6'>
								
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	)
}
