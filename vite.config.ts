import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'


// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '')
	const port = Number(env.VITE_PORT) || 4000
	console.log('vite.config mode:', mode, 'port:', port)
	
	return {
		plugins: [
			react(),
			tailwindcss(),
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
		}
	}
})
