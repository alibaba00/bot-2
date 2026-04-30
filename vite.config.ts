import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Plugin to handle Electron-specific modules
const electronPlugin = () => ({
	name: 'electron-external',
	configureServer(server) {
		server.middlewares.use((_req, _res, next) => {
			// Allow Node.js modules to be loaded in Electron
			next()
		})
	},
	resolveId(id) {
		// Don't try to resolve Node.js built-ins
		if (['events', 'stream', 'util', 'buffer', 'crypto', 'fs', 'path', 'os', 'http', 'https', 'url', 'zlib', 'net', 'tls', 'child_process'].includes(id)) {
			return { id, external: true }
		}
		return null
	}
})


// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '')
	const port = Number(env.VITE_PORT) || 4000
	console.log('vite.config mode:', mode, 'port:', port)
	
	return {
		plugins: [
			react(),
			tailwindcss(),
			VitePWA({
				registerType: 'autoUpdate',
				workbox: {
					globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
					maximumFileSizeToCacheInBytes: 10 * 1024 * 1024 // 10 MB
				}
			}),
			electronPlugin(),
		],
		base: './', // Use relative paths instead of absolute paths
		build: {
			outDir: 'build',
			commonjsOptions: {
				transformMixedEsModules: true,
			},
		},
		ssr: {
			noExternal: ['@polymarket/clob-client-v2'],
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
		optimizeDeps: {
			exclude: [
				// Exclude problematic packages from pre-bundling
				'@polymarket/clob-client-v2',
				'@ethereumjs/util',
				'@metamask/eth-sig-util',
				'@polymarket/order-utils',
			],
		},
		// Expose environment variables to the client
		// Note: Vite automatically exposes VITE_* variables, but we can also define them explicitly
		define: {
			// Provide Node.js globals for Electron
			'global': 'globalThis',
			'process.env': '{}',
		}
	}
})
