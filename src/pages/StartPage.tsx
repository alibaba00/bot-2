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
import HistoryPage from './playground/HistoryPage'
import SettingsPage from './playground/SettingsPage'
import StarredPage from './playground/StarredPage'
import DashboardPage from './polymarket/DashboardPage'
import MarketsPage from './polymarket/MarketsPage'
import OrdersPage from './polymarket/OrdersPage'
import ChartPage from './polymarket/ChartPage'
import PolymarketHistoryPage from './polymarket/HistoryPage'
import TickerPage from './polymarket/TickerPage'
import TickerPage2 from './polymarket/TickerPage2'
import CryptoTickers from './polymarket/CryptoTickers'
import TickerPage3 from './polymarket/TickerPage3'
import MuskPage from './polymarket/MuskPage'

const pages = [
	{ id: 'demo', path: '/playground/demo', page: <DemoPage /> },
	{ id: 'history', path: '/playground/history', page: <HistoryPage /> },
	{ id: 'starred', path: '/playground/starred', page: <StarredPage /> },
	{ id: 'settings', path: '/playground/settings', page: SettingsPage },
	{ id: 'polymarket', path: '/polymarket', page: <DashboardPage /> },
	{ id: 'polymarket-dashboard', path: '/polymarket/dashboard', page: <DashboardPage /> },
	{ id: 'polymarket-markets', path: '/polymarket/markets', page: <MarketsPage /> },
	{ id: 'polymarket-orders', path: '/polymarket/orders', page: <OrdersPage /> },
	{ id: 'polymarket-history', path: '/polymarket/history', page: <PolymarketHistoryPage /> },
	{ id: 'polymarket-ticker', path: '/polymarket/ticker', page: <TickerPage /> },
	{ id: 'polymarket-ticker2', path: '/polymarket/ticker2', page: <TickerPage2 /> },
	{ id: 'polymarket-ticker3', path: '/polymarket/ticker3', page: <TickerPage3 /> },
	{ id: 'polymarket-crypto-tickers', path: '/polymarket/crypto-tickers', page: <CryptoTickers /> },
	{ id: 'polymarket-chart', path: '/polymarket/chart', page: <ChartPage /> },
	{ id: 'polymarket-musk', path: '/polymarket/musk', page: <MuskPage /> }

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
				{
					title: 'Markets',
					url: '/polymarket/markets'
				},
				{
					title: 'Orders',
					url: '/polymarket/orders'
				},
				{
					title: 'History',
					url: '/polymarket/history'
				},
				{
					title: 'Ticker',
					url: '/polymarket/ticker'
				},
				{
					title: 'Ticker 2',
					url: '/polymarket/ticker2'
				},
				{
					title: 'Ticker 3',
					url: '/polymarket/ticker3'
				},
				{
					title: 'Crypto Tickers',
					url: '/polymarket/crypto-tickers'
				},
				{
					title: 'Charts',
					url: '/polymarket/chart'
				},
				{
					title: 'Musk',
					url: '/polymarket/musk'
				}
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
		}
	]
}

export default function Page() {
	const location = useLocation()

	const getCurrentBreadcrumb = () => {
		const path = location.pathname
		if (path.includes('/playground/')) return 'Playground'
		if (path.includes('/polymarket/')) return 'Polymarket'
		return 'Building Your Application'
	}

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
					selectedNode={pages.find((node) => location.pathname === node.path)}
					autoUnmount={false}
					cache='playground-page'
				/>
			</SidebarInset>
		</SidebarProvider>
	)
}
