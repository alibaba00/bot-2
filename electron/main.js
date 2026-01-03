import 'dotenv/config'
import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ignore certificate errors
app.commandLine.appendSwitch('ignore-certificate-errors')

//force working on background if app is minimized
app.commandLine.appendSwitch('disable-renderer-backgrounding')

// force single instance application
// if (!app.requestSingleInstanceLock()) {
// 	console.log('application already running!', process.argv)
// 	app.exit(0)
// }

async function createWindow() {
	const win = new BrowserWindow({
		width: 1200,
		height: 900,
		autoHideMenuBar: true,
		webPreferences: {
			nodeIntegration			: true,		//important for node support
			nodeIntegrationInWorker : true,
			nodeIntegrationInSubFrames: true,	//node support in iframes
			webSecurity				: false,	//disable cors
			nativeWindowOpen 		: true,		//to use Chrome's built-in window.open() method and not BrowserWindowProxy
			backgroundThrottling 	: false,	//disable throttling if minimized
			enableRemoteModule		: true,
			contextIsolation		: false,	//disable context isolation to use window.require()
			sandbox					: false,	//disable sandboxing for node support in main process
			// 	preload: join(__dirname, 'preload.cjs'),
		}
	})

	// Debug logging for packaged app structure
	console.log('__dirname:', __dirname)
	console.log('process.resourcesPath:', process.resourcesPath)
	console.log('app.getAppPath():', app.getAppPath())
	console.log('process.argv:', process.argv)
	console.log('NODE_ENV:', process.env.NODE_ENV)
	console.log('VITE_PORT:', process.env.VITE_PORT)

	// In development, load from Vite dev server
	if (process.env.NODE_ENV === 'development') {
		const port = process.env.VITE_PORT || 4000
		win.loadURL('http://localhost:' + port)
		// win.webContents.openDevTools()
	} else {
		// In production, load the built files
		// When packaged with electron-builder, the dist files are included directly in the app
		let indexPath

		if (app.isPackaged) {
			// When packaged, the build files are in the app.asar at the root level
			indexPath = join(app.getAppPath(), 'build', 'index.html')
		} else {
			// When running from source (npm run app:preview), use local build
			indexPath = join(__dirname, '..', 'build', 'index.html')
		}

		console.log('Loading production file from:', indexPath)
		console.log('App is packaged:', app.isPackaged)
		console.log('App path:', app.getAppPath())
		console.log('Resources path:', process.resourcesPath)

		// Check if file exists
		const fs = await import('fs')
		const pathExists = fs.existsSync(indexPath)
		console.log('File exists at indexPath:', pathExists)

		if (pathExists) {
			// Load the file
			win.loadFile(indexPath)
				.then(() => {
					console.log('Successfully loaded index.html')
				})
				.catch((error) => {
					console.error('Failed to load index.html:', error)
				})
		} else {
			console.error('Index.html not found at expected path:', indexPath)
			// Try to find the file in common locations
			const possiblePaths = [
				join(__dirname, '..', 'build', 'index.html'),
				join(__dirname, 'build', 'index.html'),
				join(app.getAppPath(), 'index.html'),
				join(process.resourcesPath, 'app', 'build', 'index.html')
			]

			for (const path of possiblePaths) {
				if (fs.existsSync(path)) {
					console.log('Found index.html at:', path)
					win.loadFile(path)
						.then(() => {
							console.log('Successfully loaded from fallback path')
						})
						.catch((err) => {
							console.error('Failed to load from fallback path:', err)
						})
					break
				}
			}
		}

		// Enable dev tools in production for debugging if needed
		if (process.argv.includes('--debug')) {
			win.webContents.openDevTools()
		}
	}

	app.on('second-instance', (event, argv, cwd) => {
		console.log('second-instance argv:', argv, 'cwd:', cwd)

		if (argv.includes('-exit')) {
			console.log('quit')
			setTimeout(() => {
				app.exit(0)
				// app.quit()
			}, 500)
		}

		win.webContents.send('second-instance', argv, cwd) //send event to render process
	})
}

app.whenReady().then(() => {
	createWindow()

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow()
		}
	})
})

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit()
		}
	})

	// IPC handler to toggle DevTools
	ipcMain.handle('toggle-devtools', () => {
		const windows = BrowserWindow.getAllWindows()
		windows.forEach((win) => {
			if (win.webContents.isDevToolsOpened()) {
				win.webContents.closeDevTools()
			} else {
				win.webContents.openDevTools()
			}
		})
	})
