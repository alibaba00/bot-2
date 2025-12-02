import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Settings, User, Bell, Shield, Database, Save, RotateCcw } from 'lucide-react'

export default function SettingsPage() {
	return (
		<div className='flex flex-1 flex-col gap-6 p-4 pt-0 pb-16'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-2xl font-bold'>Settings</h1>
					<p className='text-sm text-muted-foreground'>
						Configure your playground preferences and account settings
					</p>
				</div>
				<div className='flex items-center gap-2'>
					<Button variant='outline' size='sm'>
						<RotateCcw className='h-4 w-4 mr-2' />
						Reset to Defaults
					</Button>
					<Button size='sm'>
						<Save className='h-4 w-4 mr-2' />
						Save Changes
					</Button>
				</div>
			</div>

			<div className='grid gap-6'>
				{/* Profile Settings */}
				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<User className='h-5 w-5' />
							<CardTitle>Profile Settings</CardTitle>
						</div>
						<CardDescription>
							Manage your personal information and preferences
						</CardDescription>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div className='grid grid-cols-2 gap-4'>
							<div className='space-y-2'>
								<Label htmlFor='firstName'>First Name</Label>
								<Input id='firstName' placeholder='John' />
							</div>
							<div className='space-y-2'>
								<Label htmlFor='lastName'>Last Name</Label>
								<Input id='lastName' placeholder='Doe' />
							</div>
						</div>
						<div className='space-y-2'>
							<Label htmlFor='email'>Email</Label>
							<Input id='email' type='email' placeholder='john.doe@example.com' />
						</div>
						<div className='space-y-2'>
							<Label htmlFor='bio'>Bio</Label>
							<Input id='bio' placeholder='Tell us about yourself...' />
						</div>
					</CardContent>
				</Card>

				{/* Playground Preferences */}
				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<Settings className='h-5 w-5' />
							<CardTitle>Playground Preferences</CardTitle>
						</div>
						<CardDescription>
							Customize your playground experience and workflow
						</CardDescription>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div className='flex items-center justify-between'>
							<div className='space-y-0.5'>
								<Label>Auto-save experiments</Label>
								<p className='text-sm text-muted-foreground'>
									Automatically save your work every 30 seconds
								</p>
							</div>
							<Switch defaultChecked />
						</div>
						<Separator />
						<div className='flex items-center justify-between'>
							<div className='space-y-0.5'>
								<Label>Show code completion</Label>
								<p className='text-sm text-muted-foreground'>
									Enable intelligent code suggestions while typing
								</p>
							</div>
							<Switch defaultChecked />
						</div>
						<Separator />
						<div className='flex items-center justify-between'>
							<div className='space-y-0.5'>
								<Label>Enable keyboard shortcuts</Label>
								<p className='text-sm text-muted-foreground'>
									Use keyboard shortcuts for faster navigation
								</p>
							</div>
							<Switch defaultChecked />
						</div>
					</CardContent>
				</Card>

				{/* Notifications */}
				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<Bell className='h-5 w-5' />
							<CardTitle>Notifications</CardTitle>
						</div>
						<CardDescription>
							Configure how you receive notifications and updates
						</CardDescription>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div className='flex items-center justify-between'>
							<div className='space-y-0.5'>
								<Label>Email notifications</Label>
								<p className='text-sm text-muted-foreground'>
									Receive updates about your experiments via email
								</p>
							</div>
							<Switch />
						</div>
						<Separator />
						<div className='flex items-center justify-between'>
							<div className='space-y-0.5'>
								<Label>Push notifications</Label>
								<p className='text-sm text-muted-foreground'>
									Get real-time notifications in your browser
								</p>
							</div>
							<Switch defaultChecked />
						</div>
						<Separator />
						<div className='flex items-center justify-between'>
							<div className='space-y-0.5'>
								<Label>Weekly digest</Label>
								<p className='text-sm text-muted-foreground'>
									Receive a summary of your weekly activity
								</p>
							</div>
							<Switch defaultChecked />
						</div>
					</CardContent>
				</Card>

				{/* Performance & Storage */}
				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<Database className='h-5 w-5' />
							<CardTitle>Performance & Storage</CardTitle>
						</div>
						<CardDescription>
							Manage your storage usage and performance settings
						</CardDescription>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div className='space-y-2'>
							<Label htmlFor='maxHistory'>Maximum history items</Label>
							<Input id='maxHistory' type='number' placeholder='100' />
							<p className='text-sm text-muted-foreground'>
								Number of recent items to keep in history
							</p>
						</div>
						<Separator />
						<div className='flex items-center justify-between'>
							<div className='space-y-0.5'>
								<Label>Enable caching</Label>
								<p className='text-sm text-muted-foreground'>
									Cache frequently used data for better performance
								</p>
							</div>
							<Switch defaultChecked />
						</div>
						<Separator />
						<div className='space-y-2'>
							<div className='flex items-center justify-between'>
								<Label>Storage usage</Label>
								<span className='text-sm text-muted-foreground'>
									2.4 GB / 10 GB
								</span>
							</div>
							<div className='w-full bg-gray-200 rounded-full h-2'>
								<div
									className='bg-blue-600 h-2 rounded-full'
									style={{ width: '24%' }}></div>
							</div>
							<Button variant='outline' size='sm' className='mt-2'>
								<Database className='h-4 w-4 mr-2' />
								Clear Cache
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* Security */}
				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<Shield className='h-5 w-5' />
							<CardTitle>Security</CardTitle>
						</div>
						<CardDescription>
							Manage your account security and privacy settings
						</CardDescription>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div className='flex items-center justify-between'>
							<div className='space-y-0.5'>
								<Label>Two-factor authentication</Label>
								<p className='text-sm text-muted-foreground'>
									Add an extra layer of security to your account
								</p>
							</div>
							<Button variant='outline' size='sm'>
								Enable
							</Button>
						</div>
						<Separator />
						<div className='space-y-2'>
							<Label>Change Password</Label>
							<div className='space-y-2'>
								<Input type='password' placeholder='Current password' />
								<Input type='password' placeholder='New password' />
								<Input type='password' placeholder='Confirm new password' />
							</div>
							<Button variant='outline' size='sm'>
								Update Password
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
