/**
 * Polymarket RTDS (Real-Time Data Socket) WebSocket Service
 * Handles real-time crypto price data via WebSocket
 * Documentation: https://docs.polymarket.com/developers/RTDS/RTDS-overview
 */

export interface CryptoPriceUpdate {
	symbol: string
	value: number
	timestamp: number
}

export interface RTDSMessage {
	topic: string
	type: string
	timestamp: number
	payload: CryptoPriceUpdate
}

export interface RTDSCallbacks {
	onPriceUpdate?: (update: CryptoPriceUpdate) => void
	onError?: (error: Error) => void
	onConnect?: () => void
	onDisconnect?: () => void
}

export type CryptoPriceSource = 'binance' | 'chainlink'

const RTDS_WS_URL = 'wss://ws-live-data.polymarket.com'
const PING_INTERVAL = 5000 // 5 seconds as recommended by documentation

export class RTDSWebSocket {
	private ws: WebSocket | null = null
	private callbacks: RTDSCallbacks = {}
	private pingInterval: number | null = null
	private reconnectAttempts = 0
	private maxReconnectAttempts = 5
	private reconnectDelay = 3000
	private isConnecting = false
	private isConnected = false
	private shouldReconnect = true
	private source: CryptoPriceSource = 'binance'
	private symbols: string[] = []

	constructor(
		source: CryptoPriceSource = 'binance',
		symbols: string[] = [],
		callbacks: RTDSCallbacks = {}
	) {
		this.source = source
		this.symbols = symbols
		this.callbacks = callbacks
	}

