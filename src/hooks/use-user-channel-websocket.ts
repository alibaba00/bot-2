/**
 * React Hook for User Channel WebSocket
 * Provides easy access to real-time user order and trade updates
 */

import { useEffect, useRef, useState } from 'react'
import { UserChannelWebSocket, UserChannelCallbacks, ApiCredentials } from '@/lib/polymarket/user-channel-websocket'
import { getValidatedConfig } from '@/lib/polymarket/config'

function getStoredApiCreds(storageKey: string): ApiCredentials | null {
	try {
		if (typeof localStorage === 'undefined') return null
		const raw = localStorage.getItem(storageKey)
		if (!raw) return null
		const parsed = JSON.parse(raw)
		if (parsed?.key && parsed?.secret && parsed?.passphrase) {
			return {
				key: parsed.key,
				secret: parsed.secret,
				passphrase: parsed.passphrase
			}
		}
	} catch {
		// Ignore storage errors
	}
	return null
}

/**
 * Get API credentials from storage
 */
function getApiCredentials(): ApiCredentials | null {
	try {
		const config = getValidatedConfig()
		const apiCredsKey = `polymarketApiCreds:${config.userId}`
		return getStoredApiCreds(apiCredsKey)
	} catch (error) {
		console.error('Failed to get API credentials:', error)
		return null
	}
}

export interface UseUserChannelWebSocketOptions extends UserChannelCallbacks {
	autoConnect?: boolean
}

export interface UseUserChannelWebSocketReturn {
	ws: UserChannelWebSocket | null
	status: 'disconnected' | 'connecting' | 'connected'
	connect: () => void
	disconnect: () => void
	error: Error | null
}

/**
 * React Hook for User Channel WebSocket
 * 
 * @example
 * ```tsx
 * const { status, connect, disconnect, ws } = useUserChannelWebSocket({
 *   onTradeUpdate: (trade) => {
 *     console.log('Trade updated:', trade)
 *   },
 *   onOrderUpdate: (order) => {
 *     console.log('Order updated:', order)
 *   }
 * })
 * ```
 */
export function useUserChannelWebSocket(
	options: UseUserChannelWebSocketOptions = {}
): UseUserChannelWebSocketReturn {
	const { autoConnect = false, ...callbacks } = options
	const wsRef = useRef<UserChannelWebSocket | null>(null)
	const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
	const [error, setError] = useState<Error | null>(null)

	// Initialize WebSocket
	useEffect(() => {
		const apiCredentials = getApiCredentials()
		
		if (!apiCredentials) {
			const err = new Error('API credentials not found. Please connect to Polymarket first.')
			setError(err)
			callbacks.onError?.(err)
			return
		}

		// Create WebSocket instance
		wsRef.current = new UserChannelWebSocket(apiCredentials, {
			...callbacks,
			onConnect: () => {
				setStatus('connected')
				setError(null)
				callbacks.onConnect?.()
			},
			onDisconnect: () => {
				setStatus('disconnected')
				callbacks.onDisconnect?.()
			},
			onError: (err) => {
				setError(err)
				setStatus('disconnected')
				callbacks.onError?.(err)
			}
		})

		// Auto-connect if enabled
		if (autoConnect) {
			wsRef.current.connect()
			setStatus('connecting')
		}

		// Cleanup on unmount
		return () => {
			if (wsRef.current) {
				wsRef.current.disconnect()
				wsRef.current = null
			}
		}
	}, [autoConnect]) // Only re-run if autoConnect changes

	const connect = () => {
		if (wsRef.current) {
			wsRef.current.connect()
			setStatus('connecting')
		}
	}

	const disconnect = () => {
		if (wsRef.current) {
			wsRef.current.disconnect()
			setStatus('disconnected')
		}
	}

	return {
		ws: wsRef.current,
		status,
		connect,
		disconnect,
		error
	}
}
