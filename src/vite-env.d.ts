/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Monaco Editor environment for Electron
// declare global {
// 	interface Window {
// 		MonacoEnvironment?: {
// 			getWorkerUrl: (moduleId: string, label: string) => string
// 		}
// 	}
// }

// Make PWA module optional for Electron builds
// declare module 'virtual:pwa-register/react' {
// 	import type { Dispatch, SetStateAction } from 'react'
// 	import type { RegisterSWOptions } from 'vite-plugin-pwa/types'

// 	export type { RegisterSWOptions }

// 	export function useRegisterSW(options?: RegisterSWOptions): {
// 		needRefresh: [boolean, Dispatch<SetStateAction<boolean>>]
// 		offlineReady: [boolean, Dispatch<SetStateAction<boolean>>]
// 		updateServiceWorker: (reloadPage?: boolean) => Promise<void>
// 	}
// }
