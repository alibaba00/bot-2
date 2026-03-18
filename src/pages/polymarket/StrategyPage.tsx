import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Strategy1, Strategy2, Strategy3 } from "./Strategy";


// const Strategy1 = {
// 	name: 'Strategy 1',
// 	description: 'Strategy 1 description',
// 	active: false,
// 	createdAt: new Date().getTime(),
// 	updatedAt: new Date().getTime(),
// 	stack: [
// 		{
// 			side: 'up',
// 			openLimit: 0.02,
// 		},
// 		{}
// 	]
// }


const handleStrategy1 = async () => {
	console.log('handleStrategy1 ...')
	Strategy1.run()
}

const handleStrategy2 = async () => {
	console.log('handleStrategy2 ...')
	Strategy2.run()
}

const handleStrategy3 = async () => {
	console.log('handleStrategy3 ...')
	Strategy3.run()
}


export default function StrategyPage() {
	// const [strategies, setStrategies] = useState<Strategy[]>([]);


	useEffect(() => {
		// const strategies = await Strategy1.getStrategies();
		// setStrategies(strategies);
	}, []);

	return (
		<div className="flex flex-col gap-2 p-4">
			<h2>Strategies:</h2>
			<div className="flex gap-2 flex-wrap">
				<Button variant='default' onClick={handleStrategy1}>Strategy 1</Button>
				<Button variant='default' onClick={() => Strategy1.run_multi('btc')}>Strategy 1 Multi</Button>
				<Button variant='default' onClick={handleStrategy2}>Strategy 2</Button>
				<Button variant='default' onClick={handleStrategy3}>Strategy 3</Button>
			</div>
		</div>
	)
}
