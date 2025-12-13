/**
 * React hook for Polymarket RTDS WebSocket connection
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
	RTDSWebSocket
} from '@/lib/polymarket/rtds-websocket'
import type {
	CryptoPriceUpdate,
	CryptoPriceSource
} from '@/lib/polymarket/rtds-websocket'

export interface UseRTDSWebSocketOptions {
	source?: CryptoPriceSource
	symbols?: string[]
	onPriceUpdate?: (update: CryptoPriceUpdate) => void
	onError?: (error: Error) => void
	autoConnect?: boolean
}

export interface UseRTDSWebSocketReturn {
	connect: () => void
	disconnect: () => void
	updateSymbols: (symbols: string[]) => void
	updateSource: (source: CryptoPriceSource) => void
	status: 'disconnected' | 'connecting' | 'connected'
	lastPriceUpdate: CryptoPriceUpdate | null
}

export function useRTDSWebSocket(options: UseRTDSWebSocketOptions = {}): UseRTDSWebSocketReturn {
	const {
		source = 'binance',
		symbols = [],
		onPriceUpdate,
		onError,
		autoConnect = false
	} = options

	const wsRef = useRef<RTDSWebSocket | null>(null)
	const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>(
		'disconnected'
	)
	const [lastPriceUpdate, setLastPriceUpdate] = useState<CryptoPriceUpdate | null>(null)

	// Create WebSocket instance on mount
	useEffect(() => {
		// Create WebSocket instance with initial source and symbols
		wsRef.current = new RTDSWebSocket(source, symbols, {
			onPriceUpdate: (update) => {
				setLastPriceUpdate(update)
				onPriceUpdate?.(update)
			},
			onConnect: () => {
				setStatus('connected')
			},
			onDisconnect: () => {
				setStatus('disconnected')
			},
			onError: (error) => {
				console.error('RTDS WebSocket error:', error)
				setStatus('disconnected')
				onError?.(error)
			}
		})

		// Auto-connect if enabled
		if (autoConnect) {
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

	// Update symbols when they change (only if connected)
	useEffect(() => {
		if (wsRef.current && status === 'connected') {
			wsRef.current.updateSymbols(symbols)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [symbols, status])

	// Update source when it changes (only if connected)
	useEffect(() => {
		if (wsRef.current && status === 'connected') {
			wsRef.current.updateSource(source)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [source, status])

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

	const updateSymbols = useCallback((newSymbols: string[]) => {
		if (wsRef.current) {
			wsRef.current.updateSymbols(newSymbols)
		}
	}, [])

	const updateSource = useCallback((newSource: CryptoPriceSource) => {
		if (wsRef.current) {
			wsRef.current.updateSource(newSource)
		}
	}, [])

	return {
		connect,
		disconnect,
		updateSymbols,
		updateSource,
		status,
		lastPriceUpdate
	}
}
