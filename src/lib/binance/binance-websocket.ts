/**
 * Direct Binance WebSocket Service
 * Connects directly to Binance WebSocket API
 * Documentation: https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams
 */

export interface BinanceTickerUpdate {
	symbol: string
	price: number
	timestamp: number
}

export interface BinanceTickerCallbacks {
	onTickerUpdate?: (update: BinanceTickerUpdate) => void
	onError?: (error: Error) => void
	onConnect?: () => void
	onDisconnect?: () => void
}

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/stream'

export class BinanceWebSocket {
	private ws: WebSocket | null = null
	private callbacks: BinanceTickerCallbacks = {}
	private reconnectAttempts = 0
	private maxReconnectAttempts = 5
	private reconnectDelay = 3000
	private isConnecting = false
	private isConnected = false
	private shouldReconnect = true
	private streams: string[] = []

	constructor(streams: string[] = [], callbacks: BinanceTickerCallbacks = {}) {
		this.streams = streams
		this.callbacks = callbacks
	}

	/**
	 * Connect to Binance WebSocket
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
			console.log('Binance WS: Already connecting or connected, skipping...')
			return
		}

		if (!force && !this.shouldReconnect) {
			console.log('Binance WS: Reconnect disabled, not connecting.')
			return
		}

		if (this.streams.length === 0) {
			console.warn('Binance WS: No streams to subscribe to')
			return
		}

		this.isConnecting = true

		// Build WebSocket URL with streams
		const streamsParam = this.streams.join('/')
		const wsUrl = `${BINANCE_WS_URL}?streams=${streamsParam}`

		console.log(`Binance WS: Connecting to ${wsUrl}`)
		console.log(`Binance WS: Streams: ${this.streams.join(', ')}`)

		try {
			this.ws = new WebSocket(wsUrl)

			this.ws.onopen = () => {
				console.log('Binance WS: ✅ WebSocket connected successfully')
				this.isConnecting = false
				this.isConnected = true
				this.reconnectAttempts = 0
				this.callbacks.onConnect?.()
			}

			this.ws.onmessage = (event) => {
				try {
					if (!event.data || (typeof event.data === 'string' && event.data.trim() === '')) {
						console.log('Binance WS: ⚠️ Received empty message, ignoring')
						return
					}

					if (typeof event.data === 'string') {
						const trimmed = event.data.trim()
						if (trimmed.length === 0) {
							console.log('Binance WS: ⚠️ Received empty string, ignoring')
							return
						}

						if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
							console.log(
								'Binance WS: ⚠️ Received non-JSON message, ignoring:',
								trimmed.substring(0, 50)
							)
							return
						}

						try {
							const data = JSON.parse(trimmed)
							this.handleMessage(data)
						} catch (parseError) {
							if (parseError instanceof SyntaxError) {
								console.warn(
									'Binance WS: ⚠️ JSON parse error (possibly incomplete message):',
									parseError.message
								)
								return
							}
							throw parseError
						}
					} else {
						console.warn('Binance WS: ⚠️ Received non-string message:', typeof event.data)
					}
				} catch (error) {
					if (!(error instanceof SyntaxError)) {
						console.error('Binance WS: ❌ Error handling message:', error, 'Data:', event.data)
						this.callbacks.onError?.(
							error instanceof Error ? error : new Error(String(error))
						)
					}
				}
			}

			this.ws.onerror = (error) => {
				console.error('Binance WS: ❌ WebSocket error:', error)
				this.isConnecting = false
				this.isConnected = false

				const errorMessage =
					error instanceof Error ? error.message : 'Binance WebSocket connection error'

				this.callbacks.onError?.(new Error(errorMessage))
			}

			this.ws.onclose = (event) => {
				console.log('Binance WS: 🔌 WebSocket closed:', {
					code: event.code,
					reason: event.reason,
					wasClean: event.wasClean
				})

				this.isConnecting = false
				this.isConnected = false

				this.callbacks.onDisconnect?.()

				// Attempt reconnect if enabled
				if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.reconnectAttempts++
					setTimeout(() => {
						if (this.shouldReconnect) {
							console.log(
								`Binance WS: 🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
							)
							this.connect()
						}
					}, this.reconnectDelay)
				} else if (!this.shouldReconnect) {
					console.log('Binance WS: ⏸️ Auto-reconnect disabled')
				} else {
					console.log(
						`Binance WS: ⛔ Max reconnect attempts (${this.maxReconnectAttempts}) reached`
					)
				}
			}
		} catch (error) {
			this.isConnecting = false
			this.isConnected = false
			console.error('Binance WS: Failed to create WebSocket:', error)
			this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
		}
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	private handleMessage(data: any): void {
		// Binance combined stream format:
		// {
		//   "stream": "btcusdt@ticker",
		//   "data": {
		//     "e": "24hrTicker",
		//     "E": 123456789,
		//     "s": "BTCUSDT",
		//     "c": "0.0025",
		//     ...
		//   }
		// }

		if (!data || typeof data !== 'object') {
			console.warn('Binance WS: ⚠️ Invalid message format:', data)
			return
		}

		// Check if this is a ticker update
		if (data.stream && data.stream.endsWith('@ticker') && data.data) {
			const tickerData = data.data

			// Validate ticker data structure
			if (
				tickerData.e === '24hrTicker' &&
				typeof tickerData.s === 'string' &&
				typeof tickerData.c === 'string'
			) {
				const price = parseFloat(tickerData.c)
				if (!isNaN(price) && price > 0) {
					const update: BinanceTickerUpdate = {
						symbol: tickerData.s.toLowerCase(), // e.g., "btcusdt"
						price: price,
						timestamp: tickerData.E || Date.now() // Event time
					}

					// console.log('Binance WS: 📊 Ticker update:', update)
					this.callbacks.onTickerUpdate?.(update)
				} else {
					console.warn('Binance WS: ⚠️ Invalid price in ticker data:', tickerData.c)
				}
			} else {
				console.warn('Binance WS: ⚠️ Invalid ticker data structure:', tickerData)
			}
		} else {
			// Log other message types for debugging
			if (process.env.NODE_ENV === 'development') {
				console.log('Binance WS: 📨 Received non-ticker message:', {
					stream: data.stream,
					type: data.data?.e
				})
			}
		}
	}

	/**
	 * Disconnect from the WebSocket
	 */
	disconnect(): void {
		console.log('Binance WS: 🛑 Disconnecting...')

		this.shouldReconnect = false

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

		this.isConnected = false
		this.isConnecting = false
		this.reconnectAttempts = 0

		this.callbacks.onDisconnect?.()
		console.log('Binance WS: ✅ Disconnected')
	}

	/**
	 * Update streams to subscribe to
	 */
	updateStreams(streams: string[]): void {
		// Check if streams actually changed
		const streamsChanged =
			streams.length !== this.streams.length || streams.some((s, i) => s !== this.streams[i])

		if (!streamsChanged) {
			return // No change, skip update
		}

		this.streams = streams

		// If connected, reconnect with new streams
		if (this.isConnected && this.ws) {
			this.disconnect()
			setTimeout(() => {
				this.connect()
			}, 100)
		}
		// If not connected, streams are updated and will be used on next connect()
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
