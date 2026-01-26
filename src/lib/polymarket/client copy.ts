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

	const isElectron =
		typeof window !== 'undefined' &&
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

		// Use @ethersproject/wallet (ethers v5) which is compatible with CLOB client
		try {
			const ethersWallet = nodeRequire('@ethersproject/wallet')
			WalletClass = ethersWallet.Wallet
		} catch {
			// Fallback to dynamic import if require doesn't work
			const ethersWallet = await import('@ethersproject/wallet')
			WalletClass = ethersWallet.Wallet
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

		// Initialize CLOB client first (without credentials)
		clobClient = new ClobClientModule.ClobClient(host, chainId, wallet)
		console.log('Initial CLOB client created')

		// Create or use API credentials (required for authenticated endpoints)
		let apiCreds: any = null
		if (config.apiKey && config.apiSecret && config.apiPassphrase) {
			console.log('Using API credentials from env configuration')
			apiCreds = {
				key: config.apiKey,
				secret: config.apiSecret,
				passphrase: config.apiPassphrase
			}
		} else {
			try {
				console.log('Attempting to create/derive API key...')
				console.log('Wallet address:', wallet.address)
				console.log('Config userId:', config.userId)

				apiCreds = await clobClient.createOrDeriveApiKey()

				// Validate that we got proper credentials
				if (!apiCreds || !apiCreds.key || !apiCreds.secret || !apiCreds.passphrase) {
					throw new Error(
						'API credentials are incomplete. Received: ' + JSON.stringify(apiCreds)
					)
				}

				console.log('API credentials created/derived successfully:', {
					hasKey: !!apiCreds?.key,
					hasSecret: !!apiCreds?.secret,
					hasPassphrase: !!apiCreds?.passphrase,
					keyPrefix: apiCreds?.key?.substring(0, 10) + '...'
				})
			} catch (apiKeyError: any) {
				console.error('Failed to create/derive API key:', apiKeyError)
				console.error('Error details:', {
					message: apiKeyError?.message,
					status: apiKeyError?.status,
					statusText: apiKeyError?.statusText,
					data: apiKeyError?.data,
					response: apiKeyError?.response
				})

				// If it's a 400 error, it might mean the account doesn't exist or isn't properly set up
				if (apiKeyError?.status === 400 || apiKeyError?.response?.status === 400) {
					throw new Error(`API key creation failed (400 Bad Request). This usually means:
1. The wallet address doesn't have a Polymarket account linked
2. The account needs to be activated on Polymarket first
3. You may need to deposit funds to the CLOB exchange first
Original error: ${apiKeyError?.data?.error || apiKeyError?.message || String(apiKeyError)}

If you already have API credentials, set:
VITE_POLYMARKET_API_KEY
VITE_POLYMARKET_API_SECRET
VITE_POLYMARKET_API_PASSPHRASE`)
				}

				// Don't continue without credentials - authenticated endpoints won't work
				throw new Error(
					`Failed to create API credentials: ${apiKeyError instanceof Error ? apiKeyError.message : String(apiKeyError)}`
				)
			}
		}

		// Reinitialize the client with credentials (required for authenticated endpoints)
		if (!apiCreds || !apiCreds.key || !apiCreds.secret || !apiCreds.passphrase) {
			throw new Error('API credentials were not created or are incomplete')
		}

		console.log('Reinitializing client with API credentials...')
		// clobClient = new ClobClientModule.ClobClient(host, chainId, wallet, apiCreds)
		clobClient = new ClobClientModule.ClobClient(host, chainId, wallet, apiCreds, 1, wallet.address)
		console.log('CLOB client initialized with credentials')

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
		isConnected: connectionStatus === 'connected' && isInitialized
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
