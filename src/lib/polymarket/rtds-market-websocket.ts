/**
 * Polymarket RTDS WebSocket for Market Data
 * Handles real-time market price data via RTDS WebSocket
 * Uses wss://ws-live-data.polymarket.com/ (same as crypto prices)
 */

export interface MarketPriceUpdate {
	market_id?: string
	condition_id?: string
	asset_id?: string
	token_id?: string
	price: number
	timestamp: number
	outcome?: string
}

export interface RTDSMarketMessage {
	topic: string
	type: string
	timestamp: number
	payload: any
}

export interface RTDSMarketCallbacks {
	onPriceUpdate?: (update: MarketPriceUpdate) => void
	onActivityUpdate?: (update: any) => void // For orders_matched and other activity
	onError?: (error: Error) => void
	onConnect?: () => void
	onDisconnect?: () => void
}

const RTDS_WS_URL = 'wss://ws-live-data.polymarket.com'
const PING_INTERVAL = 5000 // 5 seconds

export class RTDSMarketWebSocket {
	private ws: WebSocket | null = null
	private callbacks: RTDSMarketCallbacks = {}
	private pingInterval: number | null = null
	private reconnectAttempts = 0
	private maxReconnectAttempts = 5
	private reconnectDelay = 3000
	private isConnecting = false
	private isConnected = false
	private shouldReconnect = true
	private conditionIds: string[] = []
	private assetIds: string[] = []
	private eventSlugs: string[] = [] // Market slugs for activity subscription

