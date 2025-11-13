/*
---state samples:
use state:
	const state = Store.useState()

use state value:
	const value = Store.use('value')
	//or
	const value = Store.useState(state => state.value)
	//or
	const value = Store.useState().value

use multiple state values:
	const [value, data] = Store.use(['value', 'data'])
	//or
	const [value, data] = Store.useState(state => [state.value, state.data])

get state value:
	const value = Store.get().value		//= Store.useState.getState().value
	//or
	const value = Store.get('value')

set state value(s):
	Store.set({value: 1})				//= Store.useState.setState({value: 1})

switch state value(s):
	Store.set({active: !Store.get().active})

set cache value:
	Store.cache.setItem('data', jsonData)

get cache value:
	Store.cache.getItem('data')

action when value changed:
	const value = Store.use('value')
	useEffect(() => {	//fired after rerender
		console.log('---value changed!', value)
		/// your action here
	}, [value])
*/

import {create} from 'zustand'		// https://github.com/pmndrs/zustand
import {useShallow} from 'zustand/react/shallow'
// import { persist, createJSONStorage } from 'zustand/middleware'
import localForage from "localforage";

const env = import.meta.env
const isElectron = window?.navigator.userAgent.includes('Electron')
const isFileProtocol = window?.location.protocol === 'file:'
const isDevelopment = env.DEV || env.MODE === 'development'
const isProduction = env.PROD || env.MODE === 'production'
const isPWA	= !isElectron && !isDevelopment && env.VITE_PWA === 'true'
const fs = isElectron ? (window as any)?.require?.('fs') : null
const fsPromises = isElectron ? (window as any)?.require?.('fs/promises') : null


// ---------------------------------------------------------------------------- getBasename
// Get the basename for the current environment
const getBasename = () => {
	// In Electron or file protocol, use empty basename
	if (isElectron || isFileProtocol || isDevelopment) return ''
	
	// For production web deployment, determine basename from current path
	const currentPath = window?.location.pathname
	const pathSegments = currentPath.split('/').filter(segment => segment !== '')
	return (pathSegments.length > 0) ? '/' + pathSegments[0] : ''
}


// ---------------------------------------------------------------------------- useStorePersisted
// export const useStorePersisted = create(persist(() => ({
// 	isInit: false,	
// 	status: 'initializing',
// }), {
// 	name: 'store',
// 	storage: createJSONStorage(() => localForage),
// 	// partialize: (state) => ({
// 	// 	isInit: state.isInit,
// 	// }),
// }));


// ---------------------------------------------------------------------------- useStore
export const useStore = create(() => ({
	isInit: false,
	status: 'initializing',
}));



// ============================================================================ Store
const Store = {
	config		: null as any,
	cache		: null as any,
	basename	: getBasename(),
	env			: env,
	isElectron,
	isDevelopment,
	isProduction,
	isPWA,
	
	set: (state: any, value?: any) => {
		if (typeof state === 'string') state = {[state]: value}
		useStore.setState(state)
	},

	// get: useStore.getState,
	get: (value?: string) => {
		return value? useStore.getState()[value as any] : useStore.getState()	
	},

	use: (...keys: string[]) => {
		return useStore(useShallow((state: any) => 
			keys.length === 1 ? state[keys[0]] : keys.map(key => state[key])
		))
	},

	async init() {
		this.config = await loadConfig();

		// create cache instance
		this.cache = localForage.createInstance({
			name: this.config.name,
			storeName: this.config.name + "-store"
		});

		console.log('---store init:', this.config.name, this.config.version, this);
		useStore.setState({'isInit': true, 'status': this.config.info || 'initialized'});
	}
};

export default Store;


// ---------------------------------------------------------------------------- loadConfig
// load config from config.json and userConfig.json
const loadConfig = async () => {
	const configPath = './config.json'
	console.log('Loading config from:', configPath)
	
	const config = await fetch(configPath).then(res => res.json());
	if (!config) return;

	// try to load user config
	if (isElectron) {
		try {
			const userConfigPath = config.userConfig;
			if (fs?.existsSync(userConfigPath)) {
				const userConfig = await fsPromises?.readFile(userConfigPath, 'utf8');
				// merge user config with app config
				Object.assign(config, JSON.parse(userConfig));
			}
		} catch (error) {
			console.log('---fs access error:', error);
		}
	}

	console.log('---config:', config);
	return config;
}
