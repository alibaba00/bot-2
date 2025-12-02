import Store from '../Store'

export const VersionLabel = () => (
	<div className='absolute bottom-0 right-0 text-white/40 text-xs px-1.5 py-1 font-sans pointer-events-none'>
		{'Version: ' + (Store.config?.version || 'N/A')}
	</div>
)
