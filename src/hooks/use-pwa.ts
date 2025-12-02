import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function usePWA() {
	const [isOnline, setIsOnline] = useState(navigator.onLine)
	const [isInstalled, setIsInstalled] = useState(false)
	const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

	const {
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker
	} = useRegisterSW({
		onRegistered(r) {
			console.log('SW Registered: ' + r)
		},
		onRegisterError(error) {
			console.log('SW registration error', error)
		}
	})

	useEffect(() => {
		const handleOnline = () => setIsOnline(true)
		const handleOffline = () => setIsOnline(false)

		window.addEventListener('online', handleOnline)
		window.addEventListener('offline', handleOffline)

		// Check if app is already installed
		if (window.matchMedia('(display-mode: standalone)').matches) {
			setIsInstalled(true)
		}

		// Listen for the beforeinstallprompt event
		const handleBeforeInstallPrompt = (e: Event) => {
			e.preventDefault()
			setDeferredPrompt(e)
		}

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

		// Listen for the appinstalled event
		const handleAppInstalled = () => {
			setIsInstalled(true)
			setDeferredPrompt(null)
		}

		window.addEventListener('appinstalled', handleAppInstalled)

		return () => {
			window.removeEventListener('online', handleOnline)
			window.removeEventListener('offline', handleOffline)
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
			window.removeEventListener('appinstalled', handleAppInstalled)
		}
	}, [])

	const installApp = async () => {
		if (deferredPrompt) {
			deferredPrompt.prompt()
			const { outcome } = await deferredPrompt.userChoice
			console.log(`User response to the install prompt: ${outcome}`)
			setDeferredPrompt(null)
		}
	}

	const updateApp = () => {
		updateServiceWorker(true)
	}

	return {
		isOnline,
		isInstalled,
		needRefresh,
		canInstall: !!deferredPrompt,
		installApp,
		updateApp,
		dismissUpdate: () => setNeedRefresh(false)
	}
}
