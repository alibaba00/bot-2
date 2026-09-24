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
	const callbacksRef = useRef(callbacks)
	callbacksRef.current = callbacks

	const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
	const [error, setError] = useState<Error | null>(null)

	const createWebSocket = (apiCredentials: ApiCredentials) => {
		return new UserChannelWebSocket(apiCredentials, {
			onTradeUpdate: (trade) => callbacksRef.current.onTradeUpdate?.(trade),
			onOrderUpdate: (order) => callbacksRef.current.onOrderUpdate?.(order),
			onConnect: () => {
				setStatus('connected')
				setError(null)
				callbacksRef.current.onConnect?.()
			},
			onDisconnect: () => {
				setStatus('disconnected')
				callbacksRef.current.onDisconnect?.()
			},
			onError: (err) => {
				setError(err)
				setStatus('disconnected')
				callbacksRef.current.onError?.(err)
			}
		})
	}

	const ensureWebSocket = (): UserChannelWebSocket | null => {
		if (wsRef.current) return wsRef.current

		const apiCredentials = getApiCredentials()
		if (!apiCredentials) {
			const err = new Error('API credentials not found. Please connect to Polymarket first.')
			setError(err)
			callbacksRef.current.onError?.(err)
			return null
		}

		wsRef.current = createWebSocket(apiCredentials)
		return wsRef.current
	}

	// Initialize WebSocket (and optionally connect)
	useEffect(() => {
		const ws = ensureWebSocket()
		if (!ws) return

		if (autoConnect) {
			ws.connect()
			setStatus('connecting')
		}

		return () => {
			if (wsRef.current) {
				wsRef.current.disconnect()
				wsRef.current = null
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only recreate when autoConnect changes
	}, [autoConnect])

	const connect = () => {
		const ws = ensureWebSocket()
		if (!ws) return
		ws.connect()
		setStatus('connecting')
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
