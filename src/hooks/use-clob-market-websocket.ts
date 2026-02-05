/**
 * React hook for CLOB Market WebSocket connection
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { CLOBMarketWebSocket } from '@/lib/polymarket/clob-market-websocket'
import type {
	CLOBMarketPriceUpdate,
	CLOBLastTradePriceUpdate
} from '@/lib/polymarket/clob-market-websocket'

export interface UseCLOBMarketWebSocketOptions {
	assetIds: string[] // Asset IDs (not market addresses!)
	onPriceUpdate?: (update: CLOBMarketPriceUpdate) => void
	onLastTradePriceUpdate?: (update: CLOBLastTradePriceUpdate) => void
	onError?: (error: Error) => void
	onConnect?: () => void
	onDisconnect?: () => void
	autoConnect?: boolean
}

export interface UseCLOBMarketWebSocketReturn {
	connect: () => void
	disconnect: () => void
	updateAssetIds: (assetIds: string[]) => void
	status: 'disconnected' | 'connecting' | 'connected'
	lastPriceUpdate: CLOBMarketPriceUpdate | null
}

export function useCLOBMarketWebSocket(
	options: UseCLOBMarketWebSocketOptions
): UseCLOBMarketWebSocketReturn {
	const {
		assetIds,
		onPriceUpdate,
		onLastTradePriceUpdate,
		onError,
		onConnect,
		onDisconnect,
		autoConnect = false
	} = options

	const wsRef = useRef<CLOBMarketWebSocket | null>(null)
	const onPriceUpdateRef = useRef(onPriceUpdate)
	const onLastTradePriceUpdateRef = useRef(onLastTradePriceUpdate)
	const onErrorRef = useRef(onError)
	const onConnectRef = useRef(onConnect)
	const onDisconnectRef = useRef(onDisconnect)
	const lastPriceUpdateThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingPriceUpdateRef = useRef<CLOBMarketPriceUpdate | null>(null)
	const lastStatusRef = useRef<'disconnected' | 'connecting' | 'connected'>('disconnected')
	const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>(
		'disconnected'
	)
	const [lastPriceUpdate, setLastPriceUpdate] = useState<CLOBMarketPriceUpdate | null>(null)

	useEffect(() => {
		onPriceUpdateRef.current = onPriceUpdate
		onLastTradePriceUpdateRef.current = onLastTradePriceUpdate
		onErrorRef.current = onError
		onConnectRef.current = onConnect
		onDisconnectRef.current = onDisconnect
	}, [onPriceUpdate, onLastTradePriceUpdate, onError, onConnect, onDisconnect])

	useEffect(() => {
		// Create WebSocket instance
		wsRef.current = new CLOBMarketWebSocket(assetIds, {
			onPriceUpdate: (update) => {
				onPriceUpdateRef.current?.(update)
				pendingPriceUpdateRef.current = update
				// Throttle lastPriceUpdate to avoid re-render storm (max ~2/sec for UI display)
				if (lastPriceUpdateThrottleRef.current === null) {
					lastPriceUpdateThrottleRef.current = setTimeout(() => {
						lastPriceUpdateThrottleRef.current = null
						const latest = pendingPriceUpdateRef.current
						if (latest) setLastPriceUpdate(latest)
					}, 500)
				}
			},
			onLastTradePriceUpdate: (update) => {
				onLastTradePriceUpdateRef.current?.(update)
			},
			onConnect: () => {
				setStatus('connected')
				onConnectRef.current?.()
			},
			onDisconnect: () => {
				setStatus('disconnected')
				onDisconnectRef.current?.()
			},
			onError: (error) => {
				console.error('CLOB Market WebSocket error:', error)
				setStatus('disconnected')
				onErrorRef.current?.(error)
			}
		})

		// Auto-connect if enabled
		if (autoConnect && assetIds.length > 0) {
			setStatus('connecting')
			wsRef.current.connect()
		}

		// Cleanup on unmount
		return () => {
			if (lastPriceUpdateThrottleRef.current) {
				clearTimeout(lastPriceUpdateThrottleRef.current)
				lastPriceUpdateThrottleRef.current = null
			}
			if (wsRef.current) {
				wsRef.current.disconnect()
				wsRef.current = null
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []) // Only run on mount

	// Update asset IDs when they change
	useEffect(() => {
		if (wsRef.current && assetIds.length > 0) {
			wsRef.current.updateAssetIds(assetIds)
		}
	}, [assetIds])

	// Update status periodically (only setState when status actually changed)
	useEffect(() => {
		const interval = setInterval(() => {
			if (wsRef.current) {
				const next = wsRef.current.getStatus()
				if (next !== lastStatusRef.current) {
					lastStatusRef.current = next
					setStatus(next)
				}
			}
		}, 1000)

		return () => clearInterval(interval)
	}, [])

	const connect = useCallback(() => {
		if (wsRef.current) {
			setStatus('connecting')
			wsRef.current.connect(true)
		}
	}, [])

	const disconnect = useCallback(() => {
		if (wsRef.current) {
			wsRef.current.disconnect()
			setStatus('disconnected')
		}
	}, [])

	const updateAssetIds = useCallback((newAssetIds: string[]) => {
		if (wsRef.current) {
			wsRef.current.updateAssetIds(newAssetIds)
		}
	}, [])

	return {
		connect,
		disconnect,
		updateAssetIds,
		status,
		lastPriceUpdate
	}
}
