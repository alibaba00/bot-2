/**
 * Polyfills for Node.js modules in Electron renderer
 * These are needed because @polymarket/clob-client uses Node.js modules
 */

// Check if we're in Electron
const isElectron =
	typeof window !== 'undefined' &&
	(window as any).navigator?.userAgent?.includes('Electron') &&
	(window as any).require

if (isElectron) {
	const nodeRequire = (window as any).require

	try {
		// Make Node.js modules available globally
		if (!globalThis.process) {
			globalThis.process = nodeRequire('process')
		}

		if (!globalThis.Buffer) {
			globalThis.Buffer = nodeRequire('buffer').Buffer
		}

		// Polyfill EventEmitter
		if (!globalThis.EventEmitter) {
			const { EventEmitter } = nodeRequire('events')
			globalThis.EventEmitter = EventEmitter
		}

		// Make sure global is available
		if (typeof global === 'undefined') {
			;(globalThis as any).global = globalThis
		}

		// Polyfill exports for CommonJS modules
		if (typeof exports === 'undefined') {
			;(globalThis as any).exports = {}
		}

		// Polyfill module for CommonJS
		if (typeof module === 'undefined') {
			;(globalThis as any).module = { exports: (globalThis as any).exports }
		}
	} catch (e) {
		console.warn('Could not load Node.js polyfills:', e)
	}
}

export {}