	constructor(
		conditionIds: string[] = [],
		assetIds: string[] = [],
		eventSlugs: string[] = [],
		callbacks: RTDSMarketCallbacks = {}
	) {
		this.conditionIds = conditionIds
		this.assetIds = assetIds
		this.eventSlugs = eventSlugs
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
				if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
					this.ws.close(1000, 'Force reconnect')
				}
				this.ws = null
			}
		}

		if (!force && (this.isConnecting || this.isConnected)) {
			console.log('RTDS Market: Already connecting or connected, skipping...')
			return
		}

		if (!force && !this.shouldReconnect) {
			console.log('RTDS Market: Reconnect disabled, not connecting.')
			return
		}

		this.isConnecting = true

		console.log(`RTDS Market: Connecting to ${RTDS_WS_URL}`)
		console.log(`RTDS Market: Condition IDs: ${this.conditionIds.join(', ') || 'none'}`)
		console.log(`RTDS Market: Asset IDs: ${this.assetIds.join(', ') || 'none'}`)
		console.log(`RTDS Market: Event Slugs: ${this.eventSlugs.join(', ') || 'none'}`)

		try {
			this.ws = new WebSocket(RTDS_WS_URL)

			this.ws.onopen = () => {
				console.log('RTDS Market: ✅ WebSocket connected successfully')
				this.isConnecting = false
				this.isConnected = true
				this.reconnectAttempts = 0

				// Subscribe to market data
				this.subscribe()

				// Start ping interval
				this.startPing()

				this.callbacks.onConnect?.()
			}

			this.ws.onmessage = (event) => {
				try {
					// Handle empty or whitespace-only messages
					if (!event.data || (typeof event.data === 'string' && event.data.trim() === '')) {
						return
					}

					// Handle PONG response
					if (event.data === 'PONG' || event.data === 'pong') {
						return
					}

					// Parse JSON message
					if (typeof event.data === 'string') {
						const trimmed = event.data.trim()
						if (trimmed.length === 0) {
							return
						}

						// Validate JSON structure
						if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
							return
						}

						try {
							const data: RTDSMarketMessage = JSON.parse(trimmed)
							this.handleMessage(data)
						} catch (parseError) {
							if (parseError instanceof SyntaxError) {
								// Log but don't throw - might be a partial message
								return
							}
							throw parseError
						}
					}
				} catch (error) {
					if (!(error instanceof SyntaxError)) {
						console.error('RTDS Market: ❌ Error handling message:', error)
					}
				}
			}

			this.ws.onerror = (error) => {
				console.error('RTDS Market: ❌ WebSocket error:', error)
				this.isConnecting = false
				this.isConnected = false

				const errorMessage = error instanceof Error
					? error.message
					: 'RTDS Market WebSocket connection error'

				this.callbacks.onError?.(new Error(errorMessage))
			}

			this.ws.onclose = (event) => {
				console.log('RTDS Market: 🔌 WebSocket closed:', {
					code: event.code,
					reason: event.reason,
					wasClean: event.wasClean,
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
							console.log(`RTDS Market: 🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
							this.connect()
						}
					}, this.reconnectDelay)
				}
			}
		} catch (error) {
			this.isConnecting = false
			this.isConnected = false
			console.error('RTDS Market: Failed to create WebSocket:', error)
			this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
		}
	}

	/**
	 * Subscribe to market data
	 * Based on actual Polymarket website implementation
	 */
	private subscribe(): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.warn('RTDS Market: ⚠️ WebSocket not ready for subscription')
			return
		}

		const subscriptions: any[] = []

		// Primary subscription: activity topic with orders_matched (like Polymarket website)
		// This provides real-time price updates when orders are matched
		if (this.eventSlugs.length > 0) {
			this.eventSlugs.forEach((slug) => {
				subscriptions.push({
					topic: 'activity',
					type: 'orders_matched',
					filters: JSON.stringify({ event_slug: slug }),
				})
			})
		}

		// Fallback: Try market_prices topic with condition IDs
		// if (this.conditionIds.length > 0) {
		// 	subscriptions.push({
		// 		topic: 'market_prices',
		// 		type: '*',
		// 		filters: JSON.stringify({ condition_ids: this.conditionIds }),
		// 	})
		// }

		// Fallback: Try with asset IDs
		// if (this.assetIds.length > 0) {
		// 	subscriptions.push({
		// 		topic: 'market_prices',
		// 		type: '*',
		// 		filters: JSON.stringify({ asset_ids: this.assetIds }),
		// 	})
		// }

		if (this.conditionIds.length > 0) {
			subscriptions.push({
				topic: 'crypto_prices_chainlink',
				type: 'update',
				filters: '{"symbol":"btc/usd"}',
			})
		}

		// Send all subscriptions in one message (like Polymarket website does)
		if (subscriptions.length > 0) {
			const subscription = {
				action: 'subscribe',
				subscriptions: subscriptions,
			}

			try {
				const message = JSON.stringify(subscription)
				console.log('RTDS Market: 📤 Sending subscription:', message)
				this.ws.send(message)
				console.log('RTDS Market: ✅ Subscription sent successfully')
			} catch (error) {
				console.error('RTDS Market: ❌ Failed to send subscription:', error)
				this.callbacks.onError?.(new Error('Failed to subscribe to market data'))
			}
		} else {
			console.warn('RTDS Market: ⚠️ No subscriptions to send (no event slugs, condition IDs, or asset IDs)')
		}
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	private handleMessage(data: RTDSMarketMessage | any): void {
		// Validate message structure
		if (!data || typeof data !== 'object') {
			return
		}

		// Handle crypto_prices_chainlink topic - real-time crypto price updates
		if (data.topic === 'crypto_prices_chainlink' && data.type === 'update' && data.payload) {
			const payload = data.payload
			
			// Extract price from Chainlink crypto price payload
			// Common fields: price, value, lastPrice, price_usd
			const price = payload.price || payload.value || payload.lastPrice || payload.price_usd
console.log('price:', price, payload)
			const symbol = payload.symbol || payload.pair || payload.asset
			
			if (price !== undefined) {
				const update: MarketPriceUpdate = {
					asset_id: symbol,
					price: typeof price === 'number' ? price : parseFloat(String(price)),
					timestamp: payload.timestamp || data.timestamp || Date.now(),
					outcome: symbol,
				}

				// console.log('RTDS Market: 📊 Crypto price update (Chainlink):', update)
				this.callbacks.onPriceUpdate?.(update)
			} else {
				// Log full payload for debugging
				// console.log('RTDS Market: 📨 Crypto price message (Chainlink):', payload)
			}
			return
		}

		// Handle activity topic - orders_matched (primary source for real-time prices)
		if (data.topic === 'activity' && data.type === 'orders_matched' && data.payload) {
			const payload = data.payload
			
			// Extract price from matched order
			// The payload structure may vary, try different fields
			const price = payload.price || payload.matched_price || payload.execution_price
			const assetId = payload.asset_id || payload.token_id || payload.outcome_id
			const conditionId = payload.condition_id || payload.market_id
			
			if (price !== undefined && assetId) {
				const update: MarketPriceUpdate = {
					condition_id: conditionId,
					asset_id: assetId,
					token_id: assetId,
					price: typeof price === 'number' ? price : parseFloat(price),
					timestamp: payload.timestamp || data.timestamp || Date.now(),
					outcome: payload.outcome || payload.side,
				}

				console.log('RTDS Market: 📊 Order matched (price update):', update)
				this.callbacks.onPriceUpdate?.(update)
				this.callbacks.onActivityUpdate?.(payload)
			} else {
				// Log full payload for debugging
				console.log('RTDS Market: 📨 Activity message (orders_matched):', payload)
				this.callbacks.onActivityUpdate?.(payload)
			}
			return
		}

		// Check for market price updates from other topics
		if (
			(data.topic === 'market_prices' || data.topic === 'markets' || data.topic === 'ticker') &&
			data.payload &&
			typeof data.payload === 'object'
		) {
			const payload = data.payload

			// Try to extract price information
			if (typeof payload.price === 'number' || typeof payload.value === 'number') {
				const update: MarketPriceUpdate = {
					market_id: payload.market_id || payload.marketId,
					condition_id: payload.condition_id || payload.conditionId,
					asset_id: payload.asset_id || payload.assetId || payload.token_id || payload.tokenId,
					token_id: payload.token_id || payload.tokenId,
					price: payload.price || payload.value,
					timestamp: payload.timestamp || data.timestamp || Date.now(),
					outcome: payload.outcome,
				}

				console.log('RTDS Market: 📊 Price update:', update)
				this.callbacks.onPriceUpdate?.(update)
			}
		}

		// Log other message types for debugging
		if (process.env.NODE_ENV === 'development') {
			console.log('RTDS Market: 📨 Received message:', {
				topic: data.topic,
				type: data.type,
				hasPayload: !!data.payload,
			})
		}
	}

	/**
	 * Disconnect from the WebSocket
	 */
	disconnect(): void {
		console.log('RTDS Market: 🛑 Disconnecting...')

		this.shouldReconnect = false
		this.stopPing()

		// Cancel any pending subscription updates
		if (this.updateTimeout !== null) {
			clearTimeout(this.updateTimeout)
			this.updateTimeout = null
		}

		if (this.ws) {
			this.ws.onopen = null
			this.ws.onmessage = null
			this.ws.onerror = null
			this.ws.onclose = null

			if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
				this.ws.close(1000, 'Manual disconnect')
			}
			this.ws = null
		}

		this.isConnected = false
		this.isConnecting = false
		this.reconnectAttempts = 0

		this.callbacks.onDisconnect?.()
		console.log('RTDS Market: ✅ Disconnected')
	}

	private updateTimeout: number | null = null

	/**
	 * Debounced subscription update - prevents multiple rapid subscriptions
	 */
	private scheduleSubscriptionUpdate(): void {
		// Clear any pending update
		if (this.updateTimeout !== null) {
			clearTimeout(this.updateTimeout)
		}

		// Schedule update after a short delay
		this.updateTimeout = window.setTimeout(() => {
			if (this.isConnected && this.ws) {
				this.unsubscribe()
				setTimeout(() => {
					this.subscribe()
				}, 100)
			}
			this.updateTimeout = null
		}, 200) // 200ms debounce
	}

	/**
	 * Update condition IDs to subscribe to
	 */
	updateConditionIds(conditionIds: string[]): void {
		// Check if values actually changed
		const changed = 
			conditionIds.length !== this.conditionIds.length ||
			conditionIds.some((id, i) => id !== this.conditionIds[i])
		
		if (!changed) {
			return // No change, skip update
		}

		this.conditionIds = conditionIds
		if (this.isConnected && this.ws) {
			this.scheduleSubscriptionUpdate()
		}
	}

	/**
	 * Update asset IDs to subscribe to
	 */
	updateAssetIds(assetIds: string[]): void {
		// Check if values actually changed
		const changed = 
			assetIds.length !== this.assetIds.length ||
			assetIds.some((id, i) => id !== this.assetIds[i])
		
		if (!changed) {
			return // No change, skip update
		}

		this.assetIds = assetIds
		if (this.isConnected && this.ws) {
			this.scheduleSubscriptionUpdate()
		}
	}

	/**
	 * Update event slugs to subscribe to
	 */
	updateEventSlugs(eventSlugs: string[]): void {
		// Check if values actually changed
		const changed = 
			eventSlugs.length !== this.eventSlugs.length ||
			eventSlugs.some((slug, i) => slug !== this.eventSlugs[i])
		
		if (!changed) {
			return // No change, skip update
		}

		this.eventSlugs = eventSlugs
		if (this.isConnected && this.ws) {
			this.scheduleSubscriptionUpdate()
		}
	}

	/**
	 * Unsubscribe from all topics
	 */
	private unsubscribe(): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			return
		}

		const subscriptions: any[] = []

		// Unsubscribe from activity topic
		if (this.eventSlugs.length > 0) {
			this.eventSlugs.forEach((slug) => {
				subscriptions.push({
					topic: 'activity',
					type: 'orders_matched',
					filters: JSON.stringify({ event_slug: slug }),
				})
			})
		}

		// Unsubscribe from other topics
		subscriptions.push(
			{ topic: 'market_prices', type: '*' },
			{ topic: 'markets', type: '*' },
			{ topic: 'ticker', type: '*' }
		)

		try {
			const unsubscription = {
				action: 'unsubscribe',
				subscriptions: subscriptions,
			}
			this.ws.send(JSON.stringify(unsubscription))
			console.log('RTDS Market: ✅ Unsubscribed')
		} catch (error) {
			console.error('RTDS Market: ❌ Failed to unsubscribe:', error)
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

