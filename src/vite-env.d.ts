/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Monaco Editor environment for Electron
declare global {
	interface Window {
		MonacoEnvironment?: {
			getWorkerUrl: (moduleId: string, label: string) => string
		}
	}
}
