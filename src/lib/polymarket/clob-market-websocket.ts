/**
 * Polymarket CLOB Market WebSocket
 * Handles real-time market price data via CLOB WebSocket
 * Uses wss://ws-subscriptions-clob.polymarket.com/ws/market
 */

export interface CLOBMarketPriceChange {
	asset_id: string
	price: string
	size: string
	side: 'BUY' | 'SELL'
	hash: string
	best_bid: string
	best_ask: string
}

export interface CLOBMarketMessage {
	market: string // Market address (0x...)
	price_changes?: CLOBMarketPriceChange[]
	timestamp: string
	event_type: string
	// For last_trade_price events
	asset_id?: string
	price?: string
	size?: string
	fee_rate_bps?: string
	side?: 'BUY' | 'SELL'
	transaction_hash?: string
}

export interface CLOBMarketPriceUpdate {
	asset_id: string
	price: number
	timestamp: number
	side?: 'BUY' | 'SELL'
	size?: number
	best_bid?: number
	best_ask?: number
	hash?: string
}

export interface CLOBLastTradePriceUpdate {
	asset_id: string
	price: number
	size: number
	side: 'BUY' | 'SELL'
	timestamp: number
	transaction_hash?: string
	fee_rate_bps?: number
	market: string
}

export interface CLOBMarketCallbacks {
	onPriceUpdate?: (update: CLOBMarketPriceUpdate) => void
	onLastTradePriceUpdate?: (update: CLOBLastTradePriceUpdate) => void
	onError?: (error: Error) => void
	onConnect?: () => void
	onDisconnect?: () => void
}

const CLOB_MARKET_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market'
const PING_INTERVAL = 10000 // 10 seconds
const RECONNECT_DELAY_MS = 5000 // wie Coinbase: nach Error/Close ~5s neu verbinden

export class CLOBMarketWebSocket {
	private ws: WebSocket | null = null
	private callbacks: CLOBMarketCallbacks = {}
	private pingInterval: number | null = null
	private reconnectAttempts = 0
	private maxReconnectAttempts = 5
	private isConnecting = false
	private isConnected = false
	private shouldReconnect = true
	private assetIds: string[] = [] // Asset IDs (not market addresses!)
	private lastSubscriptionKey: string | null = null
	private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null

	constructor(assetIds: string[] = [], callbacks: CLOBMarketCallbacks = {}) {
		this.assetIds = assetIds
		this.callbacks = callbacks
	}

