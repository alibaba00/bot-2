import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import StartPage from './pages/StartPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import { ThemeProvider } from '@/components/theme-provider'
import Store from './Store'
import DemoPage from './pages/playground/DemoPage'
import { VersionLabel } from './components/components'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'

function App() {
	// Use HashRouter for Electron, BrowserRouter for web
	const Router = Store.isElectron ? HashRouter : BrowserRouter

	return (
		<ThemeProvider defaultTheme='dark'>
			<Router basename={Store.basename}>
				<Routes>
					<Route path='/demo' element={<DemoPage />} />
					<Route path='/' element={<StartPage />} />
					<Route path='/login' element={<LoginPage />} />
					<Route path='/dashboard/*' element={<DashboardPage />} />
					<Route path='*' element={<Navigate to='/' replace />} />
				</Routes>
			</Router>
			<VersionLabel />
			{Store.isPWA && <PWAInstallPrompt />}
		</ThemeProvider>
	)
}

export default App
