/// <reference types="vite/client" />

// Monaco Editor environment for Electron
declare global {
	interface Window {
		MonacoEnvironment?: {
			getWorkerUrl: (moduleId: string, label: string) => string
		}
	}
}
