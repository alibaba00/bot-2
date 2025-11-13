import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
// import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa'
import path from 'path'

// PWA Configuration
// const pwaOptions: Partial<VitePWAOptions> = {
// 	registerType: 'autoUpdate',
// 	includeAssets: ['favicon.ico', 'icons/logo192.png', 'icons/logo512.png'],
// 	manifest: {
// 		name: 'Demo App Template',
// 		short_name: 'Demo App',
// 		description: 'Demo App Template with PWA support',
// 		theme_color: '#000000',
// 		background_color: '#ffffff',
// 		display: 'standalone',
// 		orientation: 'portrait',
// 		scope: './',
// 		start_url: './',
// 		icons: [
// 			{
// 				src: 'icons/logo192.png',
// 				sizes: '192x192',
// 				type: 'image/png',
// 				purpose: 'maskable any'
// 			},
// 			{
// 				src: 'icons/logo512.png',
// 				sizes: '512x512',
// 				type: 'image/png',
// 				purpose: 'maskable any'
// 			}
// 		]
// 	},
// 	workbox: {
// 		// Exclude heavy worker bundles (e.g., Monaco editor workers) from precache
// 		globIgnores: ['**/*worker*.js'],
// 		// Raise limit so main bundle can be precached
// 		maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
// 		globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
// 		runtimeCaching: [
// 			{
// 				urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
// 				handler: 'CacheFirst',
// 				options: {
// 					cacheName: 'google-fonts-cache',
// 					expiration: {
// 						maxEntries: 10,
// 						maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
// 					}
// 				}
// 			},
// 			{
// 				urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
// 				handler: 'CacheFirst',
// 				options: {
// 					cacheName: 'gstatic-fonts-cache',
// 					expiration: {
// 						maxEntries: 10,
// 						maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
// 					}
// 				}
// 			}
// 		]
// 	}
// }

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '')
	const port = Number(env.VITE_PORT) || 4000
	console.log('vite.config mode:', mode, 'port:', port)
	
	return {
		plugins: [
			react(),
			tailwindcss(),
			// PWA plugin is always enabled, but UI is hidden in Electron via Store.isElectron
			// VitePWA(pwaOptions)
		],
		base: './', // Use relative paths instead of absolute paths
		build: {
			outDir: 'build'
		},
		server: {
			port,
			strictPort: true,
			open: false,
			host: true,
		},
		resolve: {
			alias: {
				'@': path.resolve(__dirname, './src')
			}
		},
		// define: {
		// 	// Configure Monaco Editor to use CDN for workers
		// 	'process.env': JSON.stringify(env)
		// },
		// optimizeDeps: {
		// 	include: ['@monaco-editor/react']
		// }
	}
})
