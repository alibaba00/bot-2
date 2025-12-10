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

import { create } from 'zustand' // https://github.com/pmndrs/zustand
import { useShallow } from 'zustand/react/shallow'
import localForage from 'localforage'

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
	status: 'initializing'
}))

// ============================================================================ PolymarketStore
const PolymarketStore = {
	cache: null as any,

	set: (state: any, value?: any) => {
		if (typeof state === 'string') state = { [state]: value }
		useStore.setState(state)
	},

	// get: useStore.getState,
	get: (value?: string) => {
		return value ? useStore.getState()[value as any] : useStore.getState()
	},

	use: (...keys: string[]) => {
		return useStore(
			useShallow((state: any) =>
				keys.length === 1 ? state[keys[0]] : keys.map((key) => state[key])
			)
		)
	},


	async init() {
		// create cache instance
		this.cache = localForage.createInstance({
			name: 'polymarket',
			storeName: 'polymarket-cache'
		})

		console.log('---polymarket store init:', this)
		useStore.setState({ isInit: true, status: 'initialized' })
	},

}

export default PolymarketStore
