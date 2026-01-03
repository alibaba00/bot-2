'use client'

import * as React from 'react'

import { NavMain } from '@/components/nav-main'
import { NavProjects } from '@/components/nav-projects'
import { NavUser } from '@/components/nav-user'
import { TeamSwitcher } from '@/components/team-switcher'
import { ConsoleToggleButton } from '@/components/console-toggle-button'
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
	SidebarSeparator
} from '@/components/ui/sidebar'

export function AppSidebar({
	data,
	...props
}: { data: any } & React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible='icon' {...props}>
			{data.teams && (
				<SidebarHeader>
					<TeamSwitcher teams={data.teams} />
				</SidebarHeader>
			)}

			<SidebarContent>
				{data.navMain && <NavMain items={data.navMain} />}
				{data.projects && <NavProjects projects={data.projects} />}
			</SidebarContent>

			<SidebarFooter>
				{data.user && <NavUser user={data.user} />}
				{data.user && <SidebarSeparator />}
				<ConsoleToggleButton />
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	)
}
