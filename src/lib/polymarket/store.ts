/**
 * Polymarket Zustand Store
 * Manages application state for Polymarket trading bot
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { Market, Order, Transaction, WalletBalance, AccountInfo } from './types'
import { getConnectionStatus, testConnection, initializeClient } from './client'
import * as marketsService from './markets'
import * as ordersService from './orders'
import * as walletService from './wallet'

interface PolymarketState {
	// Connection
	connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'
	connectionError: string | null

	// Markets
	markets: Market[]
	marketsLoading: boolean
	marketsError: string | null
	selectedMarket: Market | null

	// Orders
	orders: Order[]
	ordersLoading: boolean
	ordersError: string | null

	// Wallet
	balance: WalletBalance | null
	accountInfo: AccountInfo | null
	walletLoading: boolean
	walletError: string | null

	// Transactions
	transactions: Transaction[]
	transactionsLoading: boolean
	transactionsError: string | null

	// Actions
	connect: () => Promise<void>
	disconnect: () => void
	refreshConnection: () => Promise<void>

	fetchMarkets: (forceRefresh?: boolean) => Promise<void>
	selectMarket: (market: Market | null) => void
	searchMarkets: (query: string) => Promise<Market[]>

	fetchOrders: () => Promise<void>
	placeOrder: (params: any) => Promise<void>
	cancelOrder: (orderId: string) => Promise<void>
	cancelAllOrders: () => Promise<void>

	fetchWallet: () => Promise<void>
	fetchAccountInfo: () => Promise<void>

	fetchTransactions: () => Promise<void>

	reset: () => void
}

const initialState = {
	connectionStatus: 'disconnected' as const,
	connectionError: null,
	markets: [],
	marketsLoading: false,
	marketsError: null,
	selectedMarket: null,
	orders: [],
	ordersLoading: false,
	ordersError: null,
	balance: null,
	accountInfo: null,
	walletLoading: false,
	walletError: null,
	transactions: [],
	transactionsLoading: false,
	transactionsError: null,
}

export const usePolymarketStore = create<PolymarketState>((set, get) => ({
	...initialState,

	connect: async () => {
		set({ connectionStatus: 'connecting', connectionError: null })
		try {
			await initializeClient()
			const status = getConnectionStatus()
			set({
				connectionStatus: status.isConnected ? 'connected' : 'error',
				connectionError: status.error?.message || null,
			})
		} catch (error) {
			set({
				connectionStatus: 'error',
				connectionError: error instanceof Error ? error.message : String(error),
			})
		}
	},

	disconnect: () => {
		set({ ...initialState })
	},

	refreshConnection: async () => {
		const connected = await testConnection()
		const status = getConnectionStatus()
		set({
			connectionStatus: connected ? 'connected' : 'error',
			connectionError: status.error?.message || null,
		})
	},

	fetchMarkets: async (forceRefresh = false) => {
		set({ marketsLoading: true, marketsError: null })
		try {
			const markets = await marketsService.getMarkets(forceRefresh)
			set({ markets: markets, marketsLoading: false })
		} catch (error) {
			set({
				marketsError: error instanceof Error ? error.message : String(error),
				marketsLoading: false,
			})
		}
	},

	selectMarket: (market: Market | null) => {
		set({ selectedMarket: market })
	},

	searchMarkets: async (query: string) => {
		try {
			return await marketsService.searchMarkets(query)
		} catch (error) {
			console.error('Error searching markets:', error)
			return []
		}
	},

	fetchOrders: async () => {
		set({ ordersLoading: true, ordersError: null })
		try {
			const orders = await ordersService.getOpenOrders()
			set({ orders: orders, ordersLoading: false })
		} catch (error) {
			set({
				ordersError: error instanceof Error ? error.message : String(error),
				ordersLoading: false,
			})
		}
	},

	placeOrder: async (params: any) => {
		set({ ordersLoading: true, ordersError: null })
		try {
			await ordersService.placeOrder(params)
			// Refresh orders after placing
			await get().fetchOrders()
		} catch (error) {
			set({
				ordersError: error instanceof Error ? error.message : String(error),
				ordersLoading: false,
			})
			throw error
		}
	},

	cancelOrder: async (orderId: string) => {
		set({ ordersLoading: true, ordersError: null })
		try {
			await ordersService.cancelOrder(orderId)
			// Refresh orders after cancelling
			await get().fetchOrders()
		} catch (error) {
			set({
				ordersError: error instanceof Error ? error.message : String(error),
				ordersLoading: false,
			})
			throw error
		}
	},

	cancelAllOrders: async () => {
		set({ ordersLoading: true, ordersError: null })
		try {
			await ordersService.cancelAllOrders()
			// Refresh orders after cancelling
			await get().fetchOrders()
		} catch (error) {
			set({
				ordersError: error instanceof Error ? error.message : String(error),
				ordersLoading: false,
			})
			throw error
		}
	},

	fetchWallet: async () => {
		set({ walletLoading: true, walletError: null })
		try {
			const balance = await walletService.getWalletBalance()
			set({ balance, walletLoading: false })
		} catch (error) {
			set({
				walletError: error instanceof Error ? error.message : String(error),
				walletLoading: false,
			})
		}
	},

	fetchAccountInfo: async () => {
		set({ walletLoading: true, walletError: null })
		try {
			const accountInfo = await walletService.getAccountInfo()
			set({ accountInfo, walletLoading: false })
		} catch (error) {
			set({
				walletError: error instanceof Error ? error.message : String(error),
				walletLoading: false,
			})
		}
	},

	fetchTransactions: async () => {
		set({ transactionsLoading: true, transactionsError: null })
		try {
			const transactions = await walletService.getTransactionHistory()
			set({ transactions, transactionsLoading: false })
		} catch (error) {
			set({
				transactionsError: error instanceof Error ? error.message : String(error),
				transactionsLoading: false,
			})
		}
	},

	reset: () => {
		set({ ...initialState })
	},
}))

// Helper hooks for common use cases
export function usePolymarketConnection() {
	return usePolymarketStore(
		useShallow((state) => ({
			status: state.connectionStatus,
			error: state.connectionError,
			isConnected: state.connectionStatus === 'connected',
			connect: state.connect,
			disconnect: state.disconnect,
			refresh: state.refreshConnection,
		}))
	)
}

export function usePolymarketMarkets() {
	return usePolymarketStore(
		useShallow((state) => ({
			markets: state.markets,
			loading: state.marketsLoading,
			error: state.marketsError,
			selectedMarket: state.selectedMarket,
			fetchMarkets: state.fetchMarkets,
			selectMarket: state.selectMarket,
			searchMarkets: state.searchMarkets,
		}))
	)
}

export function usePolymarketOrders() {
	return usePolymarketStore(
		useShallow((state) => ({
			orders: state.orders,
			loading: state.ordersLoading,
			error: state.ordersError,
			fetchOrders: state.fetchOrders,
			placeOrder: state.placeOrder,
			cancelOrder: state.cancelOrder,
			cancelAllOrders: state.cancelAllOrders,
		}))
	)
}

export function usePolymarketWallet() {
	return usePolymarketStore(
		useShallow((state) => ({
			balance: state.balance,
			accountInfo: state.accountInfo,
			loading: state.walletLoading,
			error: state.walletError,
			fetchWallet: state.fetchWallet,
			fetchAccountInfo: state.fetchAccountInfo,
		}))
	)
}

export function usePolymarketTransactions() {
	return usePolymarketStore(
		useShallow((state) => ({
			transactions: state.transactions,
			loading: state.transactionsLoading,
			error: state.transactionsError,
			fetchTransactions: state.fetchTransactions,
		}))
	)
}

