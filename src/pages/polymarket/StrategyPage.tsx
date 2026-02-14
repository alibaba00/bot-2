import { useState, useEffect } from "react";

const Strategy1 = {
	name: 'Strategy 1',
	description: 'Strategy 1 description',
	active: false,
	createdAt: new Date().getTime(),
	updatedAt: new Date().getTime(),
	stack: [
		{
			side: 'up',
			openLimit: 0.02,
		},
		{}
	]
}

export default function StrategyPage() {
	// const [strategies, setStrategies] = useState<Strategy[]>([]);


	useEffect(() => {
		// const strategies = await Strategy1.getStrategies();
		// setStrategies(strategies);
	}, []);

	return (
		<div className="flex flex-col gap-2 p-4">
			<h1>Strategy Page</h1>
			<ul>
				{/* {strategies.map((strategy) => (
					<li key={strategy.id}>{strategy.name}</li>
				))} */}
			</ul>
		</div>
	)
}
