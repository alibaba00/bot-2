/**
 * Polymarket WebSocket Service
 * Handles real-time market data via WebSocket
 */

export interface WebSocketPriceUpdate {
	asset_id: string
	price: number
	timestamp: number
	side?: 'bid' | 'ask'
	volume?: number
}

export interface WebSocketOrderBookUpdate {
	asset_id: string
	bids: Array<{ price: number; size: number }>
	asks: Array<{ price: number; size: number }>
	timestamp: number
}

export type WebSocketMessage = WebSocketPriceUpdate | WebSocketOrderBookUpdate | any

export interface WebSocketCallbacks {
	onPriceUpdate?: (update: WebSocketPriceUpdate) => void
	onOrderBookUpdate?: (update: WebSocketOrderBookUpdate) => void
	onError?: (error: Error) => void
	onConnect?: () => void
	onDisconnect?: () => void
}

// Alternative WebSocket URLs - try both in case one doesn't work
// According to CLOB docs: wss://ws-subscriptions-clob.polymarket.com/ws/
export const WS_URLS = [
	'wss://ws-subscriptions-clob.polymarket.com/ws/', // Official URL with trailing slash
	'wss://ws-subscriptions-clob.polymarket.com/ws', // Without trailing slash
	'wss://ws-subscriptions-clob.polymarket.com', // Base URL
	'wss://clob.polymarket.com/ws', // Alternative
	'wss://clob.polymarket.com', // Alternative base
]
const PING_INTERVAL = 10000 // 10 seconds

export class PolymarketWebSocket {
	private ws: WebSocket | null = null
	private assetIds: string[] = []
	private callbacks: WebSocketCallbacks = {}
	private pingInterval: number | null = null
	private reconnectAttempts = 0
	private maxReconnectAttempts = 5
	private reconnectDelay = 3000
	private isConnecting = false
	private isConnected = false
	private shouldReconnect = true // Flag to control auto-reconnect
	private wsUrl: string // The specific URL for this instance
	private currentUrlIndex: number = 0 // Track which URL we're trying

	constructor(assetIds: string[], callbacks: WebSocketCallbacks = {}, wsUrl?: string) {
		this.assetIds = assetIds
		this.callbacks = callbacks
		// Use provided URL or default to first URL
		if (wsUrl) {
			this.wsUrl = wsUrl
			// Find the index of the provided URL
			this.currentUrlIndex = WS_URLS.indexOf(wsUrl)
			if (this.currentUrlIndex === -1) {
				this.currentUrlIndex = 0
			}
		} else {
			this.wsUrl = WS_URLS[0]
			this.currentUrlIndex = 0
		}
	}

	/**
	 * Connect to the WebSocket
	 */
	connect(force = false): void {
		// If force is true, reset connection state first to allow reconnection
		if (force) {
			this.shouldReconnect = true
			this.reconnectAttempts = 0
			// Reset connection state to allow reconnection
			this.isConnecting = false
			this.isConnected = false
			// Also close any existing connection
			if (this.ws) {
				this.ws.onopen = null
				this.ws.onmessage = null
				this.ws.onerror = null
				this.ws.onclose = null
				if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
					this.ws.close(1000, 'Force reconnect')
				}
				this.ws = null
			}
		}

		// Check if already connecting or connected (only if not forcing)
		if (!force && (this.isConnecting || this.isConnected)) {
			console.log('Already connecting or connected, skipping...')
			return
		}

		// Check if we should reconnect (only block if not forced and reconnect is disabled)
		if (!force && !this.shouldReconnect) {
			console.log('Reconnect disabled, not connecting. Use connect(true) to force connection.')
			return
		}

		// Enable auto-reconnect when connecting (unless explicitly disabled)
		// But only if not forcing (force means manual start, user controls reconnect)
		if (!force && !this.shouldReconnect) {
			this.shouldReconnect = true
		}
		
		this.isConnecting = true
		
		// Use the base URL directly (no /ws/market path needed)
		// The subscription message determines the channel
		const url = this.wsUrl
		console.log(`🔌 Using WebSocket URL: ${url}`)

