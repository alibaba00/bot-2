/**
 * React hook for Polymarket WebSocket connection
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { PolymarketWebSocket, WebSocketPriceUpdate, WebSocketOrderBookUpdate, WS_URLS } from '@/lib/polymarket/websocket'

export interface UsePolymarketWebSocketOptions {
	assetIds: string[]
	onPriceUpdate?: (update: WebSocketPriceUpdate) => void
	onOrderBookUpdate?: (update: WebSocketOrderBookUpdate) => void
	onError?: (error: Error) => void
	autoConnect?: boolean
	wsUrl?: string // Optional: specify which WebSocket URL to use
}

export interface UsePolymarketWebSocketReturn {
	connect: () => void
	disconnect: () => void
	updateAssetIds: (assetIds: string[]) => void
	status: 'disconnected' | 'connecting' | 'connected'
	lastPriceUpdate: WebSocketPriceUpdate | null
	lastOrderBookUpdate: WebSocketOrderBookUpdate | null
}

export function usePolymarketWebSocket(
	options: UsePolymarketWebSocketOptions
): UsePolymarketWebSocketReturn {
	const { assetIds, onPriceUpdate, onOrderBookUpdate, onError, autoConnect = true, wsUrl } = options

	const wsRef = useRef<PolymarketWebSocket | null>(null)
	const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
	const [lastPriceUpdate, setLastPriceUpdate] = useState<WebSocketPriceUpdate | null>(null)
	const [lastOrderBookUpdate, setLastOrderBookUpdate] = useState<WebSocketOrderBookUpdate | null>(null)

	useEffect(() => {
		// Create WebSocket instance with specific URL
		wsRef.current = new PolymarketWebSocket(assetIds, {
			onPriceUpdate: (update) => {
				setLastPriceUpdate(update)
				onPriceUpdate?.(update)
			},
			onOrderBookUpdate: (update) => {
				setLastOrderBookUpdate(update)
				onOrderBookUpdate?.(update)
			},
			onConnect: () => {
				setStatus('connected')
			},
			onDisconnect: () => {
				setStatus('disconnected')
			},
			onError: (error) => {
				console.error('WebSocket error:', error)
				setStatus('disconnected')
				onError?.(error)
			},
		}, wsUrl) // Pass the specific URL to the constructor

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
			// Force connection even if reconnect was disabled
			wsRef.current.connect(true)
		}
	}, [])

	const disconnect = useCallback(() => {
		console.log('Disconnect called from hook')
		if (wsRef.current) {
			wsRef.current.disconnect()
			// Force status update immediately and after a delay to ensure it's updated
			setStatus('disconnected')
			setTimeout(() => {
				setStatus('disconnected')
			}, 200)
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
		lastPriceUpdate,
		lastOrderBookUpdate,
	}
}

