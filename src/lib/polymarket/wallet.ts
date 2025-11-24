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
 * Get on-chain USDC balance from Polygon network
 */
async function getOnChainBalance(address: string): Promise<number> {
	try {
		const isElectron = typeof window !== 'undefined' && 
			(window as any).navigator?.userAgent?.includes('Electron') &&
			(window as any).require

		if (!isElectron) {
			return 0
		}

		const nodeRequire = (window as any).require
		
		// USDC token address on Polygon
		const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' // Polygon USDC
		const ERC20_ABI = [
			'function balanceOf(address owner) view returns (uint256)',
			'function decimals() view returns (uint8)'
		]

		// Get ethers provider for Polygon
		const providers = nodeRequire('@ethersproject/providers')
		const contracts = nodeRequire('@ethersproject/contracts')
		
		// Polygon RPC endpoint
		const provider = new providers.JsonRpcProvider('https://polygon-rpc.com')
		const tokenContract = new contracts.Contract(USDC_ADDRESS, ERC20_ABI, provider)
		
		const balance = await tokenContract.balanceOf(address)
		const decimals = await tokenContract.decimals()
		
		// Convert from wei to human-readable (USDC has 6 decimals)
		// ethers v5 returns BigNumber, need to convert properly
		const balanceStr = balance.toString ? balance.toString() : String(balance)
		const decimalsNum = decimals.toString ? parseInt(decimals.toString()) : decimals
		
		return parseFloat(balanceStr) / Math.pow(10, decimalsNum)
	} catch (error) {
		console.warn('Could not fetch on-chain balance:', error)
		return 0
	}
}

/**
 * Get wallet balance (CLOB exchange balance)
 * Note: This shows the balance deposited to the CLOB exchange, not your on-chain wallet balance.
 * To trade via API, you need to deposit funds to the CLOB exchange first.
 */
