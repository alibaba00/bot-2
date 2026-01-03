'use client'

import * as React from 'react'
import { Terminal } from 'lucide-react'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import Store from '@/Store'

export function ConsoleToggleButton() {
	const { isMobile, state } = useSidebar()
	const [isOpen, setIsOpen] = React.useState(false)

	const toggleConsole = async () => {
		if (!Store.isElectron) {
			// In browser, we can't programmatically toggle DevTools
			// Just show a message or do nothing
			console.warn('DevTools can only be toggled in Electron app')
			return
		}

		try {
			const electron = (window as any).require('electron')
			if (electron?.ipcRenderer) {
				await electron.ipcRenderer.invoke('toggle-devtools')
				setIsOpen((prev) => !prev)
			}
		} catch (error) {
			console.error('Failed to toggle DevTools:', error)
		}
	}

	const button = (
		<SidebarMenuButton
			onClick={toggleConsole}
			className='w-full'
			data-active={isOpen}
			title={isOpen ? 'Konsole ausblenden' : 'Konsole einblenden'}>
			<Terminal className='size-4' />
			{state !== 'collapsed' && (
				<span className='truncate'>{isOpen ? 'Konsole ausblenden' : 'Konsole einblenden'}</span>
			)}
		</SidebarMenuButton>
	)

	if (state === 'collapsed' && !isMobile) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<Tooltip>
						<TooltipTrigger asChild>{button}</TooltipTrigger>
						<TooltipContent side='right' align='center'>
							{isOpen ? 'Konsole ausblenden' : 'Konsole einblenden'}
						</TooltipContent>
					</Tooltip>
				</SidebarMenuItem>
			</SidebarMenu>
		)
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>{button}</SidebarMenuItem>
		</SidebarMenu>
	)
}
