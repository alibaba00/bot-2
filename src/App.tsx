import { BrowserRouter, HashRouter } from 'react-router-dom'
import { VersionLabel } from './components/components'
import StartPage from './pages/StartPage'
import Store from './Store'

function App() {
	// Use HashRouter for Electron, BrowserRouter for web
	const Router = Store.isElectron ? HashRouter : BrowserRouter

	return (
		<Router basename={Store.basename}>
			<StartPage />
			<VersionLabel />
		</Router>
	)
}

export default App
