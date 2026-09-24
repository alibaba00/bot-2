/**
 * Polymarket User Channel WebSocket
 * Handles real-time user order and trade updates via authenticated WebSocket
 * Uses wss://clob.polymarket.com/ws/user
 * 
 * Documentation: https://docs.polymarket.com/developers/CLOB/websocket/user-channel
 */

export interface MakerOrder {
	asset_id: string
	matched_amount: string
	order_id: string
	outcome: string
	owner: string
	price: string
}

export interface TradeMessage {
	asset_id: string
	event_type: 'trade'
	id: string // trade id
	last_update: string
	maker_orders: MakerOrder[]
	market: string // condition ID
	matchtime: string
	outcome: string
	owner: string // api key of event owner
	price: string
	side: 'BUY' | 'SELL'
	size: string
	status: 'MATCHED' | 'MINED' | 'CONFIRMED' | 'RETRYING' | 'FAILED'
	taker_order_id: string
	timestamp: string
	trade_owner: string // api key of trade owner
	type: 'TRADE'
}

export interface OrderMessage {
	asset_id: string
	associate_trades: string[] | null // array of trade ids
	event_type: 'order'
	id: string // order id
	market: string // condition ID
	order_owner: string
	original_size: string
	outcome: string
	owner: string
	size: string
	price: string
	side: 'BUY' | 'SELL'
	size_matched: string
	timestamp: string
	type: 'PLACEMENT' | 'UPDATE' | 'CANCELLATION'
}

export type UserChannelMessage = TradeMessage | OrderMessage

export interface UserChannelCallbacks {
	onTradeUpdate?: (trade: TradeMessage) => void
	onOrderUpdate?: (order: OrderMessage) => void
	onError?: (error: Error) => void
	onConnect?: () => void
	onDisconnect?: () => void
}

export interface ApiCredentials {
	key: string
	secret: string
	passphrase: string
}

const USER_CHANNEL_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/user'
const PING_INTERVAL = 30000 // 30 seconds
const RECONNECT_DELAY_MS = 5000

export class UserChannelWebSocket {
	private ws: WebSocket | null = null
	private callbacks: UserChannelCallbacks = {}
	private pingInterval: number | null = null
	private reconnectAttempts = 0
	private maxReconnectAttempts = 5
	private isConnecting = false
	private isConnected = false
	private shouldReconnect = true
	private apiCredentials: ApiCredentials | null = null
	private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null

	constructor(apiCredentials: ApiCredentials, callbacks: UserChannelCallbacks = {}) {
		this.apiCredentials = apiCredentials
		this.callbacks = callbacks
	}

	/**
	 * Connect to the User Channel WebSocket
	 */
	connect(force = true): void {
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
			console.log('User Channel: Already connecting or connected, skipping...')
			return
		}

		if (!force && !this.shouldReconnect) {
			console.log('User Channel: Reconnect disabled, not connecting.')
			return
		}

		if (!this.apiCredentials || !this.apiCredentials.key || !this.apiCredentials.secret || !this.apiCredentials.passphrase) {
			console.error('User Channel: ❌ API credentials are missing')
			this.callbacks.onError?.(new Error('API credentials are required for User Channel'))
			return
		}

		this.isConnecting = true

		console.log(`User Channel: Connecting to ${USER_CHANNEL_WS_URL}`)