	/**
	 * Connect to the CLOB Market WebSocket
	 */
	connect(force = false): void {
		if (force) {
			this.shouldReconnect = true
			this.reconnectAttempts = 0
			this.isConnecting = false
			this.isConnected = false
			if (this.ws) {
				this.ws.onopen = null
				this.ws.onmessage = null
				this.ws.onerror = null
				this.ws.onclose = null
				if (
					this.ws.readyState === WebSocket.OPEN ||
					this.ws.readyState === WebSocket.CONNECTING
				) {
					this.ws.close(1000, 'Force reconnect')
				}
				this.ws = null
			}
		}

		if (!force && (this.isConnecting || this.isConnected)) {
			console.log('CLOB Market: Already connecting or connected, skipping...')
			return
		}

		if (!force && !this.shouldReconnect) {
			console.log('CLOB Market: Reconnect disabled, not connecting.')
			return
		}

		this.isConnecting = true

		console.log(`CLOB Market: Connecting to ${CLOB_MARKET_WS_URL}`)
		console.log(`CLOB Market: Asset IDs: ${this.assetIds.join(', ') || 'none'}`)

		try {
			this.ws = new WebSocket(CLOB_MARKET_WS_URL)

			this.ws.onopen = () => {
				console.log('✅ CLOB Market WebSocket connected successfully')
				this.isConnecting = false
				this.isConnected = true
				this.reconnectAttempts = 0

				// Subscribe to market(s)
				if (this.ws && this.assetIds.length > 0) {
					setTimeout(() => {
						if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
							console.warn('⚠️ CLOB Market WebSocket not ready for subscription')
							return
						}

						this.subscribe()
					}, 1000)
				} else {
					console.warn('⚠️ No asset IDs available for subscription')
				}

				// Start ping interval
				this.startPing()

				this.callbacks.onConnect?.()
			}

			this.ws.onmessage = (event) => {
				try {
					// Handle PONG response
					if (event.data === 'PONG' || event.data === 'pong') {
						console.log('✅ CLOB Market: Received PONG')
						return
					}

					// Handle string messages
					if (typeof event.data === 'string') {
						try {
							const data = JSON.parse(event.data) as CLOBMarketMessage
							// console.log('📦 CLOB Market: Parsed message:', data)

							// Check if it's an error response
							if (data.event_type === 'error' || (data as any).error) {
								const errorMsg =
									(data as any).error || (data as any).message || 'Server error'
								console.error('❌ CLOB Market: Server error response:', errorMsg)
								this.callbacks.onError?.(new Error(errorMsg))
								return
							}

							// Handle price_change events
							// if (data.event_type === 'price_change' && data.price_changes) {
							// 	this.handlePriceChanges(data)
							// }

							// Handle last_trade_price events
							if (
								data.event_type === 'last_trade_price' &&
								data.asset_id &&
								data.price
							) {
								this.handleLastTradePrice(data)
							}
						} catch (parseError) {
							console.warn(
								'⚠️ CLOB Market: Failed to parse message:',
								event.data,
								parseError
							)
						}
					} else {
						console.warn('⚠️ CLOB Market: Received non-string message:', event.data)
					}
				} catch (error) {
					console.error('❌ CLOB Market: Error handling message:', error)
				}
			}

			this.ws.onerror = (error) => {
				console.error('❌ CLOB Market: WebSocket error:', error)
				this.isConnecting = false
				this.isConnected = false

				const errorMessage =
					error instanceof Error
						? error.message
						: 'CLOB Market WebSocket connection error'

				this.callbacks.onError?.(new Error(errorMessage))
				// Verbindung schließen → onclose übernimmt Reconnect nach RECONNECT_DELAY_MS
				this.ws?.close()
			}

			this.ws.onclose = (event) => {
				console.log('🔌 CLOB Market: WebSocket closed', {
					code: event.code,
					reason: event.reason,
					wasClean: event.wasClean
				})

				this.isConnecting = false
				this.isConnected = false
				this.ws = null
				this.stopPing()

				this.callbacks.onDisconnect?.()

				// Auto-reconnect nach festem Delay (wie Coinbase), solange gewünscht
				if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.reconnectAttempts++
					this.reconnectTimeoutId = setTimeout(() => {
						this.reconnectTimeoutId = null
						if (this.shouldReconnect) {
							console.log(
								`🔄 CLOB Market: Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
							)
							this.connect()
						}
					}, RECONNECT_DELAY_MS)
				} else if (!this.shouldReconnect) {
					console.log('⏸️ CLOB Market: Auto-reconnect disabled')
				} else {
					console.log(
						`⛔ CLOB Market: Max reconnect attempts (${this.maxReconnectAttempts}) reached`
					)
				}
			}
		} catch (error) {
			this.isConnecting = false
			this.isConnected = false
			console.error('❌ CLOB Market: Failed to create WebSocket:', error)
			this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
		}
	}

	/**
	 * Subscribe to market(s)
	 * Uses the correct format: {"assets_ids": [...], "type": "market"}
	 */
	private subscribe(): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.warn('⚠️ CLOB Market: WebSocket not ready for subscription')
			return
		}

		if (this.assetIds.length === 0) {
			console.warn('⚠️ CLOB Market: No asset IDs to subscribe to')
			return
		}

		// Use the correct format as seen on Polymarket website
		const subscription = {
			assets_ids: this.assetIds,
			type: 'market'
		}

		const subscriptionMessage = JSON.stringify(subscription)
		if (this.lastSubscriptionKey === subscriptionMessage) {
			console.log('⏭️ CLOB Market: Subscription unchanged, skipping duplicate send')
			return
		}
		console.log(`📤 CLOB Market: Sending subscription:`, subscriptionMessage)

		try {
			this.ws.send(subscriptionMessage)
			this.lastSubscriptionKey = subscriptionMessage
			console.log(`✅ CLOB Market: Subscription sent successfully`)
		} catch (sendError) {
			console.error(`❌ CLOB Market: Failed to send subscription:`, sendError)
			this.callbacks.onError?.(new Error('Failed to send subscription'))
		}
	}

	/**
	 * Handle price changes from WebSocket message
	 * @internal
	 */
	// @ts-expect-error - Function is intentionally unused (commented out in code)
	private _handlePriceChanges(message: CLOBMarketMessage): void {
		if (!message.price_changes || !Array.isArray(message.price_changes)) {
			return
		}

		const timestamp = message.timestamp
			? parseInt(message.timestamp, 10) < 10000000000
				? parseInt(message.timestamp, 10) * 1000
				: parseInt(message.timestamp, 10)
			: Date.now()

		message.price_changes.forEach((priceChange) => {
			const update: CLOBMarketPriceUpdate = {
				asset_id: priceChange.asset_id,
				price: parseFloat(priceChange.price),
				timestamp,
				side: priceChange.side,
				size: parseFloat(priceChange.size),
				best_bid: parseFloat(priceChange.best_bid),
				best_ask: parseFloat(priceChange.best_ask),
				hash: priceChange.hash
			}

			// console.log('💰 CLOB Market: Price update:', {
			// 	asset_id: update.asset_id,
			// 	price: update.price,
			// 	side: update.side,
			// 	best_bid: update.best_bid,
			// 	best_ask: update.best_ask,
			// })

			this.callbacks.onPriceUpdate?.(update)
		})
	}

	/**
	 * Handle last_trade_price events from WebSocket message
	 */
	private handleLastTradePrice(message: CLOBMarketMessage): void {
		if (!message.asset_id || !message.price) {
			return
		}

		const timestamp = message.timestamp
			? parseInt(message.timestamp, 10) < 10000000000
				? parseInt(message.timestamp, 10) * 1000
				: parseInt(message.timestamp, 10)
			: Date.now()

		const update: CLOBLastTradePriceUpdate = {
			asset_id: message.asset_id,
			price: parseFloat(message.price),
			size: parseFloat(message.size || '0'),
			side: message.side || 'BUY',
			timestamp,
			transaction_hash: message.transaction_hash,
			fee_rate_bps: message.fee_rate_bps ? parseFloat(message.fee_rate_bps) : undefined,
			market: message.market
		}

		this.callbacks.onLastTradePriceUpdate?.(update)
	}

	/**
	 * Disconnect from the WebSocket
	 */
	disconnect(): void {
		console.log('🛑 CLOB Market: Disconnecting WebSocket...')

		this.shouldReconnect = false
		if (this.reconnectTimeoutId !== null) {
			clearTimeout(this.reconnectTimeoutId)
			this.reconnectTimeoutId = null
		}

		this.stopPing()

		this.isConnected = false
		this.isConnecting = false
		this.reconnectAttempts = 0
		this.lastSubscriptionKey = null

		if (this.ws) {
			this.ws.onopen = null
			this.ws.onmessage = null
			this.ws.onerror = null
			this.ws.onclose = null

			if (
				this.ws.readyState === WebSocket.OPEN ||
				this.ws.readyState === WebSocket.CONNECTING
			) {
				this.ws.close(1000, 'Manual disconnect')
			}
			this.ws = null
		}

		this.callbacks.onDisconnect?.()

		console.log('✅ CLOB Market: WebSocket disconnected')
	}

	/**
	 * Update asset IDs to subscribe to
	 */
	updateAssetIds(assetIds: string[]): void {
		this.assetIds = assetIds
		if (this.isConnected && this.ws) {
			// Resubscribe with new asset IDs
			this.subscribe()
		}
	}

	/**
	 * Start ping interval
	 */
	private startPing(): void {
		this.stopPing()
		this.pingInterval = window.setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.ws.send('PING')
			}
		}, PING_INTERVAL)
	}

	/**
	 * Stop ping interval
	 */
	private stopPing(): void {
		if (this.pingInterval !== null) {
			clearInterval(this.pingInterval)
			this.pingInterval = null
		}
	}

	/**
	 * Get connection status
	 */
	getStatus(): 'disconnected' | 'connecting' | 'connected' {
		if (this.isConnected) return 'connected'
		if (this.isConnecting) return 'connecting'
		return 'disconnected'
	}
}
