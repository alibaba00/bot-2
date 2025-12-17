/**
 * Crypto Price Poller - HTTP-based fallback for WebSocket price updates
 * Uses Binance REST API for reliable price fetching when WebSocket fails
 */

export interface CryptoPriceUpdate {
	symbol: string
	value: number
	timestamp: number
}

export type CryptoPriceSource = 'binance' | 'chainlink'

interface PollerCallbacks {
	onPriceUpdate?: (update: CryptoPriceUpdate) => void
	onError?: (error: Error) => void
}

export class CryptoPricePoller {
	private intervalId: number | null = null
	private isPolling = false
	private callbacks: PollerCallbacks = {}
	private source: CryptoPriceSource = 'binance'
	private symbols: string[] = []
	private pollInterval = 2000 // Poll every 2 seconds (Binance rate limit allows this)

	constructor(
		source: CryptoPriceSource = 'binance',
		symbols: string[] = [],
		callbacks: PollerCallbacks = {}
	) {
		this.source = source
		this.symbols = symbols
		this.callbacks = callbacks
	}

	/**
	 * Start polling for crypto prices
	 */
	start(): void {
		if (this.isPolling) {
			console.log('CryptoPricePoller: Already polling, skipping start')
			return
		}

		this.isPolling = true
		console.log(
			`CryptoPricePoller: Starting polling (source: ${this.source}, symbols: ${this.symbols.join(', ') || 'all'})`
		)

		// Poll immediately, then set interval
		this.poll()
		this.intervalId = window.setInterval(() => {
			this.poll()
		}, this.pollInterval)
	}

	/**
	 * Stop polling
	 */
	stop(): void {
		if (!this.isPolling) {
			return
		}

		this.isPolling = false
		if (this.intervalId !== null) {
			clearInterval(this.intervalId)
			this.intervalId = null
		}
		console.log('CryptoPricePoller: Stopped polling')
	}

	/**
	 * Update symbols to poll
	 */
	updateSymbols(symbols: string[]): void {
		this.symbols = symbols
	}

	/**
	 * Update source
	 */
	updateSource(source: CryptoPriceSource): void {
		this.source = source
	}

	/**
	 * Perform a single poll request
	 */
	private async poll(): Promise<void> {
		if (this.symbols.length === 0) {
			return
		}

		try {
			if (this.source === 'binance') {
				await this.pollBinance()
			} else {
				await this.pollChainlink()
			}
		} catch (error) {
			console.error('CryptoPricePoller: Poll error:', error)
			this.callbacks.onError?.(
				error instanceof Error ? error : new Error(String(error))
			)
		}
	}

	/**
	 * Poll Binance REST API
	 * API: https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
	 */
	private async pollBinance(): Promise<void> {
		const promises = this.symbols.map(async (symbol) => {
			try {
				// Ensure symbol is in correct format (uppercase, no separator)
				const formattedSymbol = symbol.toUpperCase().replace('/', '').replace('USD', 'USDT')
				const url = `https://api.binance.com/api/v3/ticker/price?symbol=${formattedSymbol}`

				const response = await fetch(url, {
					method: 'GET',
					headers: {
						Accept: 'application/json'
					}
				})

				if (!response.ok) {
					throw new Error(`Binance API error: ${response.status} ${response.statusText}`)
				}

				const data = await response.json()

				if (data.price && typeof data.price === 'string') {
					const price = parseFloat(data.price)
					if (!isNaN(price)) {
						const update: CryptoPriceUpdate = {
							symbol: formattedSymbol.toLowerCase(), // Match WebSocket format
							value: price,
							timestamp: Date.now()
						}
						this.callbacks.onPriceUpdate?.(update)
					}
				}
			} catch (error) {
				console.error(`CryptoPricePoller: Error fetching ${symbol}:`, error)
				// Don't throw - continue with other symbols
			}
		})

		await Promise.allSettled(promises)
	}

	/**
	 * Poll Chainlink via Binance as fallback (Chainlink doesn't have a simple public REST API)
	 * For now, we'll use Binance prices as a proxy for Chainlink
	 * In the future, could integrate with Chainlink Data Feeds API if available
	 */
	private async pollChainlink(): Promise<void> {
		// Chainlink doesn't have a simple public REST API for spot prices
		// We'll use Binance as a proxy, but convert symbols to Chainlink format
		const binanceSymbols = this.symbols.map((symbol) => {
			// Convert "btc/usd" to "btcusdt" for Binance
			return symbol.toLowerCase().replace('/', '').replace('usd', 'usdt')
		})

		const promises = binanceSymbols.map(async (binanceSymbol, index) => {
			try {
				const formattedSymbol = binanceSymbol.toUpperCase()
				const url = `https://api.binance.com/api/v3/ticker/price?symbol=${formattedSymbol}`

				const response = await fetch(url, {
					method: 'GET',
					headers: {
						Accept: 'application/json'
					}
				})

				if (!response.ok) {
					throw new Error(`Binance API error: ${response.status} ${response.statusText}`)
				}

				const data = await response.json()

				if (data.price && typeof data.price === 'string') {
					const price = parseFloat(data.price)
					if (!isNaN(price)) {
						// Return in Chainlink format (original symbol)
						const update: CryptoPriceUpdate = {
							symbol: this.symbols[index].toLowerCase(), // Keep original format
							value: price,
							timestamp: Date.now()
						}
						this.callbacks.onPriceUpdate?.(update)
					}
				}
			} catch (error) {
				console.error(`CryptoPricePoller: Error fetching Chainlink proxy ${this.symbols[index]}:`, error)
				// Don't throw - continue with other symbols
			}
		})

		await Promise.allSettled(promises)
	}

	/**
	 * Get polling status
	 */
	getStatus(): 'polling' | 'stopped' {
		return this.isPolling ? 'polling' : 'stopped'
	}
}

