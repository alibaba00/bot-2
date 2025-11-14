/**
 * Wallet & Account Service
 * Handles wallet balance and transaction history
 */

import { getOrInitializeClient } from './client'
import type { WalletBalance, AccountInfo, Transaction } from './types'
import { db } from '../db'
import type { TransactionRecord } from '../db'

// AssetType will be loaded dynamically
let AssetTypeEnum: any = null

async function loadAssetType() {
	if (AssetTypeEnum) return
	
	const isElectron = typeof window !== 'undefined' && 
		(window as any).navigator?.userAgent?.includes('Electron') &&
		(window as any).require
	
	if (isElectron) {
		// Use require() in Electron for CommonJS modules
		const nodeRequire = (window as any).require
		const clobModule = nodeRequire('@polymarket/clob-client')
		AssetTypeEnum = clobModule.AssetType
	} else {
		// Fallback to import for non-Electron environments
		const clobModule = await import('@polymarket/clob-client')
		AssetTypeEnum = clobModule.AssetType
	}
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(): Promise<WalletBalance> {
	try {
		const client = await getOrInitializeClient()
		
		// Load AssetType enum if needed
		await loadAssetType()
		
		// Get balance and allowance for collateral
		const balanceResponse = await client.getBalanceAllowance({
			asset_type: AssetTypeEnum.COLLATERAL,
		})

		const available = parseFloat(balanceResponse.balance || '0')
		
		// Get locked balance from open orders
		const orders = await import('./orders')
		const openOrders = await orders.getOpenOrders()
		
		// Calculate locked amount (simplified - in reality, need to calculate based on order prices)
		let locked = 0
		for (const order of openOrders) {
			if (order.side === 'BUY') {
				// For buy orders, lock the total cost (price * quantity)
				locked += order.price * (order.remainingQuantity || order.quantity)
			} else {
				// For sell orders, lock the quantity being sold
				locked += order.remainingQuantity || order.quantity
			}
		}

		return {
			available: available - locked,
			locked,
			total: available,
			currency: 'USDC',
		}
	} catch (error) {
		console.error('Error fetching wallet balance:', error)
		throw error
	}
}

/**
 * Get account information
 */
export async function getAccountInfo(): Promise<AccountInfo> {
	try {
		const client = await getOrInitializeClient()
		const config = await import('./config')
		const configData = config.loadPolymarketConfig()

		const balance = await getWalletBalance()

		return {
			address: configData?.publicKey || '',
			userId: configData?.userId,
			balance,
		}
	} catch (error) {
		console.error('Error fetching account info:', error)
		throw error
	}
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(limit = 100): Promise<Transaction[]> {
	try {
		const client = await getOrInitializeClient()
		const response = await client.getTrades({}, true)

		// Handle pagination response
		const tradesData = response.data || response.results || response || []
		
		// Transform API response to our Transaction type
		const transactions: Transaction[] = tradesData.map((trade: any) => ({
			id: trade.id || trade.transaction_hash,
			hash: trade.transaction_hash || trade.id,
			marketId: trade.market || trade.condition_id,
			type: trade.side === 'BUY' ? 'BUY' : 'SELL',
			amount: parseFloat(trade.size || '0'),
			price: parseFloat(trade.price || '0'),
			outcome: trade.outcome,
			status: 'CONFIRMED',
			timestamp: trade.match_time || trade.timestamp || new Date().toISOString(),
			blockNumber: trade.block_number,
		}))

		// Cache transactions
		await cacheTransactions(transactions)

		return transactions.slice(0, limit)
	} catch (error) {
		console.error('Error fetching transaction history:', error)
		throw error
	}
}

/**
 * Get cached transactions from database
 */
export async function getCachedTransactions(limit = 100): Promise<Transaction[]> {
	try {
		const records = await db.transactions
			.orderBy('timestamp')
			.reverse()
			.limit(limit)
			.toArray()

		return records.map(r => {
			const { syncedAt, ...transaction } = r
			return transaction
		})
	} catch (error) {
		console.error('Error getting cached transactions:', error)
		return []
	}
}

/**
 * Cache transactions in database
 */
async function cacheTransactions(transactions: Transaction[]): Promise<void> {
	try {
		const records: TransactionRecord[] = transactions.map(tx => ({
			...tx,
			syncedAt: Date.now(),
		}))
		await db.transactions.bulkPut(records)
	} catch (error) {
		console.error('Error caching transactions:', error)
	}
}

