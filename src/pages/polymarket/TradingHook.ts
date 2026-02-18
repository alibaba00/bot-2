import { useRef, useState } from "react"
import { create } from "zustand"

const tradingStore = create<{
	trading: boolean
	tradingActive: boolean
	tradingCompleted: boolean
	tradingFailed: boolean
}>()

const useTrading = () => {
	const [trading, setTrading] = useState(false)
	const [tradingActive, setTradingActive] = useState(false)
	const [tradingCompleted, setTradingCompleted] = useState(false)
	const [tradingFailed, setTradingFailed] = useState(false)

	const setup = useRef<{
		index: number
	}>({
		index: Math.random(),
	})

	return setup.current
}

export default useTrading
