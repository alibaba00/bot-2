/**
 * Order Management Service
 * Handles order placement, cancellation, and status queries
 */

import { getOrInitializeClient } from './client'
import { fetchMarket } from './markets'
import type { Order, PlaceOrderParams, PlaceOrderResponse } from './types'
import { db } from '../db'
import type { OrderRecord } from '../db'

// These will be loaded dynamically from the CLOB client
let SideEnum: any = null
let OrderTypeEnum: any = null

async function loadEnums() {
	if (SideEnum && OrderTypeEnum) return

	const isElectron =
		typeof window !== 'undefined' &&
		(window as any).navigator?.userAgent?.includes('Electron') &&
		(window as any).require

	if (isElectron) {
		// Use require() in Electron for CommonJS modules
		const nodeRequire = (window as any).require
		const clobModule = nodeRequire('@polymarket/clob-client')
		SideEnum = clobModule.Side
		OrderTypeEnum = clobModule.OrderType
	} else {
		// Fallback to import for non-Electron environments
		const clobModule = await import('@polymarket/clob-client')
		SideEnum = clobModule.Side
		OrderTypeEnum = clobModule.OrderType
	}
}

/**
 * Place a new order
 */
// To create a market order without specifying a price, you can omit the 'price' field or set it to null/undefined in your PlaceOrderParams,
// depending on what the CLOB client expects for a market order.
// Here is a version of the function header and comment specifying this behavior.

/**
 * Places an order; to create a market order, set price = 1 for buy or price = 0 for sell.
 * Some CLOB APIs require a price value even for market orders.
 * Example:
 *  - Market buy:     placeOrder({ ..., side: 'buy', price: 1, ... })
 *  - Market sell:    placeOrder({ ..., side: 'sell', price: 0, ... })
 */
