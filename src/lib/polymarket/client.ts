/**
 * Polymarket CLOB Client Service
 * Handles initialization and connection management for Polymarket CLOB client
 */

// Import polyfills first
import './polyfills'

// Use dynamic import to avoid bundling issues in Vite
let ClobClientModule: any = null
let ChainEnum: any = null
let WalletClass: any = null

// Lazy load the modules only when needed (and in Electron)
async function loadClobClient() {
	if (ClobClientModule) return
	
	const isElectron = typeof window !== 'undefined' && 
		(window as any).navigator?.userAgent?.includes('Electron') &&
		(window as any).require
	
	if (!isElectron) {
		throw new Error('Polymarket client can only be used in Electron environment')
	}
	
	try {
		const nodeRequire = (window as any).require
		
		// Use require() instead of import() for CommonJS modules in Electron
		ClobClientModule = nodeRequire('@polymarket/clob-client')
		ChainEnum = ClobClientModule.Chain
		
		// For ethers, try require first, fallback to import
		try {
			const ethers = nodeRequire('ethers')
			WalletClass = ethers.Wallet
		} catch {
			// Fallback to dynamic import if require doesn't work
			const ethers = await import('ethers')
			WalletClass = ethers.Wallet
		}
	} catch (error) {
		console.error('Failed to load Polymarket client:', error)
		throw error
	}
}

import { getValidatedConfig } from './config'

let clobClient: any | null = null
let isInitialized = false
let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected'
let lastError: Error | null = null

/**
 * Initialize the Polymarket CLOB client
 */
export async function initializeClient(): Promise<any> {
	if (clobClient && isInitialized) {
		return clobClient
	}

	try {
		connectionStatus = 'connecting'
		lastError = null

		// Load the client module first
		await loadClobClient()
		
		if (!ClobClientModule || !WalletClass) {
			throw new Error('Failed to load Polymarket client modules')
		}

		const config = getValidatedConfig()
		
		// Create wallet from private key
		const wallet = new WalletClass(config.privateKey)
		
		// Use Polygon mainnet (chain ID 137)
		const chainId = ChainEnum.POLYGON
		
		// Use proxy address from config or default to Polymarket CLOB API
		const host = config.proxyAddress || 'https://clob.polymarket.com'
		
		// Initialize CLOB client
		clobClient = new ClobClientModule.ClobClient(host, chainId, wallet)

		// Test connection by checking server status
		await clobClient.getOk()
		
		isInitialized = true
		connectionStatus = 'connected'
		
		return clobClient
	} catch (error) {
		connectionStatus = 'error'
		lastError = error instanceof Error ? error : new Error(String(error))
		isInitialized = false
		clobClient = null
		throw error
	}
}

/**
 * Get the current CLOB client instance
 */
export function getClient(): any | null {
	return clobClient
}

/**
 * Get or initialize the client
 */
export async function getOrInitializeClient(): Promise<any> {
	if (clobClient && isInitialized) {
		return clobClient
	}
	return await initializeClient()
}

/**
 * Check connection status
 */
export function getConnectionStatus(): {
	status: typeof connectionStatus
	error: Error | null
	isConnected: boolean
} {
	return {
		status: connectionStatus,
		error: lastError,
		isConnected: connectionStatus === 'connected' && isInitialized,
	}
}

/**
 * Test the connection
 */
export async function testConnection(): Promise<boolean> {
	try {
		const client = await getOrInitializeClient()
		await client.getOk()
		connectionStatus = 'connected'
		lastError = null
		return true
	} catch (error) {
		connectionStatus = 'error'
		lastError = error instanceof Error ? error : new Error(String(error))
		return false
	}
}

/**
 * Reset the client (useful for reconnection)
 */
export function resetClient(): void {
	clobClient = null
	isInitialized = false
	connectionStatus = 'disconnected'
	lastError = null
}

/**
 * Reconnect the client
 */
export async function reconnect(): Promise<any> {
	resetClient()
	return await initializeClient()
}

