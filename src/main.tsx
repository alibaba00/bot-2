import { createRoot } from 'react-dom/client'
import './index.css'
import App from './AppDemo.tsx'
// import App from './App.tsx'
import Store from './Store.ts'
import { logSystem } from './lib/utils.ts'

logSystem()		//show system info in console

const container = document.getElementById('root');
const root = createRoot(container!); 	// createRoot(container!) if you use TypeScript

root.render(<div className='loading'>loading...</div>)

Store.init()
	.then(() => {
		root.render(<App/>)
	})	
	.catch(err => {
		root.render(<div className='loading error'>error on loading store: {err}</div>)
	});