// To create a market buy order *without specifying a price*, simply omit the 'price' field from params (do not set to 0 or 1).
// For example: placeOrder({ marketId, quantity, side: 'buy', outcome, outcomeId })
export async function placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResponse> {
	// If you want to create a market order (no limit price), pass params.price = undefined or simply omit 'price' in the params.
	// Example:
	// placeOrder({ marketId, quantity, side, outcome, outcomeId }) // without price
	// Or:
	// placeOrder({ marketId, price: undefined, quantity, side, outcome, outcomeId })

	try {
		const client = await getOrInitializeClient()

		// Load enums if needed
		await loadEnums()

		let outcomeTokenId = params.outcomeId
		let marketData: any | null = null

		if (!outcomeTokenId) {
			// Fetch market to resolve outcome token id
			const market = await fetchMarket(params.marketId)
			marketData = market?.sourceData || null

			if (!market) {
				throw new Error(`Market not found: ${params.marketId}`)
			}

			const outcome = market.outcomes.find(
				(o) => o.title.toUpperCase() === params.outcome.toUpperCase()
			)

			if (!outcome) {
				throw new Error(`Outcome not found: ${params.outcome}`)
			}

			outcomeTokenId = outcome.id
		}

		// Resolve tickSize/negRisk for createAndPostOrder
		let tickSize: string | undefined
		let negRisk: boolean | undefined

		try {
			const clobMarket = await client.getMarket(params.marketId)
			tickSize =
				typeof clobMarket?.tickSize === 'number' || typeof clobMarket?.tickSize === 'string'
					? String(clobMarket.tickSize)
					: typeof clobMarket?.orderPriceMinTickSize === 'number' ||
						  typeof clobMarket?.orderPriceMinTickSize === 'string'
						? String(clobMarket.orderPriceMinTickSize)
						: undefined
			negRisk = typeof clobMarket?.negRisk === 'boolean' ? clobMarket.negRisk : undefined
		} catch {
			// Ignore and fall back to gamma data if available
		}

		if ((!tickSize || typeof negRisk !== 'boolean') && marketData) {
			if (!tickSize && marketData?.orderPriceMinTickSize) {
				tickSize = String(marketData.orderPriceMinTickSize)
			}
			if (typeof negRisk !== 'boolean' && typeof marketData?.negRisk === 'boolean') {
				negRisk = marketData.negRisk
			}
		}

		const marketParams: Record<string, any> = {}
		if (tickSize) marketParams.tickSize = tickSize
		if (typeof negRisk === 'boolean') marketParams.negRisk = negRisk

		// Create order using CLOB client
		const userOrder = {
			tokenID: outcomeTokenId,
			price: params.price,
			size: params.quantity,
			side: params.side === 'BUY' ? SideEnum.BUY : SideEnum.SELL
		}

		// Create and post the order
		const orderType = OrderTypeEnum?.GTC ?? 'GTC'
		const result = await client.createAndPostOrder(userOrder, marketParams, orderType, false)

		if (result?.error || result?.status >= 400) {
			const message =
				result?.error ||
				result?.data?.error ||
				`Order rejected with status ${result?.status ?? 'unknown'}`
			throw new Error(message)
		}

		const resolvedOrderId =
			result?.order_id ||
			result?.orderID ||
			result?.id ||
			result?.data?.order_id ||
			result?.data?.orderID ||
			result?.data?.id ||
			null

		if (!resolvedOrderId) {
			console.warn('Order submission returned no order id. Using fallback id.', result)
		}

		// Store order in database
		const order: Order = {
			id: resolvedOrderId || String(Date.now()),
			marketId: params.marketId,
			outcome: params.outcome,
			side: params.side,
			price: params.price,
			quantity: params.quantity,
			status: 'PENDING',
			createdAt: new Date().toISOString(),
			remainingQuantity: params.quantity
		}

		await saveOrder(order)

		return {
			orderId: order.id,
			status: 'PENDING',
			message: 'Order placed successfully'
		}
	} catch (error) {
		console.error('Error placing order:', error)
		throw error
	}
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string): Promise<any> {
	console.log('cancelOrder ...', orderId);
	try {
		const client = await getOrInitializeClient()

		// Try to get order from database (optional)
		const orderRecord = await db.orders.get(orderId)
		if (!orderRecord) {
			console.warn(`Order not found in local DB, cancelling by id: ${orderId}`)
		}

		// Cancel using CLOB client
		// Note: The actual implementation depends on how orders are stored
		// For now, we'll use cancelOrder with order payload
		const response = await client.cancelOrder({
			orderID: orderId
		})

		// Update order status in database if it exists
		if (orderRecord) {
			await db.orders.update(orderId, {
				status: 'CANCELLED',
				updatedAt: new Date().toISOString()
			})
		}

		return response
	} catch (error) {
		console.error('Error cancelling order:', error)
		throw error
	}
}

/**
 * Cancel all orders
 */
export async function cancelAllOrders(): Promise<void> {
	try {
		const client = await getOrInitializeClient()
		await client.cancelAll()

		// Update all open orders in database
		await db.orders.where('status').anyOf(['PENDING', 'OPEN']).modify({
			status: 'CANCELLED',
			updatedAt: new Date().toISOString()
		})
	} catch (error) {
		console.error('Error cancelling all orders:', error)
		throw error
	}
}

/**
 * Get open orders
 */