	/**
	 * Connect to the RTDS WebSocket
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
			console.log('RTDS: Already connecting or connected, skipping...')
			return
		}

		if (!force && !this.shouldReconnect) {
			console.log('RTDS: Reconnect disabled, not connecting.')
			return
		}

		this.isConnecting = true

		console.log(`RTDS: Connecting to ${RTDS_WS_URL}`)
		console.log(`RTDS: Source: ${this.source}, Symbols: ${this.symbols.join(', ') || 'all'}`)

		try {
			this.ws = new WebSocket(RTDS_WS_URL)

			this.ws.onopen = () => {
				console.log('RTDS: ✅ WebSocket connected successfully')
				this.isConnecting = false
				this.isConnected = true
				this.reconnectAttempts = 0

				// Subscribe to crypto prices
				this.subscribe()

				// Start ping interval
				this.startPing()

				this.callbacks.onConnect?.()
			}

			this.ws.onmessage = (event) => {
				try {
					// Handle empty or whitespace-only messages
					if (
						!event.data ||
						(typeof event.data === 'string' && event.data.trim() === '')
					) {
						console.log('RTDS: ⚠️ Received empty message, ignoring')
						return
					}

					// Handle PONG response
					if (event.data === 'PONG' || event.data === 'pong') {
						console.log('RTDS: ✅ Received PONG')
						return
					}

					// Parse JSON message
					if (typeof event.data === 'string') {
						// Check if string looks like JSON before parsing
						const trimmed = event.data.trim()
						if (trimmed.length === 0) {
							console.log('RTDS: ⚠️ Received empty string, ignoring')
							return
						}

						// Validate JSON structure (should start with { or [)
						if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
							console.log(
								'RTDS: ⚠️ Received non-JSON message, ignoring:',
								trimmed.substring(0, 50)
							)
							return
						}

						try {
							const data: RTDSMessage = JSON.parse(trimmed)
							this.handleMessage(data)
						} catch (parseError) {
							// Check if it's an incomplete JSON error
							if (parseError instanceof SyntaxError) {
								// Log but don't throw - might be a partial message
								console.warn(
									'RTDS: ⚠️ JSON parse error (possibly incomplete message):',
									parseError.message
								)
								console.warn('RTDS: Message data:', trimmed.substring(0, 100))
								// Don't call onError for parse errors - might be temporary
								return
							}
							throw parseError // Re-throw if it's a different error
						}
					} else {
						console.warn('RTDS: ⚠️ Received non-string message:', typeof event.data)
					}
				} catch (error) {
					// Only log critical errors, not parse errors (handled above)
					if (!(error instanceof SyntaxError)) {
						console.error(
							'RTDS: ❌ Error handling message:',
							error,
							'Data:',
							event.data
						)
						this.callbacks.onError?.(
							error instanceof Error ? error : new Error(String(error))
						)
					}
				}
			}

			this.ws.onerror = (error) => {
				console.error('RTDS: ❌ WebSocket error:', error)
				this.isConnecting = false
				this.isConnected = false

				const errorMessage =
					error instanceof Error ? error.message : 'RTDS WebSocket connection error'

				this.callbacks.onError?.(new Error(errorMessage))
			}

			this.ws.onclose = (event) => {
				console.log('RTDS: 🔌 WebSocket closed:', {
					code: event.code,
					reason: event.reason,
					wasClean: event.wasClean
				})

				this.isConnecting = false
				this.isConnected = false
				this.stopPing()

				this.callbacks.onDisconnect?.()

				// Attempt reconnect if enabled
				if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.reconnectAttempts++
					setTimeout(() => {
						if (this.shouldReconnect) {
							console.log(
								`RTDS: 🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
							)
							this.connect()
						}
					}, this.reconnectDelay)
				} else if (!this.shouldReconnect) {
					console.log('RTDS: ⏸️ Auto-reconnect disabled')
				} else {
					console.log(
						`RTDS: ⛔ Max reconnect attempts (${this.maxReconnectAttempts}) reached`
					)
				}
			}
		} catch (error) {
			this.isConnecting = false
			this.isConnected = false
			console.error('RTDS: Failed to create WebSocket:', error)
			this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
		}
	}

	/**
	 * Subscribe to crypto prices
	 */
	private subscribe(): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.warn('RTDS: ⚠️ WebSocket not ready for subscription')
			return
		}

		const topic = this.source === 'binance' ? 'crypto_prices' : 'crypto_prices_chainlink'
		const type = this.source === 'binance' ? 'update' : '*'

		let filters: string | undefined
		if (this.symbols.length > 0) {
			if (this.source === 'binance') {
				// Binance format: comma-separated lowercase (e.g., "solusdt,btcusdt")
				// Ensure symbols are in correct format (lowercase, no separator)
				filters = this.symbols
					.map((s) => s.toLowerCase().replace('/', '').replace('usd', 'usdt'))
					.filter((s) => s.length > 0)
					.join(',')

				// Only set filters if we have valid symbols
				if (!filters || filters.length === 0) {
					filters = undefined
				}
			} else {
				// Chainlink format: empty string for all, or JSON object for single symbol
				// According to docs, empty filters string gets all symbols
				if (this.symbols.length === 1) {
					filters = JSON.stringify({ symbol: this.symbols[0] })
				} else {
					// For multiple symbols or no symbols, use empty string to get all
					filters = ''
				}
			}
		}

		const subscription: any = {
			action: 'subscribe',
			subscriptions: [
				{
					topic,
					type
				}
			]
		}

		// Only add filters if they are defined and not empty (for Binance)
		// For Chainlink, always include filters (even if empty string)
		if (this.source === 'binance') {
			if (filters && filters.length > 0) {
				subscription.subscriptions[0].filters = filters
			}
		} else {
			// Chainlink: always include filters (empty string for all symbols)
			subscription.subscriptions[0].filters = filters !== undefined ? filters : ''
		}

		try {
			const message = JSON.stringify(subscription)
			console.log('RTDS: 📤 Sending subscription:', message)
			this.ws.send(message)
			console.log('RTDS: ✅ Subscription sent successfully')
		} catch (error) {
			console.error('RTDS: ❌ Failed to send subscription:', error)
			this.callbacks.onError?.(new Error('Failed to subscribe to crypto prices'))
		}
	}

	/**
	 * Unsubscribe from crypto prices
	 */
	private unsubscribe(): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			return
		}

		const topic = this.source === 'binance' ? 'crypto_prices' : 'crypto_prices_chainlink'
		const type = this.source === 'binance' ? 'update' : '*'

		const unsubscription = {
			action: 'unsubscribe',
			subscriptions: [
				{
					topic,
					type
				}
			]
		}

		try {
			this.ws.send(JSON.stringify(unsubscription))
			console.log('RTDS: ✅ Unsubscribed')
		} catch (error) {
			console.error('RTDS: ❌ Failed to unsubscribe:', error)
		}
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	private handleMessage(data: RTDSMessage | any): void {
		// Validate message structure
		if (!data || typeof data !== 'object') {
			console.warn('RTDS: ⚠️ Invalid message format:', data)
			return
		}

		// Check if this is a crypto price update
		if (
			(data.topic === 'crypto_prices' || data.topic === 'crypto_prices_chainlink') &&
			data.type === 'update' &&
			data.payload &&
			typeof data.payload === 'object'
		) {
			// Validate payload structure
			if (
				typeof data.payload.symbol === 'string' &&
				typeof data.payload.value === 'number' &&
				!isNaN(data.payload.value)
			) {
				const update: CryptoPriceUpdate = {
					symbol: data.payload.symbol,
					value: data.payload.value,
					timestamp: data.payload.timestamp || data.timestamp || Date.now()
				}

				// console.log('RTDS: 📊 Price update:', update)
				this.callbacks.onPriceUpdate?.(update)
			} else {
				console.warn('RTDS: ⚠️ Invalid payload structure:', data.payload)
			}
		} else {
			// Log other message types for debugging (but don't spam)
			if (process.env.NODE_ENV === 'development') {
				console.log('RTDS: 📨 Received non-price message:', {
					topic: data.topic,
					type: data.type
				})
			}
		}
	}

	/**
	 * Disconnect from the WebSocket
	 */
	disconnect(): void {
		console.log('RTDS: 🛑 Disconnecting...')

		this.shouldReconnect = false
		this.stopPing()

		if (this.ws) {
			// Unsubscribe before closing
			this.unsubscribe()

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

		this.isConnected = false
		this.isConnecting = false
		this.reconnectAttempts = 0

		this.callbacks.onDisconnect?.()
		console.log('RTDS: ✅ Disconnected')
	}

	/**
	 * Update symbols to subscribe to
	 */
	updateSymbols(symbols: string[]): void {
		// Check if symbols actually changed
		const symbolsChanged =
			symbols.length !== this.symbols.length || symbols.some((s, i) => s !== this.symbols[i])

		if (!symbolsChanged) {
			return // No change, skip update
		}

		this.symbols = symbols
		if (this.isConnected && this.ws) {
			// Unsubscribe and resubscribe with new symbols
			this.unsubscribe()
			setTimeout(() => {
				this.subscribe()
			}, 100)
		}
	}

	/**
	 * Update source (binance or chainlink)
	 */
	updateSource(source: CryptoPriceSource): void {
		if (this.source === source) {
			return // No change, skip update
		}

		this.source = source
		if (this.isConnected && this.ws) {
			// Unsubscribe from old source and subscribe to new one
			this.unsubscribe()
			setTimeout(() => {
				this.subscribe()
			}, 100)
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
				// console.log('RTDS: 📤 Sent PING')
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
