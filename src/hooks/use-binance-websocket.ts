/**
 * React hook for direct Binance WebSocket connection
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { BinanceWebSocket } from '@/lib/binance/binance-websocket'
import type { BinanceTickerUpdate } from '@/lib/binance/binance-websocket'

export interface UseBinanceWebSocketOptions {
	streams?: string[] // e.g., ["btcusdt@ticker", "ethusdt@ticker"]
	onTickerUpdate?: (update: BinanceTickerUpdate) => void
	onError?: (error: Error) => void
	autoConnect?: boolean
}

export interface UseBinanceWebSocketReturn {
	connect: () => void
	disconnect: () => void
	updateStreams: (streams: string[]) => void
	status: 'disconnected' | 'connecting' | 'connected'
	lastTickerUpdate: BinanceTickerUpdate | null
}

export function useBinanceWebSocket(
	options: UseBinanceWebSocketOptions = {}
): UseBinanceWebSocketReturn {
	const { streams = [], onTickerUpdate, onError, autoConnect = false } = options

	const wsRef = useRef<BinanceWebSocket | null>(null)
	const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>(
		'disconnected'
	)
	const [lastTickerUpdate, setLastTickerUpdate] = useState<BinanceTickerUpdate | null>(null)

	// Create WebSocket instance on mount
	useEffect(() => {
		// Create WebSocket instance with initial streams
		wsRef.current = new BinanceWebSocket(streams, {
			onTickerUpdate: (update) => {
				setLastTickerUpdate(update)
				onTickerUpdate?.(update)
			},
			onConnect: () => {
				setStatus('connected')
			},
			onDisconnect: () => {
				setStatus('disconnected')
			},
			onError: (error) => {
				console.error('Binance WebSocket error:', error)
				setStatus('disconnected')
				onError?.(error)
			}
		})

		// Auto-connect if enabled
		if (autoConnect && streams.length > 0) {
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

	// Update streams when they change (always update, even if not connected)
	useEffect(() => {
		if (wsRef.current) {
			wsRef.current.updateStreams(streams)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [streams.join(',')])

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

	const updateStreams = useCallback((newStreams: string[]) => {
		if (wsRef.current) {
			wsRef.current.updateStreams(newStreams)
		}
	}, [])

	return {
		connect,
		disconnect,
		updateStreams,
		status,
		lastTickerUpdate
	}
}
