/**
 * React hook for crypto price polling (HTTP fallback)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { CryptoPricePoller } from '@/lib/polymarket/crypto-price-poller'
import type { CryptoPriceUpdate, CryptoPriceSource } from '@/lib/polymarket/crypto-price-poller'

export interface UseCryptoPricePollerOptions {
	source?: CryptoPriceSource
	symbols?: string[]
	onPriceUpdate?: (update: CryptoPriceUpdate) => void
	onError?: (error: Error) => void
	autoStart?: boolean
}

export interface UseCryptoPricePollerReturn {
	start: () => void
	stop: () => void
	updateSymbols: (symbols: string[]) => void
	updateSource: (source: CryptoPriceSource) => void
	status: 'stopped' | 'polling'
}

export function useCryptoPricePoller(
	options: UseCryptoPricePollerOptions = {}
): UseCryptoPricePollerReturn {
	const {
		source = 'binance',
		symbols = [],
		onPriceUpdate,
		onError,
		autoStart = false
	} = options

	const pollerRef = useRef<CryptoPricePoller | null>(null)
	const [status, setStatus] = useState<'stopped' | 'polling'>('stopped')

	// Create poller instance on mount
	useEffect(() => {
		pollerRef.current = new CryptoPricePoller(source, symbols, {
			onPriceUpdate: (update) => {
				onPriceUpdate?.(update)
			},
			onError: (error) => {
				console.error('CryptoPricePoller error:', error)
				onError?.(error)
			}
		})

		// Auto-start if enabled
		if (autoStart) {
			pollerRef.current.start()
			setStatus('polling')
		}

		// Cleanup on unmount
		return () => {
			if (pollerRef.current) {
				pollerRef.current.stop()
				pollerRef.current = null
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []) // Only run on mount

	// Update symbols when they change
	useEffect(() => {
		if (pollerRef.current) {
			pollerRef.current.updateSymbols(symbols)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [symbols.join(',')])

	// Update source when it changes
	useEffect(() => {
		if (pollerRef.current) {
			pollerRef.current.updateSource(source)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [source])

	// Update status periodically
	useEffect(() => {
		const interval = setInterval(() => {
			if (pollerRef.current) {
				setStatus(pollerRef.current.getStatus())
			}
		}, 1000)

		return () => clearInterval(interval)
	}, [])

	const start = useCallback(() => {
		if (pollerRef.current) {
			pollerRef.current.start()
			setStatus('polling')
		}
	}, [])

	const stop = useCallback(() => {
		if (pollerRef.current) {
			pollerRef.current.stop()
			setStatus('stopped')
		}
	}, [])

	const updateSymbols = useCallback((newSymbols: string[]) => {
		if (pollerRef.current) {
			pollerRef.current.updateSymbols(newSymbols)
		}
	}, [])

	const updateSource = useCallback((newSource: CryptoPriceSource) => {
		if (pollerRef.current) {
			pollerRef.current.updateSource(newSource)
		}
	}, [])

	return {
		start,
		stop,
		updateSymbols,
		updateSource,
		status
	}
}