		try {
			console.log(`Connecting to WebSocket: ${url}`)
			console.log(`Asset IDs to subscribe:`, this.assetIds)
			
			this.ws = new WebSocket(url)

			this.ws.onopen = () => {
				console.log('✅ WebSocket connected successfully')
				this.isConnecting = false
				this.isConnected = true
				this.reconnectAttempts = 0

				// Subscribe to market channel using new format
				if (this.ws && this.assetIds.length > 0) {
					// Wait a small delay to ensure connection is fully established
					setTimeout(() => {
						if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
							console.warn('⚠️ WebSocket not ready for subscription')
							return
						}
						
						// Try multiple subscription formats sequentially
						// According to CLOB WebSocket docs: type should be "MARKET" (uppercase) and assets_ids (with 's')
						const formats = [
							// Format 1: Official CLOB format (from docs)
							{
								type: 'MARKET',
								assets_ids: this.assetIds,
							},
							// Format 2: With asset_ids (without 's')
							{
								type: 'MARKET',
								asset_ids: this.assetIds,
							},
							// Format 3: Lowercase type
							{
								type: 'market',
								assets_ids: this.assetIds,
							},
							// Format 4: Subscribe format
							{
								type: 'subscribe',
								channel: 'market',
								assets_ids: this.assetIds,
							},
							// Format 5: With markets array
							{
								type: 'subscribe',
								channel: 'market',
								markets: this.assetIds,
							},
						]
						
						// Try formats sequentially
						const tryFormat = (index: number) => {
							if (index >= formats.length) {
								console.error('❌ All subscription formats failed')
								this.callbacks.onError?.(new Error('Failed to send subscription with any format'))
								return
							}
							
							if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
								console.warn('⚠️ WebSocket not ready, cannot try format')
								return
							}
							
							try {
								const subscription = formats[index]
								const subscriptionMessage = JSON.stringify(subscription)
								console.log(`📤 Trying subscription format ${index + 1}/${formats.length}:`, subscriptionMessage)
								
								this.ws.send(subscriptionMessage)
								console.log(`✅ Subscription format ${index + 1} sent successfully`)
								
								// Wait longer to see if connection stays open and we receive data
								setTimeout(() => {
									if (this.ws && this.ws.readyState === WebSocket.OPEN) {
										console.log(`✅ Format ${index + 1} appears to be working (connection still open)`)
										// Stop trying other formats if this one works
										return
									} else {
										console.warn(`⚠️ Format ${index + 1} failed (connection closed), trying next format...`)
										// Try next format if this one didn't work
										if (index + 1 < formats.length) {
											// Only try next format if connection was closed due to this subscription
											// Don't try if connection is already closed for other reasons
											tryFormat(index + 1)
										}
									}
								}, 1000) // Wait longer (1 second) to see if connection stays open
							} catch (sendError) {
								console.error(`❌ Failed to send subscription format ${index + 1}:`, sendError)
								// Try next format
								if (index + 1 < formats.length) {
									tryFormat(index + 1)
								}
							}
						}
						
						// Start with first format
						tryFormat(0)
					}, 100) // Small delay to ensure connection is stable
				} else {
					console.warn('⚠️ No asset IDs available for subscription')
				}

				// Start ping interval
				this.startPing()

