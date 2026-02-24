import { useEffect, useState } from "react"


// ---------------------------------------------------------------------------- MarketTimer
export const MarketTimer = ({minutes, offset = 0, onExpired, onTime}:
	{minutes: number, offset?: number, onExpired?: () => void, onTime?: (restSeconds: number) => void}) => {

	const timer = useMarketTimer(minutes, offset, onExpired, onTime)
	
	return (
		<div className='flex flex-col items-center justify-center p-2 w-24 h-10 ml-2 border border-gray-300 rounded-md'>
			<div className='text-2xl font-bold'>{timer.timeString}</div>
		</div>
	)
}


// ---------------------------------------------------------------------------- useMarketTimer
// minutes: 15
// onExpired: () => void
// return: {minutes: number, seconds: number, timeString: string}
const useMarketTimer = (minutes: number = 15, offset: number = 0, onExpired?: () => void, onTime?: (restSeconds: number) => void) => {
	const [timer, setTimer] = useState<{hours: number, minutes: number, seconds: number, timeString: string}>({
		hours: 0,
		minutes: 0,
		seconds: 0,
		timeString: minutes < 60 ? '00:00' : '00:00:00'
	})

	useEffect(() => {
		console.log('--- useMarketTimer --- minutes:', minutes, 'offset:', offset)
		const maxTime = Math.ceil(minutes * 60)		//max time in seconds
		let now = Date.now() + offset * 1000
		let past = now % (minutes * 60 * 1000)	
		let time = maxTime - Math.ceil(past / 1000)
		if (time <= 10) time += maxTime

		const updateTimer = () => {
			time --	//decrement time by 1 second

			if (time <= 0) {
				onTime?.(0)
				onExpired?.()	//call onExpired function if time is 0 or less
				now = Date.now() + offset * 1000
				past = now % (minutes * 60 * 1000)	
				time = maxTime - Math.ceil(past / 1000)
				if (time <= 10) time += maxTime

			}else{
				onTime?.(time)
			}

			setTimer({
				hours: Math.floor(time / 3600),
				minutes: Math.floor((time % 3600) / 60),
				seconds: time % 60,
				timeString: minutes < 60 ?
					`${Math.floor((time % 3600) / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`
					: `${Math.floor(time / 3600).toString().padStart(2, '0')}:${Math.floor((time % 3600) / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`
			})
		}

		updateTimer()
		const interval: NodeJS.Timeout = setInterval(updateTimer, 1000)	//set interval to 1 second

		return () => {
			if (interval) clearInterval(interval)
		}
	}, [])

	return timer
}

