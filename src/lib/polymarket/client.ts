/**
 * Polymarket CLOB Client Service
 * Handles initialization and connection management for Polymarket CLOB client
 */

// Import polyfills first
import './polyfills'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// Prefer Electron require() to keep Node built-ins (crypto, etc.) available.
let ClobClientModule: any = null
const SIGNATURE_TYPE = 1

// Lazy load the module only when needed.
async function loadClobClient() {
	if (ClobClientModule) return

	try {
		const isElectron =
			typeof window !== 'undefined' &&
			(window as any).navigator?.userAgent?.includes('Electron') &&
			(window as any).require

		if (isElectron) {
			const nodeRequire = (window as any).require
			ClobClientModule = nodeRequire('@polymarket/clob-client-v2')
			return
		}

		// Fallback for non-Electron environments.
		ClobClientModule = await import('@polymarket/clob-client-v2')
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

function getStoredApiCreds(storageKey: string): any | null {
	try {
		if (typeof localStorage === 'undefined') return null
		const raw = localStorage.getItem(storageKey)
		if (!raw) return null
		const parsed = JSON.parse(raw)
		if (parsed?.key && parsed?.secret && parsed?.passphrase) {
			return parsed
		}
	} catch {
		// Ignore storage errors
	}
	return null
}

function storeApiCreds(storageKey: string, creds: any): void {
	try {
		if (typeof localStorage === 'undefined') return
		if (!creds?.key || !creds?.secret || !creds?.passphrase) return
		localStorage.setItem(storageKey, JSON.stringify(creds))
	} catch {
		// Ignore storage errors
	}
}

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

		if (!ClobClientModule?.ClobClient) {
			throw new Error('Failed to load Polymarket client modules')
		}

		const config = getValidatedConfig()
		const rpcUrl = import.meta.env.VITE_POLYGON_RPC_URL || 'https://polygon-rpc.com'

		// Build viem signer (required by clob-client-v2)
		const account = privateKeyToAccount(config.privateKey as `0x${string}`)
		const signer = createWalletClient({
			account,
			transport: http(rpcUrl)
		})

		// Use proxy address from config or default to Polymarket CLOB API
		const host = config.proxyAddress || 'https://clob.polymarket.com'
		const chain = 137

		// Initialize CLOB V2 client first (without credentials)
		clobClient = new ClobClientModule.ClobClient({
			host,
			chain,
			signer,
			signatureType: SIGNATURE_TYPE,
			funderAddress: config.userId
		})
		console.log('Initial CLOB client created')

		// Create or derive API credentials (required for authenticated endpoints)
		const apiCredsKey = `polymarketApiCreds:${config.userId}`
		let apiCreds: any = getStoredApiCreds(apiCredsKey)
		try {
			if (!apiCreds) {
				console.log('Attempting to derive/create API key...')
				console.log('Wallet address:', account.address)
				console.log('Config userId:', config.userId)

				try {
					// V2 convenience method
					if (typeof clobClient.createOrDeriveApiKey === 'function') {
						apiCreds = await clobClient.createOrDeriveApiKey()
					} else {
						apiCreds = await clobClient.deriveApiKey()
					}
				} catch {
					apiCreds = await clobClient.createApiKey()
				}

				// Validate that we got proper credentials
				if (!apiCreds || !apiCreds.key || !apiCreds.secret || !apiCreds.passphrase) {
					throw new Error(
						'API credentials are incomplete. Received: ' + JSON.stringify(apiCreds)
					)
				}

				storeApiCreds(apiCredsKey, apiCreds)
				console.log('API credentials created/derived successfully:', {
					hasKey: !!apiCreds?.key,
					hasSecret: !!apiCreds?.secret,
					hasPassphrase: !!apiCreds?.passphrase,
					keyPrefix: apiCreds?.key?.substring(0, 10) + '...'
				})
			} else {
				console.log('Using cached API credentials from local storage:', {
					hasKey: !!apiCreds?.key,
					hasSecret: !!apiCreds?.secret,
					hasPassphrase: !!apiCreds?.passphrase,
					keyPrefix: apiCreds?.key?.substring(0, 10) + '...'
				})
			}
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
Original error: ${apiKeyError?.data?.error || apiKeyError?.message || String(apiKeyError)}`)
			}

			// Don't continue without credentials - authenticated endpoints won't work
			throw new Error(
				`Failed to create API credentials: ${apiKeyError instanceof Error ? apiKeyError.message : String(apiKeyError)}`
			)
		}

		// Reinitialize the client with credentials (required for authenticated endpoints)
		if (!apiCreds || !apiCreds.key || !apiCreds.secret || !apiCreds.passphrase) {
			throw new Error('API credentials were not created or are incomplete')
		}

		console.log('Reinitializing client with API credentials...')
		clobClient = new ClobClientModule.ClobClient({
			host,
			chain,
			signer,
			creds: apiCreds,
			signatureType: SIGNATURE_TYPE,
			funderAddress: config.userId
		})
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

/**
 * Get API credentials from storage
 * Useful for WebSocket authentication
 */
export function getApiCredentials(): { key: string; secret: string; passphrase: string } | null {
	try {
		const config = getValidatedConfig()
		const apiCredsKey = `polymarketApiCreds:${config.userId}`
		return getStoredApiCreds(apiCredsKey)
	} catch {
		return null
	}
}
