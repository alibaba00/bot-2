/**
 * Polymarket Configuration
 * Loads and validates Polymarket credentials from environment variables
 */

export interface PolymarketConfig {
	userId: string
	proxyAddress: string
	publicKey: string
	privateKey: string
	apiKey?: string
	apiSecret?: string
	apiPassphrase?: string
}

export interface ConfigValidationResult {
	valid: boolean
	missing: string[]
	errors: string[]
}

/**
 * Load Polymarket configuration from environment variables
 */
export function loadPolymarketConfig(): PolymarketConfig | null {
	// Vite automatically exposes variables prefixed with VITE_ to import.meta.env
	const userId = import.meta.env.VITE_USER_ID
	const proxyAddress = import.meta.env.VITE_POLYMARKET_PROXY_ADDRESS
	const publicKey = import.meta.env.VITE_PUBLIC_KEY
	const privateKey = import.meta.env.VITE_PRIVATE_KEY
	const apiKey = import.meta.env.VITE_POLYMARKET_API_KEY
	const apiSecret = import.meta.env.VITE_POLYMARKET_API_SECRET
	const apiPassphrase = import.meta.env.VITE_POLYMARKET_API_PASSPHRASE

	if (!userId || !proxyAddress || !publicKey || !privateKey) {
		return null
	}

	return {
		userId: userId as string,
		proxyAddress: proxyAddress as string,
		publicKey: publicKey as string,
		privateKey: privateKey as string,
		apiKey: apiKey as string | undefined,
		apiSecret: apiSecret as string | undefined,
		apiPassphrase: apiPassphrase as string | undefined
	}
}

/**
 * Validate Polymarket configuration
 */
export function validateConfig(config: PolymarketConfig | null): ConfigValidationResult {
	const result: ConfigValidationResult = {
		valid: false,
		missing: [],
		errors: []
	}

	if (!config) {
		result.missing = [
			'VITE_USER_ID',
			'VITE_POLYMARKET_PROXY_ADDRESS',
			'VITE_PUBLIC_KEY',
			'VITE_PRIVATE_KEY'
		]
		result.errors.push('Configuration is missing. Please check your .env file.')
		return result
	}

	// Check for missing values
	if (!config.userId || config.userId.trim() === '') {
		result.missing.push('VITE_USER_ID')
	}
	if (!config.proxyAddress || config.proxyAddress.trim() === '') {
		result.missing.push('VITE_POLYMARKET_PROXY_ADDRESS')
	}
	if (!config.publicKey || config.publicKey.trim() === '') {
		result.missing.push('VITE_PUBLIC_KEY')
	}
	if (!config.privateKey || config.privateKey.trim() === '') {
		result.missing.push('VITE_PRIVATE_KEY')
	}

	// Validate format
	if (config.publicKey && !config.publicKey.startsWith('0x')) {
		result.errors.push('VITE_PUBLIC_KEY must start with 0x')
	}
	if (config.privateKey && !config.privateKey.startsWith('0x')) {
		result.errors.push('VITE_PRIVATE_KEY must start with 0x')
	}
	if (config.proxyAddress && !config.proxyAddress.startsWith('http')) {
		result.errors.push('VITE_POLYMARKET_PROXY_ADDRESS must be a valid URL')
	}
	if (
		(config.apiKey || config.apiSecret || config.apiPassphrase) &&
		(!config.apiKey || !config.apiSecret || !config.apiPassphrase)
	) {
		result.errors.push(
			'VITE_POLYMARKET_API_KEY, VITE_POLYMARKET_API_SECRET, and VITE_POLYMARKET_API_PASSPHRASE must all be set together'
		)
	}

	result.valid = result.missing.length === 0 && result.errors.length === 0
	return result
}

/**
 * Get validated configuration or throw error
 */
export function getValidatedConfig(): PolymarketConfig {
	const config = loadPolymarketConfig()
	const validation = validateConfig(config)

	if (!validation.valid) {
		const errorMessage = [
			'Polymarket configuration is invalid:',
			...validation.missing.map((key) => `- Missing: ${key}`),
			...validation.errors
		].join('\n')
		throw new Error(errorMessage)
	}

	return config!
}
