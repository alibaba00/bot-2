import { AppSidebar } from '@/components/app-sidebar'
import PageView from '@/components/PageView'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Bot, SquareTerminal } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import DemoPage from './playground/DemoPage'
import EditorPage from './playground/EditorPage'
import HistoryPage from './playground/HistoryPage'
import SettingsPage from './playground/SettingsPage'
import StarredPage from './playground/StarredPage'
import DashboardPage from './polymarket/DashboardPage'


const pages = [
	{id:'demo', path:'/playground/demo', page:<DemoPage />},
	{id:'editor', path:'/playground/editor', page:EditorPage},
	{id:'history', path:'/playground/history', page:<HistoryPage />},
	{id:'starred', path:'/playground/starred', page:<StarredPage />},
	{id:'settings', path:'/playground/settings', page:SettingsPage},
	{id:'polymarket', path:'/polymarket', page:<DashboardPage />}
]

const data = {
	navMain: [
		{
			title: 'Polymarket',
			url: '/polymarket',
			icon: Bot,
			items: [
				{
					title: 'Dashboard',
					url: '/polymarket/dashboard'
				},
			]
		},
		{
			title: 'Playground',
			url: '/playground',
			icon: SquareTerminal,
			isActive: true,
			items: [
				{
					title: 'Demo',
					url: '/playground/demo'
				},
				{
					title: 'Editor',
					url: '/playground/editor'
				},
				{
					title: 'History',
					url: '/playground/history'
				},
				{
					title: 'Starred',
					url: '/playground/starred'
				},
				{
					title: 'Settings',
					url: '/playground/settings'
				}
			]
		},
	],
}

export default function Page() {
	const location = useLocation();

	const getCurrentBreadcrumb = () => {
		const path = location.pathname;
		if (path.includes('/playground/')) return 'Playground';
		return 'Building Your Application';
	};

	return (
		<SidebarProvider>
			<AppSidebar data={data} />
			<SidebarInset>
				<header className='flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12'>
					<div className='flex items-center gap-2 px-4 w-full'>
						<SidebarTrigger className='-ml-1' />
						<Separator
							orientation='vertical'
							className='mr-2 data-[orientation=vertical]:h-4'
						/>
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem className='hidden md:block'>
									<BreadcrumbLink href='#'>
										{getCurrentBreadcrumb()}
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className='hidden md:block' />
								<BreadcrumbItem>
									<BreadcrumbPage>{location.pathname}</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
				</header>

				<PageView
					content={pages}
					selectedNode={pages.find(node => location.pathname.includes(node.path))}
					autoUnmount={false}
					cache='playground-page'		
				/>

			</SidebarInset>
		</SidebarProvider>
	)
}
