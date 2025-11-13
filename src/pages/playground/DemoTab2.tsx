import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export default function DemoTab2() {
	const [value, setValue] = useState([10, 50])

	return <div className='p-4 w-full space-y-4'>
		<ButtonGroup>
			<Button variant='outline'>Button 1</Button>
			<Button>Button 2</Button>
			<Button variant='outline'>Button 3</Button>
			<Button variant='outline'>Button 4</Button>
			<Button variant='outline'>Button 5</Button>
			<Button>Button 6</Button>
			<Button>Button 7</Button>
		</ButtonGroup>

		<ToggleGroup type='single' defaultValue='1'>
			<ToggleGroupItem value='1' variant='outline'>Toggle 1</ToggleGroupItem>
			<ToggleGroupItem value='2' variant='outline'>Toggle 2</ToggleGroupItem>
			<ToggleGroupItem value='3' variant='outline'>Toggle 3</ToggleGroupItem>
			<ToggleGroupItem value='4' variant='outline'>Toggle 4</ToggleGroupItem>
			<ToggleGroupItem value='5' variant='outline'>Toggle 5</ToggleGroupItem>
		</ToggleGroup>

		<Spinner />
		<Slider min={0} max={100} value={value} step={1} onValueChange={setValue} />
		<p>Value: {value.join(', ')}</p>

	</div>
}
