import { Download, X, RefreshCw } from 'lucide-react'
import { usePWA } from '../hooks/use-pwa'
import { useState } from 'react'

export function PWAInstallPrompt() {
	const { isOnline, isInstalled, needRefresh, canInstall, installApp, updateApp, dismissUpdate } =
		usePWA()

	const [showInstallPrompt, setShowInstallPrompt] = useState(true)

	// Don't show anything if already installed and no update needed
	if (isInstalled && !needRefresh) {
		return null
	}

	return (
		<div className='fixed bottom-4 right-4 z-50 max-w-sm'>
			{/* Update Available Prompt */}
			{needRefresh && (
				<div className='bg-blue-600 text-white p-4 rounded-lg shadow-lg mb-2'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center space-x-2'>
							<RefreshCw className='w-5 h-5' />
							<span className='font-medium'>Update Available</span>
						</div>
						<button onClick={dismissUpdate} className='text-white/80 hover:text-white'>
							<X className='w-4 h-4' />
						</button>
					</div>
					<p className='text-sm mt-1 mb-3'>
						A new version of the app is available. Update now for the latest features.
					</p>
					<div className='flex space-x-2'>
						<button
							onClick={updateApp}
							className='bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-gray-100'>
							Update Now
						</button>
						<button
							onClick={dismissUpdate}
							className='text-white/80 hover:text-white text-sm'>
							Later
						</button>
					</div>
				</div>
			)}

			{/* Install Prompt */}
			{canInstall && !isInstalled && showInstallPrompt && (
				<div className='bg-green-600 text-white p-4 rounded-lg shadow-lg'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center space-x-2'>
							<Download className='w-5 h-5' />
							<span className='font-medium'>Install App</span>
						</div>
						<button
							onClick={() => setShowInstallPrompt(false)}
							className='text-white/80 hover:text-white'>
							<X className='w-4 h-4' />
						</button>
					</div>
					<p className='text-sm mt-1 mb-3'>
						Install this app on your device for a better experience and offline access.
					</p>
					<div className='flex space-x-2'>
						<button
							onClick={installApp}
							className='bg-white text-green-600 px-3 py-1 rounded text-sm font-medium hover:bg-gray-100'>
							Install
						</button>
						<button
							onClick={() => setShowInstallPrompt(false)}
							className='text-white/80 hover:text-white text-sm'>
							Not Now
						</button>
					</div>
				</div>
			)}

			{/* Offline Indicator */}
			{!isOnline && (
				<div className='bg-orange-600 text-white p-3 rounded-lg shadow-lg'>
					<div className='flex items-center space-x-2'>
						<div className='w-2 h-2 bg-white rounded-full animate-pulse'></div>
						<span className='text-sm font-medium'>You're offline</span>
					</div>
					<p className='text-xs mt-1 opacity-90'>
						Some features may be limited while offline.
					</p>
				</div>
			)}
		</div>
	)
}