export async function getOpenOrders(): Promise<Order[]> {
	try {
		const client = await getOrInitializeClient()
		const response = await client.getOpenOrders()

		console.log('Open orders response:', response)
		console.log('Open orders response type:', typeof response)
		console.log('Open orders response keys:', Object.keys(response || {}))

		// Handle pagination response - check different possible response structures
		const ordersData =
			response.data ||
			response.results ||
			response.orders ||
			(Array.isArray(response) ? response : [])
		console.log('Orders data extracted:', ordersData.length, 'orders')

		// Transform API response to our Order type
		const orders: Order[] = ordersData.map((o: any, index: number) => {
			console.log(`Parsing order ${index}:`, {
				raw: o,
				allKeys: Object.keys(o || {}),
				price: o.price,
				size: o.size,
				filled_size: o.filled_size,
				remaining_size: o.remaining_size,
				side: o.side
			})

			// Prices and sizes might be strings with decimals, need to parse correctly
			// Try multiple possible field names for price
			const price =
				typeof o.price === 'string'
					? parseFloat(o.price)
					: typeof o.price === 'number'
						? o.price
						: typeof o.price_raw === 'string'
							? parseFloat(o.price_raw)
							: typeof o.price_raw === 'number'
								? o.price_raw
								: 0

			// Try multiple possible field names for size/quantity
			// NOTE: Polymarket API uses 'original_size' for the original order size
			let size = 0
			if (typeof o.original_size === 'string') {
				size = parseFloat(o.original_size)
			} else if (typeof o.original_size === 'number') {
				size = o.original_size
			} else if (typeof o.size === 'string') {
				size = parseFloat(o.size)
			} else if (typeof o.size === 'number') {
				size = o.size
			} else if (typeof o.quantity === 'string') {
				size = parseFloat(o.quantity)
			} else if (typeof o.quantity === 'number') {
				size = o.quantity
			} else if (typeof o.amount === 'string') {
				size = parseFloat(o.amount)
			} else if (typeof o.amount === 'number') {
				size = o.amount
			} else if (typeof o.total_size === 'string') {
				size = parseFloat(o.total_size)
			} else if (typeof o.total_size === 'number') {
				size = o.total_size
			}

			// Try multiple possible field names for filled size
			// NOTE: Polymarket API uses 'size_matched' for the filled/matched size
			let filledSize = 0
			if (typeof o.size_matched === 'string') {
				filledSize = parseFloat(o.size_matched)
			} else if (typeof o.size_matched === 'number') {
				filledSize = o.size_matched
			} else if (typeof o.filled_size === 'string') {
				filledSize = parseFloat(o.filled_size)
			} else if (typeof o.filled_size === 'number') {
				filledSize = o.filled_size
			} else if (typeof o.filledSize === 'string') {
				filledSize = parseFloat(o.filledSize)
			} else if (typeof o.filledSize === 'number') {
				filledSize = o.filledSize
			} else if (typeof o.filled === 'string') {
				filledSize = parseFloat(o.filled)
			} else if (typeof o.filled === 'number') {
				filledSize = o.filled
			}

			// Calculate remaining size: original_size - size_matched
			// Try multiple possible field names for remaining size, otherwise calculate it
			let remainingSize = 0
			if (typeof o.remaining_size === 'string') {
				remainingSize = parseFloat(o.remaining_size)
			} else if (typeof o.remaining_size === 'number') {
				remainingSize = o.remaining_size
			} else if (typeof o.remainingSize === 'string') {
				remainingSize = parseFloat(o.remainingSize)
			} else if (typeof o.remainingSize === 'number') {
				remainingSize = o.remainingSize
			} else if (typeof o.remaining === 'string') {
				remainingSize = parseFloat(o.remaining)
			} else if (typeof o.remaining === 'number') {
				remainingSize = o.remaining
			} else if (typeof o.open_size === 'string') {
				remainingSize = parseFloat(o.open_size)
			} else if (typeof o.open_size === 'number') {
				remainingSize = o.open_size
			} else {
				// Calculate: original_size - size_matched
				remainingSize = size - filledSize
			}

			console.log(`Order ${index} parsed values:`, {
				price,
				size,
				filledSize,
				remainingSize,
				calculatedRemaining: size - filledSize
			})

			// Parse timestamps - might be Unix timestamp (number) or ISO string
			let createdAt = o.created_at || o.timestamp || o.createdAt
			if (typeof createdAt === 'number') {
				// Convert Unix timestamp to ISO string
				createdAt = new Date(createdAt * 1000).toISOString()
			} else if (!createdAt) {
				createdAt = new Date().toISOString()
			}

			let updatedAt = o.updated_at || o.updatedAt
			if (updatedAt && typeof updatedAt === 'number') {
				updatedAt = new Date(updatedAt * 1000).toISOString()
			}

			let expiresAt = o.expires_at || o.expiresAt
			if (expiresAt && typeof expiresAt === 'number') {
				expiresAt = new Date(expiresAt * 1000).toISOString()
			} else if (expiresAt === '0' || expiresAt === 0) {
				expiresAt = undefined // '0' means no expiration
			}

			return {
				id: o.order_id || o.id || o.hash,
				marketId: o.market || o.condition_id || o.conditionId,
				outcome: o.outcome || o.outcomeTitle || '',
				side: o.side === 'BUY' || o.side === 'buy' || o.side === 0 ? 'BUY' : 'SELL',
				price: price,
				quantity: size,
				status: mapOrderStatus(o.status),
				createdAt: createdAt,
				updatedAt: updatedAt,
				expiresAt: expiresAt,
				filledQuantity: filledSize,
				remainingQuantity: remainingSize
			}
		})

		console.log('Parsed orders:', orders)

		// Sync with database
		await syncOrders(orders)

		return orders
	} catch (error) {
		console.error('Error fetching open orders:', error)
		throw error
	}
}

