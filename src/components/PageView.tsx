// ============================================================================ PageView
// autoMount default: false
// autoUnmount default: false
//
export default function PageView(props: any) {
	const content = props.content //page content list
	const selectedNode = props.selectedNode //selected node

	if (!content) return null

	console.log('PageView selectedNode', selectedNode)

	return (
		<div className='flex flex-col gap-4'>
			{content.map((node: any, index: number) => {
				if (!node?.page) return null

				node._selected = selectedNode === node
				node._init = node._init || node._selected

				return node._selected ||
					(node._init && (node.autoUnmount !== true || props.autoUnmount !== true)) ||
					(!node._init && (node.autoMount === true || props.autoMount === true)) ? (
					<div key={node.id || index} className={node._selected ? 'block' : 'hidden'}>
						{typeof node.page === 'function' ? (
							<node.page selected={node._selected} />
						) : (
							node.page
						)}
					</div>
				) : null
			})}
		</div>
	)
}
