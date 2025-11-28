/**
 * React hook for Polymarket RTDS Market WebSocket connection
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { RTDSMarketWebSocket, MarketPriceUpdate } from '@/lib/polymarket/rtds-market-websocket'

export interface UseRTDSMarketWebSocketOptions {
	conditionIds?: string[]
	assetIds?: string[]
	eventSlugs?: string[] // Market slugs for activity subscription (e.g., 'btc-updown-15m-1764280800')
	onPriceUpdate?: (update: MarketPriceUpdate) => void
	onActivityUpdate?: (update: any) => void
	onError?: (error: Error) => void
	autoConnect?: boolean
}

export interface UseRTDSMarketWebSocketReturn {
	connect: () => void
	disconnect: () => void
	updateConditionIds: (conditionIds: string[]) => void
	updateAssetIds: (assetIds: string[]) => void
	updateEventSlugs: (eventSlugs: string[]) => void
	status: 'disconnected' | 'connecting' | 'connected'
	lastPriceUpdate: MarketPriceUpdate | null
}

export function useRTDSMarketWebSocket(
	options: UseRTDSMarketWebSocketOptions = {}
): UseRTDSMarketWebSocketReturn {
	const {
		conditionIds = [],
		assetIds = [],
		eventSlugs = [],
		onPriceUpdate,
		onActivityUpdate,
		onError,
		autoConnect = false,
	} = options

	const wsRef = useRef<RTDSMarketWebSocket | null>(null)
	const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
	const [lastPriceUpdate, setLastPriceUpdate] = useState<MarketPriceUpdate | null>(null)

	useEffect(() => {
		// Create WebSocket instance only once
		wsRef.current = new RTDSMarketWebSocket(conditionIds, assetIds, eventSlugs, {
			onPriceUpdate: (update) => {
				setLastPriceUpdate(update)
				onPriceUpdate?.(update)
			},
			onActivityUpdate: (update) => {
				onActivityUpdate?.(update)
			},
			onConnect: () => {
				setStatus('connected')
			},
			onDisconnect: () => {
				setStatus('disconnected')
			},
			onError: (error) => {
				console.error('RTDS Market WebSocket error:', error)
				setStatus('disconnected')
				onError?.(error)
			},
		})

		// Auto-connect if enabled
		if (autoConnect && (conditionIds.length > 0 || assetIds.length > 0 || eventSlugs.length > 0)) {
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

	// Update condition IDs when they change (only if connected and values changed)
	useEffect(() => {
		if (wsRef.current && status === 'connected' && conditionIds.length > 0) {
			wsRef.current.updateConditionIds(conditionIds)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [conditionIds, status])

	// Update asset IDs when they change (only if connected and values changed)
	useEffect(() => {
		if (wsRef.current && status === 'connected' && assetIds.length > 0) {
			wsRef.current.updateAssetIds(assetIds)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [assetIds, status])

	// Update event slugs when they change (only if connected and values changed)
	useEffect(() => {
		if (wsRef.current && status === 'connected' && eventSlugs.length > 0) {
			wsRef.current.updateEventSlugs(eventSlugs)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [eventSlugs, status])

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

	const updateConditionIds = useCallback((newConditionIds: string[]) => {
		if (wsRef.current) {
			wsRef.current.updateConditionIds(newConditionIds)
		}
	}, [])

	const updateAssetIds = useCallback((newAssetIds: string[]) => {
		if (wsRef.current) {
			wsRef.current.updateAssetIds(newAssetIds)
		}
	}, [])

	const updateEventSlugs = useCallback((newEventSlugs: string[]) => {
		if (wsRef.current) {
			wsRef.current.updateEventSlugs(newEventSlugs)
		}
	}, [])

	return {
		connect,
		disconnect,
		updateConditionIds,
		updateAssetIds,
		updateEventSlugs,
		status,
		lastPriceUpdate,
	}
}