export async function getWalletBalance(): Promise<WalletBalance> {
	try {
		const client = await getOrInitializeClient()
		const config = await import('./config')
		const configData = config.loadPolymarketConfig()
		
		// Load AssetType enum if needed
		await loadAssetType()
		
		// Try multiple methods to get balance
		let balanceResponse: any = null
		let balanceMethod = 'unknown'
		
		try {
			// Method 1: getBalanceAllowance (current method)
			balanceResponse = await client.getBalanceAllowance({
				asset_type: AssetTypeEnum.COLLATERAL,
			})
			balanceMethod = 'getBalanceAllowance'
			console.log('Balance method: getBalanceAllowance')
		} catch (err) {
			console.log('getBalanceAllowance failed, trying alternatives:', err)
			try {
				// Method 2: Try getBalance
				balanceResponse = await client.getBalance?.({
					asset_type: AssetTypeEnum.COLLATERAL,
				})
				balanceMethod = 'getBalance'
				console.log('Balance method: getBalance')
			} catch (err2) {
				console.log('getBalance failed, trying getAccountBalance:', err2)
				try {
					// Method 3: Try getAccountBalance
					balanceResponse = await client.getAccountBalance?.()
					balanceMethod = 'getAccountBalance'
					console.log('Balance method: getAccountBalance')
				} catch (err3) {
					console.log('All balance methods failed:', err3)
					balanceResponse = { balance: '0' }
				}
			}
		}

		console.log('Balance response:', balanceResponse)
		console.log('Balance response type:', typeof balanceResponse)
		console.log('Balance response keys:', Object.keys(balanceResponse || {}))
		console.log('Balance method used:', balanceMethod)

		// USDC has 6 decimals, so divide by 1e6 to get the actual amount
		// The balance is returned as a string, might already be in wei format
		const balanceRaw = balanceResponse?.balance || balanceResponse?.balance_allowance?.balance || balanceResponse?.data?.balance || '0'
		console.log('Raw balance value:', balanceRaw, 'Type:', typeof balanceRaw)
		
		let available = 0
		
		// Handle different response formats
		if (typeof balanceRaw === 'string') {
			// Remove any whitespace
			const cleaned = balanceRaw.trim()
			
			// Check if it's in hex format (starts with 0x)
			if (cleaned.startsWith('0x')) {
				// Convert hex to decimal
				const hexValue = BigInt(cleaned)
				available = Number(hexValue) / 1e6 // USDC has 6 decimals
			} else {
				// Parse as decimal string
				const parsed = parseFloat(cleaned)
				if (parsed > 1000000 || cleaned.length > 6) {
					// If it's a large number or long string, it's likely in wei (6 decimals), so divide
					available = parsed / 1e6
				} else {
					// Otherwise, assume it's already in human-readable format
					available = parsed
				}
			}
		} else if (typeof balanceRaw === 'number') {
			// If it's already a number, check if it needs conversion
			if (balanceRaw > 1000000) {
				available = balanceRaw / 1e6
			} else {
				available = balanceRaw
			}
		} else if (balanceRaw && typeof balanceRaw === 'object' && 'toString' in balanceRaw) {
			// Handle BigNumber or similar objects
			const str = balanceRaw.toString()
			const parsed = parseFloat(str)
			available = parsed > 1000000 ? parsed / 1e6 : parsed
		}
		
		console.log('Parsed available balance:', available)
		
		// Get locked balance from open orders
		const orders = await import('./orders')
		const openOrders = await orders.getOpenOrders()
		
		console.log('Open orders for balance calculation:', openOrders.length)
		
		// Calculate locked amount (simplified - in reality, need to calculate based on order prices)
		let locked = 0
		for (const order of openOrders) {
			const remainingQty = order.remainingQuantity || order.quantity || 0
			const price = order.price || 0
			
			console.log(`Order ${order.id}: side=${order.side}, price=${price}, remainingQty=${remainingQty}`)
			
			if (order.side === 'BUY') {
				// For buy orders, lock the total cost (price * quantity)
				const orderValue = price * remainingQty
				locked += orderValue
				console.log(`  -> Locked for BUY order: ${orderValue}`)
			} else {
				// For sell orders, lock the quantity being sold (in shares, not USDC)
				// Note: This might need conversion to USDC value
				locked += remainingQty
				console.log(`  -> Locked for SELL order: ${remainingQty} shares`)
			}
		}
		
		console.log('Total locked balance:', locked)

		// Try to get on-chain balance for comparison
		let onChainBalance = 0
		if (configData?.publicKey) {
			onChainBalance = await getOnChainBalance(configData.publicKey)
		}

		// Get positions/portfolio value from Polymarket Data API
		// This is a REST API, not part of the CLOB client
		let positionsValue = 0
		let positionsCount = 0
		try {
			// Try userId first (as shown in the user's example), then publicKey as fallback
			const userAddress = configData?.userId || configData?.publicKey
			
			if (!userAddress) {
				console.log('No user address available for positions query (need userId or publicKey)')
			} else {
				// Call the Polymarket Data API directly
				// According to the API docs, the 'user' parameter should be the user's wallet address
				const positionsUrl = `https://data-api.polymarket.com/positions?sizeThreshold=1&limit=100&sortBy=TOKENS&sortDirection=DESC&user=${userAddress}`
				
				console.log('Fetching positions from:', positionsUrl)
				console.log('Using address:', userAddress, '(userId:', configData?.userId, ', publicKey:', configData?.publicKey, ')')
				
				const positionsResponse = await fetch(positionsUrl)
				
				if (!positionsResponse.ok) {
					const errorText = await positionsResponse.text()
					console.error('Positions API error response:', errorText)
					throw new Error(`Positions API returned ${positionsResponse.status}: ${positionsResponse.statusText}`)
				}
				
				const positions: any[] = await positionsResponse.json()
				
				positionsCount = positions.length
				console.log(`Found ${positionsCount} positions from Data API`)
				
				if (positionsCount === 0) {
					console.warn('No positions found. This could mean:')
					console.warn('1. The user address is incorrect')
					console.warn('2. The user has no positions with size >= 1')
					console.warn('3. The positions are under a different address')
				}
				
				// Sum up the currentValue of all positions
				// According to the API docs, each position has:
				// - currentValue: current market value of the position
				// - initialValue: original value when position was opened
				positionsValue = positions.reduce((sum: number, pos: any, index: number) => {
					console.log(`Position ${index}:`, {
						title: pos.title,
						size: pos.size,
						currentValue: pos.currentValue,
						initialValue: pos.initialValue,
						cashPnl: pos.cashPnl
					})
					
					// Use currentValue as it represents the current market value
					const value = parseFloat(pos.currentValue || pos.initialValue || '0')
					console.log(`  -> Current Value: ${value}`)
					return sum + value
				}, 0)
				
				console.log('Total positions value (sum of currentValue):', positionsValue)
			}
		} catch (posError) {
			console.error('Could not fetch positions from Data API:', posError)
		}

		const totalBalance = available + positionsValue
		
		console.log('Calculated balance:', { 
			available, 
			locked, 
			total: totalBalance,
			positionsValue,
			positionsCount,
			raw: balanceRaw,
			onChainBalance,
			balanceMethod
		})

		return {
			available: Math.max(0, available - locked),
			locked,
			total: totalBalance,
			currency: 'USDC',
			onChainBalance,
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

		// Try to get wallet address from the client if available
		let address = configData?.publicKey || ''
		try {
			// The client's signer should have the address
			if (client.signer && (client.signer as any).address) {
				address = (client.signer as any).address
			}
		} catch (e) {
			// Ignore if we can't get address from signer
		}

		return {
			address,
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