		try {
			this.ws = new WebSocket(USER_CHANNEL_WS_URL)

			this.ws.onopen = () => {
				console.log('User Channel: ✅ WebSocket connected successfully')
				this.isConnecting = false
				this.isConnected = true
				this.reconnectAttempts = 0

				// Subscribe immediately — server may close an unsubscribed connection
				if (this.ws && this.apiCredentials) {
					this.subscribe()
				}

				// Start ping interval
				this.startPing()

				this.callbacks.onConnect?.()
			}

			this.ws.onmessage = (event) => {
				try {
					// Handle PONG response
					if (event.data === 'PONG' || event.data === 'pong') {
						// console.log('✅ User Channel: Received PONG')
						return
					}

					// Handle string messages
					if (typeof event.data === 'string') {
						try {
							const data = JSON.parse(event.data) as UserChannelMessage | any

							// Check if it's an error response
							if (data.error || data.message) {
								const errorMsg = data.error || data.message || 'Server error'
								console.error('❌ User Channel: Server error response:', errorMsg)
								this.callbacks.onError?.(new Error(errorMsg))
								return
							}

							// Handle trade messages
							if (data.event_type === 'trade' && data.type === 'TRADE') {
								this.handleTradeMessage(data as TradeMessage)
							}
							// Handle order messages
							else if (data.event_type === 'order') {
								this.handleOrderMessage(data as OrderMessage)
							}
							else {
								console.log('User Channel: 📨 Received unknown message type:', data)
							}
						} catch (parseError) {
							console.warn('⚠️ User Channel: Failed to parse message:', event.data, parseError)
						}
					} else {
						console.warn('⚠️ User Channel: Received non-string message:', event.data)
					}
				} catch (error) {
					console.error('❌ User Channel: Error handling message:', error)
				}
			}

			this.ws.onerror = (error) => {
				console.error('❌ User Channel: WebSocket error:', error)
				this.isConnecting = false
				this.isConnected = false

				const errorMessage =
					error instanceof Error
						? error.message
						: 'User Channel WebSocket connection error'

				this.callbacks.onError?.(new Error(errorMessage))
				this.ws?.close()
			}

			this.ws.onclose = (event) => {
				console.log('🔌 User Channel: WebSocket closed', {
					code: event.code,
					reason: event.reason,
					wasClean: event.wasClean
				})

				this.isConnecting = false
				this.isConnected = false
				this.ws = null
				this.stopPing()

				this.callbacks.onDisconnect?.()

				// Auto-reconnect
				if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.reconnectAttempts++
					this.reconnectTimeoutId = setTimeout(() => {
						this.reconnectTimeoutId = null
						if (this.shouldReconnect) {
							console.log(
								`🔄 User Channel: Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
							)
							this.connect(false)
						}
					}, RECONNECT_DELAY_MS)
				} else if (!this.shouldReconnect) {
					console.log('⏸️ User Channel: Auto-reconnect disabled')
				} else {
					console.log(
						`⛔ User Channel: Max reconnect attempts (${this.maxReconnectAttempts}) reached`
					)
				}
			}
		} catch (error) {
			this.isConnecting = false
			this.isConnected = false
			console.error('❌ User Channel: Failed to create WebSocket:', error)
			this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
		}
	}

	/**
	 * Subscribe to user channel
	 * Sends authentication credentials to subscribe to user-specific updates
	 */
	private subscribe(): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.warn('⚠️ User Channel: WebSocket not ready for subscription')
			return
		}

		if (!this.apiCredentials) {
			console.error('❌ User Channel: API credentials not available')
			return
		}

		// Subscribe to user channel with authentication.
		// Omit `markets` to receive events for all markets (empty [] can filter to none).
		const subscription: Record<string, unknown> = {
			type: 'user',
			auth: {
				apiKey: this.apiCredentials.key,
				secret: this.apiCredentials.secret,
				passphrase: this.apiCredentials.passphrase
			}
		}

		const subscriptionMessage = JSON.stringify(subscription)
		console.log(`📤 User Channel: Sending subscription (credentials masked)`)

		try {
			this.ws.send(subscriptionMessage)
			console.log(`✅ User Channel: Subscription sent successfully`)
		} catch (sendError) {
			console.error(`❌ User Channel: Failed to send subscription:`, sendError)
			this.callbacks.onError?.(new Error('Failed to send subscription'))
		}
	}

	/**
	 * Handle trade message
	 */
	private handleTradeMessage(trade: TradeMessage): void {
		console.log('User Channel: 📊 Trade update received:', {
			id: trade.id,
			status: trade.status,
			side: trade.side,
			price: trade.price,
			size: trade.size,
			asset_id: trade.asset_id,
			market: trade.market
		})

		this.callbacks.onTradeUpdate?.(trade)
	}

	/**
	 * Handle order message
	 */
	private handleOrderMessage(order: OrderMessage): void {
		console.log('User Channel: 📋 Order update received:', {
			id: order.id,
			type: order.type,
			side: order.side,
			price: order.price,
			original_size: order.original_size,
			size_matched: order.size_matched,
			asset_id: order.asset_id,
			market: order.market
		})

		this.callbacks.onOrderUpdate?.(order)
	}

	/**
	 * Disconnect from the WebSocket
	 */
	disconnect(): void {
		console.log('🛑 User Channel: Disconnecting WebSocket...')

		this.shouldReconnect = false
		if (this.reconnectTimeoutId !== null) {
			clearTimeout(this.reconnectTimeoutId)
			this.reconnectTimeoutId = null
		}

		this.stopPing()

		this.isConnected = false
		this.isConnecting = false
		this.reconnectAttempts = 0

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

		console.log('✅ User Channel: WebSocket disconnected')
	}

	/**
	 * Update API credentials
	 */
	updateCredentials(apiCredentials: ApiCredentials): void {
		this.apiCredentials = apiCredentials
		// If connected, reconnect with new credentials
		if (this.isConnected) {
			this.disconnect()
			setTimeout(() => {
				this.connect(true)
			}, 1000)
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
