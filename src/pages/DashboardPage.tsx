import { AppSidebar } from '@/components/app-sidebar'
import { ModeToggle } from '@/components/mode-toggle'
import PageView from '@/components/PageView'
import
	{
		Breadcrumb,
		BreadcrumbItem,
		BreadcrumbLink,
		BreadcrumbList,
		BreadcrumbPage,
		BreadcrumbSeparator
	} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { LogOut } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import DemoPage from './playground/DemoPage'
import EditorPage from './playground/EditorPage'
import HistoryPage from './playground/HistoryPage'
import SettingsPage from './playground/SettingsPage'
import StarredPage from './playground/StarredPage'


const pages = [
	{id:'demo', path:'/playground/demo', page:<DemoPage />},
	{id:'editor', path:'/playground/editor', page:EditorPage},
	{id:'history', path:'/playground/history', page:<HistoryPage />},
	{id:'starred', path:'/playground/starred', page:<StarredPage />},
	{id:'settings', path:'/playground/settings', page:SettingsPage}
]

export default function Page() {
	const navigate = useNavigate()
	const location = useLocation();

	const handleLogout = () => {
		console.log('Logout')
		navigate('/login')
	}

	const getCurrentBreadcrumb = () => {
		const path = location.pathname;
		if (path.includes('/playground/')) return 'Playground';
		return 'Building Your Application';
	};

	return (
		<SidebarProvider>
			<AppSidebar />
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
						<div className='ml-auto flex items-center gap-2'>
							<Button 
								variant="ghost" 
								size="sm" 
								onClick={handleLogout}
								className="flex items-center gap-2"
							>
								<LogOut className="h-4 w-4" />
								<span className="hidden sm:inline">Log Out</span>
							</Button>
							<ModeToggle />
						</div>
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
