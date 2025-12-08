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
	const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>(
		'disconnected'
	)
	const [lastPriceUpdate, setLastPriceUpdate] = useState<CLOBMarketPriceUpdate | null>(null)

	useEffect(() => {
		// Create WebSocket instance
		wsRef.current = new CLOBMarketWebSocket(assetIds, {
			onPriceUpdate: (update) => {
				setLastPriceUpdate(update)
				onPriceUpdate?.(update)
			},
			onLastTradePriceUpdate: (update) => {
				onLastTradePriceUpdate?.(update)
			},
			onConnect: () => {
				setStatus('connected')
				onConnect?.()
			},
			onDisconnect: () => {
				setStatus('disconnected')
				onDisconnect?.()
			},
			onError: (error) => {
				console.error('CLOB Market WebSocket error:', error)
				setStatus('disconnected')
				onError?.(error)
			}
		})

		// Auto-connect if enabled
		if (autoConnect && assetIds.length > 0) {
			setStatus('connecting')
			wsRef.current.connect()
		}

		// Cleanup on unmount
		return () => {
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

	// Update status periodically
	useEffect(() => {
		const interval = setInterval(() => {
			if (wsRef.current) {
				setStatus(wsRef.current.getStatus())
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