/**
 * Get order by ID
 */
export async function getOrder(orderId: string): Promise<Order | null> {
	try {
		const client = await getOrInitializeClient()
		const orderData = await client.getOrder(orderId)

		if (!orderData) {
			// Try to get from database
			const cached = await db.orders.get(orderId)
			if (cached) {
				const { syncedAt, ...order } = cached
				return order
			}
			return null
		}

		const order: Order = {
			id: orderData.order_id || orderData.id,
			marketId: orderData.market || orderData.condition_id,
			outcome: orderData.outcome || '',
			side: orderData.side === 'BUY' ? 'BUY' : 'SELL',
			price: parseFloat(orderData.price || '0'),
			quantity: parseFloat(orderData.size || '0'),
			status: mapOrderStatus(orderData.status),
			createdAt: orderData.created_at || new Date().toISOString(),
			updatedAt: orderData.updated_at,
			expiresAt: orderData.expires_at,
			filledQuantity: parseFloat(orderData.filled_size || '0'),
			remainingQuantity: parseFloat(orderData.remaining_size || orderData.size || '0')
		}

		await saveOrder(order)
		return order
	} catch (error) {
		console.error('Error fetching order:', error)
		throw error
	}
}

/**
 * Get orders from database
 */
export async function getCachedOrders(): Promise<Order[]> {
	try {
		const records = await db.orders.orderBy('createdAt').reverse().toArray()
		return records.map((r) => {
			const { syncedAt, ...order } = r
			return order
		})
	} catch (error) {
		console.error('Error getting cached orders:', error)
		return []
	}
}

/**
 * Save order to database
 */
async function saveOrder(order: Order): Promise<void> {
	try {
		const record: OrderRecord = {
			...order,
			syncedAt: Date.now()
		}
		await db.orders.put(record)
	} catch (error) {
		console.error('Error saving order:', error)
	}
}

/**
 * Sync orders with database
 */
async function syncOrders(orders: Order[]): Promise<void> {
	try {
		const records: OrderRecord[] = orders.map((order) => ({
			...order,
			syncedAt: Date.now()
		}))
		await db.orders.bulkPut(records)
	} catch (error) {
		console.error('Error syncing orders:', error)
	}
}

/**
 * Map API order status to our OrderStatus type
 */
function mapOrderStatus(status: string | number): Order['status'] {
	if (typeof status === 'number') {
		// Handle numeric status codes if needed
		return 'PENDING'
	}

	const upper = status.toUpperCase()
	if (upper.includes('LIVE') || upper.includes('OPEN') || upper.includes('PENDING')) return 'OPEN'
	if (upper.includes('FILLED') || upper.includes('EXECUTED') || upper.includes('COMPLETE'))
		return 'FILLED'
	if (upper.includes('CANCELLED') || upper.includes('CANCELED')) return 'CANCELLED'
	if (upper.includes('EXPIRED')) return 'EXPIRED'
	if (upper.includes('REJECTED')) return 'REJECTED'
	return 'PENDING'
}
