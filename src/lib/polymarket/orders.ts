/**
 * Order Management Service
 * Handles order placement, cancellation, and status queries
 */

import { getOrInitializeClient } from './client'
import type { Order, PlaceOrderParams, PlaceOrderResponse } from './types'
import { db } from '../db'
import type { OrderRecord } from '../db'

// These will be loaded dynamically from the CLOB client
let SideEnum: any = null
let OrderTypeEnum: any = null

async function loadEnums() {
	if (SideEnum && OrderTypeEnum) return
	
	const isElectron = typeof window !== 'undefined' && 
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
export async function placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResponse> {
	try {
		const client = await getOrInitializeClient()

		// Get market to find token ID
		const markets = await import('./markets')
		const market = await markets.fetchMarket(params.marketId)
		
		if (!market) {
			throw new Error(`Market not found: ${params.marketId}`)
		}

		// Find the outcome token ID
		const outcome = market.outcomes.find(
			o => o.title.toUpperCase() === params.outcome.toUpperCase()
		)

		if (!outcome) {
			throw new Error(`Outcome not found: ${params.outcome}`)
		}

		// Load enums if needed
		await loadEnums()
		
		// Create order using CLOB client
		const userOrder = {
			tokenID: outcome.id,
			price: params.price,
			size: params.quantity,
			side: params.side === 'BUY' ? SideEnum.BUY : SideEnum.SELL,
		}

		// Create and post the order
		const result = await client.createAndPostOrder(
			userOrder,
			{},
			OrderTypeEnum.GTC,
			false
		)

		// Store order in database
		const order: Order = {
			id: result.order_id || result.id || String(Date.now()),
			marketId: params.marketId,
			outcome: params.outcome,
			side: params.side,
			price: params.price,
			quantity: params.quantity,
			status: 'PENDING',
			createdAt: new Date().toISOString(),
			remainingQuantity: params.quantity,
		}

		await saveOrder(order)

		return {
			orderId: order.id,
			status: 'PENDING',
			message: 'Order placed successfully',
		}
	} catch (error) {
		console.error('Error placing order:', error)
		throw error
	}
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string): Promise<void> {
	try {
		const client = await getOrInitializeClient()
		
		// Get order from database to find order hash
		const orderRecord = await db.orders.get(orderId)
		
		if (!orderRecord) {
			throw new Error(`Order not found: ${orderId}`)
		}

		// Cancel using CLOB client
		// Note: The actual implementation depends on how orders are stored
		// For now, we'll use cancelOrder with order payload
		await client.cancelOrder({
			order_id: orderId,
		})

		// Update order status in database
		await db.orders.update(orderId, {
			status: 'CANCELLED',
			updatedAt: new Date().toISOString(),
		})
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
		await db.orders
			.where('status')
			.anyOf(['PENDING', 'OPEN'])
			.modify({
				status: 'CANCELLED',
				updatedAt: new Date().toISOString(),
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

		// Handle pagination response
		const ordersData = response.data || response.results || []
		
		// Transform API response to our Order type
		const orders: Order[] = ordersData.map((o: any) => ({
			id: o.order_id || o.id,
			marketId: o.market || o.condition_id,
			outcome: o.outcome || '',
			side: o.side === 'BUY' ? 'BUY' : 'SELL',
			price: parseFloat(o.price || '0'),
			quantity: parseFloat(o.size || '0'),
			status: mapOrderStatus(o.status),
			createdAt: o.created_at || o.timestamp || new Date().toISOString(),
			updatedAt: o.updated_at,
			expiresAt: o.expires_at,
			filledQuantity: parseFloat(o.filled_size || '0'),
			remainingQuantity: parseFloat(o.remaining_size || o.size || '0'),
		}))

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
			remainingQuantity: parseFloat(orderData.remaining_size || orderData.size || '0'),
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
		return records.map(r => {
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
			syncedAt: Date.now(),
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
		const records: OrderRecord[] = orders.map(order => ({
			...order,
			syncedAt: Date.now(),
		}))
		await db.orders.bulkPut(records)
	} catch (error) {
		console.error('Error syncing orders:', error)
	}
}

/**
 * Map API order status to our OrderStatus type
 */
function mapOrderStatus(status: string): Order['status'] {
	const upper = status.toUpperCase()
	if (upper.includes('OPEN') || upper.includes('PENDING')) return 'OPEN'
	if (upper.includes('FILLED') || upper.includes('EXECUTED')) return 'FILLED'
	if (upper.includes('CANCELLED') || upper.includes('CANCELED')) return 'CANCELLED'
	if (upper.includes('EXPIRED')) return 'EXPIRED'
	if (upper.includes('REJECTED')) return 'REJECTED'
	return 'PENDING'
}