				this.callbacks.onConnect?.()
			}

			this.ws.onmessage = (event) => {
				try {
					console.log('📨 WebSocket message received:', {
						type: typeof event.data,
						length: event.data?.length,
						data: event.data,
						readyState: this.ws?.readyState
					})
					
					// Handle PONG response
					if (event.data === 'PONG' || event.data === 'pong') {
						console.log('✅ Received PONG')
						return
					}

					// Handle string messages
					if (typeof event.data === 'string') {
						try {
							const data = JSON.parse(event.data)
							console.log('📦 Parsed message data:', data)
							
							// Check if it's an error response from server
							if (data.error || data.message) {
								console.error('❌ Server error response:', data)
								this.callbacks.onError?.(new Error(data.error || data.message || 'Server error'))
								// Don't reconnect on server errors - likely format issue
								if (data.error && (data.error.includes('invalid') || data.error.includes('format'))) {
									this.shouldReconnect = false
								}
								return
							}
							
							this.handleMessage(data)
						} catch (parseError) {
							// If it's not JSON, it might be a plain text message
							console.log('📝 Received plain text message:', event.data)
							// Check if it's an error message
							if (event.data.toLowerCase().includes('error') || event.data.toLowerCase().includes('invalid')) {
								console.error('❌ Server error message:', event.data)
								this.callbacks.onError?.(new Error(`Server error: ${event.data}`))
								// Stop reconnecting on format errors
								if (event.data.toLowerCase().includes('invalid') || event.data.toLowerCase().includes('format')) {
									this.shouldReconnect = false
								}
							}
						}
					} else {
						// Handle binary or other formats
						console.warn('⚠️ Received non-string WebSocket message:', event.data)
					}
				} catch (error) {
					console.error('❌ Error handling WebSocket message:', error, 'Data:', event.data)
				}
			}

			this.ws.onerror = (error) => {
				console.error('❌ WebSocket error:', error)
				console.error('WebSocket readyState:', this.ws?.readyState)
				console.error('WebSocket URL:', url)
				console.error('Asset IDs:', this.assetIds)
				console.error('Asset IDs count:', this.assetIds.length)
				console.error('Asset IDs type:', typeof this.assetIds[0])
				
				this.isConnecting = false
				this.isConnected = false
				
				// Check if it's a 404 error (handshake failure)
				// This usually means the URL is wrong
				const errorMessage = error instanceof Error 
					? error.message 
					: 'WebSocket connection error. Check console for details.'
				
				if (errorMessage.includes('404') || errorMessage.includes('Unexpected response code: 404')) {
					console.error('❌ 404 Error - WebSocket endpoint not found.')
					
					// Check if we should try next URL (only if reconnect is enabled)
					if (!this.shouldReconnect) {
						console.log('⏸️ Reconnect disabled, not trying next URL')
						return
					}
					
					// Try next URL if available
					if (this.currentUrlIndex < WS_URLS.length - 1) {
						this.currentUrlIndex++
						this.wsUrl = WS_URLS[this.currentUrlIndex]
						console.log(`🔄 Switching to URL ${this.currentUrlIndex + 1}/${WS_URLS.length}: ${this.wsUrl}`)
						
						// Try connecting with new URL after a short delay
						const reconnectTimeout = setTimeout(() => {
							// Double-check shouldReconnect before connecting
							if (this.shouldReconnect) {
								this.reconnectAttempts = 0 // Reset attempts for new URL
								this.connect(true)
							} else {
								console.log('⏸️ Reconnect cancelled before URL switch')
							}
						}, 1000)
						// Store timeout to allow cancellation
						;(this as any).urlSwitchTimeout = reconnectTimeout
					} else {
						// All URLs tried, stop reconnecting
						console.error('⛔ All WebSocket URLs failed with 404. Stopping reconnect.')
						this.shouldReconnect = false
						this.callbacks.onError?.(new Error('All WebSocket endpoints returned 404. Check URL configuration.'))
					}
					return
				}
				
				// Add more context to error message
				const detailedError = new Error(
					`${errorMessage}\nURL: ${url}\nAsset IDs: ${this.assetIds.length}`
				)
				
				this.callbacks.onError?.(detailedError)
			}

			this.ws.onclose = (event) => {
				const closeInfo = {
					code: event.code,
					reason: event.reason,
					wasClean: event.wasClean,
					shouldReconnect: this.shouldReconnect,
					reconnectAttempts: this.reconnectAttempts,
					currentUrl: this.wsUrl,
					readyState: this.ws?.readyState
				}
				
				console.log('🔌 WebSocket onclose event:', closeInfo)
				
				// CRITICAL: Check shouldReconnect FIRST before doing anything
				// This prevents reconnect if disconnect() was called (which sets shouldReconnect = false)
				if (!this.shouldReconnect) {
					console.log('⏸️ onclose triggered but reconnect disabled, ignoring reconnect')
					// Still reset state and call callbacks
					this.isConnecting = false
					this.isConnected = false
					this.stopPing()
					this.callbacks.onDisconnect?.()
					return
				}
				
				// Reset connection state immediately
				this.isConnecting = false
				this.isConnected = false
				this.stopPing()
				
				// Log specific error codes
				if (event.code === 1006) {
					console.error('❌ Abnormal closure (1006). Possible causes:')
					console.error('  - Invalid subscription format')
					console.error('  - Server rejected the connection')
					console.error('  - Network connectivity issues')
					console.error('  - CORS or firewall blocking')
					console.error('  - Invalid WebSocket URL (404 during handshake)')
					
					// If we get 1006 immediately after connection, it's likely a URL or format issue
					// Don't reconnect endlessly - stop after a few attempts
					if (this.reconnectAttempts >= 2) {
						console.error('⛔ Too many 1006 errors - likely URL or subscription format issue. Stopping reconnect.')
						this.shouldReconnect = false
						this.callbacks.onError?.(new Error('Connection closed with 1006 error - check WebSocket URL and subscription format'))
					}
				} else if (event.code === 1000) {
					console.log('✅ Normal closure')
				} else {
					console.warn(`⚠️ Closure code: ${event.code} - ${event.reason || 'No reason provided'}`)
				}
				
				this.callbacks.onDisconnect?.()

				// Double-check shouldReconnect before attempting reconnect
				// (it might have been disabled by disconnect() call or too many 1006 errors)
				if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.reconnectAttempts++
					
					// Increase delay for repeated failures
					const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 3)
					
					const reconnectTimeout = setTimeout(() => {
						// Triple-check shouldReconnect before actually reconnecting
						if (this.shouldReconnect) {
							console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
							this.connect()
						} else {
							console.log('⏸️ Reconnect cancelled (shouldReconnect = false)')
						}
					}, delay)
					// Store timeout to allow cancellation
					;(this as any).reconnectTimeout = reconnectTimeout
				} else if (!this.shouldReconnect) {
					console.log('⏸️ Auto-reconnect disabled, WebSocket will not reconnect')
				} else {
					console.log(`⛔ Max reconnect attempts (${this.maxReconnectAttempts}) reached`)
				}
			}
		} catch (error) {
			this.isConnecting = false
			this.isConnected = false
			console.error('Failed to create WebSocket:', error)
			this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
		}
	}

	/**
	 * Disconnect from the WebSocket
	 */
	disconnect(): void {
		console.log('🛑 Disconnecting WebSocket...')
		
		// CRITICAL: Disable auto-reconnect FIRST before anything else
		this.shouldReconnect = false
		
		// Cancel any pending reconnect attempts IMMEDIATELY
		if ((this as any).reconnectTimeout) {
			clearTimeout((this as any).reconnectTimeout)
			;(this as any).reconnectTimeout = null
			console.log('✅ Cancelled pending reconnect')
		}
		
		// Cancel any pending URL switch attempts
		if ((this as any).urlSwitchTimeout) {
			clearTimeout((this as any).urlSwitchTimeout)
			;(this as any).urlSwitchTimeout = null
			console.log('✅ Cancelled pending URL switch')
		}
		
		// Stop ping interval
		this.stopPing()
		
		// Reset connection state BEFORE closing to prevent onclose from triggering reconnect
		this.isConnected = false
		this.isConnecting = false
		this.reconnectAttempts = 0
		
		if (this.ws) {
			// Remove all event listeners to prevent callbacks (especially onclose)
			this.ws.onopen = null
			this.ws.onmessage = null
			this.ws.onerror = null
			// IMPORTANT: Set onclose to null BEFORE closing to prevent reconnect
			this.ws.onclose = null
			
			// Close the connection
			if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
				this.ws.close(1000, 'Manual disconnect')
			}
			this.ws = null
		}
		
		// Call disconnect callback
		this.callbacks.onDisconnect?.()
		
		console.log('✅ WebSocket disconnected and cleaned up')
	}

	/**
	 * Update asset IDs to subscribe to
	 */
	updateAssetIds(assetIds: string[]): void {
		this.assetIds = assetIds
		if (this.isConnected && this.ws) {
			// Resubscribe with new asset IDs using new format
			const subscription = {
				type: 'subscribe',
				channel: 'market',
				markets: this.assetIds,
			}
			try {
				this.ws.send(JSON.stringify(subscription))
				console.log('Resubscribed with new asset IDs')
			} catch (error) {
				console.error('Failed to resubscribe:', error)
				// Try old format as fallback
				try {
					const oldSubscription = {
						assets_ids: this.assetIds,
						type: 'market',
					}
					this.ws.send(JSON.stringify(oldSubscription))
				} catch (oldError) {
					console.error('Failed to resubscribe with old format:', oldError)
				}
			}
		}
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	private handleMessage(data: any): void {
		// Log raw message for debugging (can be removed in production)
		if (process.env.NODE_ENV === 'development') {
			console.log('📨 WebSocket message received:', data)
		}

		// Handle array of updates
		if (Array.isArray(data)) {
			data.forEach((item) => this.handleMessage(item))
			return
		}

		// Handle new message format with 'update' type
		if (data.type === 'update' && data.data) {
			const updateData = data.data
			// Process the update data
			if (updateData.price !== undefined || updateData.bids || updateData.asks) {
				const assetId = updateData.asset_id || updateData.assetId || updateData.token_id || updateData.tokenId || updateData.market || ''
				if (assetId) {
					if (updateData.price !== undefined) {
						const update: WebSocketPriceUpdate = {
							asset_id: assetId,
							price: parseFloat(updateData.price || '0'),
							timestamp: updateData.timestamp || Date.now(),
							side: updateData.side,
							volume: updateData.volume ? parseFloat(updateData.volume) : undefined,
						}
						this.callbacks.onPriceUpdate?.(update)
					}
					if (updateData.bids && updateData.asks) {
						const update: WebSocketOrderBookUpdate = {
							asset_id: assetId,
							bids: updateData.bids || [],
							asks: updateData.asks || [],
							timestamp: updateData.timestamp || Date.now(),
						}
						this.callbacks.onOrderBookUpdate?.(update)
					}
				}
			}
			return
		}

		// Handle different message types
		if (data.type === 'price' || data.price !== undefined) {
			const assetId = data.asset_id || data.assetId || data.token_id || data.tokenId || ''
			if (assetId) {
				const update: WebSocketPriceUpdate = {
					asset_id: assetId,
					price: parseFloat(data.price || '0'),
					timestamp: data.timestamp || Date.now(),
					side: data.side,
					volume: data.volume ? parseFloat(data.volume) : undefined,
				}
				this.callbacks.onPriceUpdate?.(update)
			}
		} else if (data.type === 'orderbook' || (data.bids && data.asks)) {
			const assetId = data.asset_id || data.assetId || data.token_id || data.tokenId || ''
			if (assetId) {
				const update: WebSocketOrderBookUpdate = {
					asset_id: assetId,
					bids: data.bids || [],
					asks: data.asks || [],
					timestamp: data.timestamp || Date.now(),
				}
				this.callbacks.onOrderBookUpdate?.(update)
			}
		} else {
			// Try to extract price information from various message formats
			const assetId = data.asset_id || data.assetId || data.token_id || data.tokenId || ''
			if (assetId) {
				// Look for price in different possible fields
				const price = data.price || data.last_price || data.mid_price || data.best_bid || data.best_ask || data.lastPrice || data.midPrice
				if (price !== undefined && price !== null) {
					const update: WebSocketPriceUpdate = {
						asset_id: assetId,
						price: parseFloat(price),
						timestamp: data.timestamp || Date.now(),
					}
					this.callbacks.onPriceUpdate?.(update)
				}
			}
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

