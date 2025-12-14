/**
 * TypeScript interfaces for Polymarket API responses and data structures
 */

export interface Market {
	symbol: string
	marketName: string
	slug: string
	timestamp: number
	startTimestamp: number
	endTimestamp: number
	state: MarketState
	marketData: MarketData | null
	openPrice: number | null	// priceToBeat
	closePrice: number | null	// finalPrice
	openPriceTimestamp: number | null
	closePriceTimestamp: number | null
	closeMarketTimestamp: number | null	
}


export type MarketState = 'init' | 'pending' | 'started' | 'running' | 'stopped' | 'closed' | 'failed'

export interface MarketData {
	id: string
	question: string
	slug: string
	description?: string
	image?: string
	active: boolean
	closed: boolean
	volume: number
	liquidity: number
	endDate?: string
	startDate?: string
	conditionId: string
	marketMakerAddress?: string
	outcomes: MarketOutcome[]
	createdAt?: string
	updatedAt?: string,
	sourceData: any | null
}

export interface MarketOutcome {
	id: string
	title: string
	price: number // Price in USDC (0-1 range for yes/no markets)
	volume?: number
}

export interface Order {
	id: string
	marketId: string
	outcome: string // 'YES' or 'NO'
	side: 'BUY' | 'SELL'
	price: number
	quantity: number
	status: OrderStatus
	createdAt: string
	updatedAt?: string
	expiresAt?: string
	filledQuantity?: number
	remainingQuantity?: number
}

export type OrderStatus = 'PENDING' | 'OPEN' | 'FILLED' | 'CANCELLED' | 'EXPIRED' | 'REJECTED'

export interface Transaction {
	id: string
	hash: string
	marketId: string
	type: 'BUY' | 'SELL' | 'CANCEL' | 'DEPOSIT' | 'WITHDRAWAL'
	amount: number
	price?: number
	outcome?: string
	status: 'PENDING' | 'CONFIRMED' | 'FAILED'
	timestamp: string
	blockNumber?: number
}

export interface WalletBalance {
	available: number // Available USDC balance on CLOB exchange
	locked: number // Locked in open orders
	total: number // Total balance on CLOB exchange
	currency: string // Usually 'USDC'
	onChainBalance?: number // On-chain wallet balance (if available)
}

export interface AccountInfo {
	address: string
	userId?: string
	email?: string
	balance: WalletBalance
}

export interface OrderBookEntry {
	price: number
	quantity: number
}

export interface OrderBook {
	marketId: string
	outcome: string
	bids: OrderBookEntry[]
	asks: OrderBookEntry[]
}

export interface PlaceOrderParams {
	marketId: string
	outcome: 'YES' | 'NO'
	side: 'BUY' | 'SELL'
	price: number
	quantity: number
	expiresAt?: number // Unix timestamp
}

export interface PlaceOrderResponse {
	orderId: string
	status: OrderStatus
	message?: string
}
