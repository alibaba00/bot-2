// db.ts
import Dexie, { type EntityTable } from 'dexie'
import { exportDB, importDB, importInto } from 'dexie-export-import'
import type { Market, Order, Transaction } from './polymarket/types'

interface Friend {
	id: number
	name: string
	age: number
	role?: string // Neues Feld (optional für bestehende Einträge)
}

// Polymarket database interfaces
interface MarketRecord extends Market {
	id: string // Market ID from Polymarket
	cachedAt: number // Timestamp when cached
}

interface OrderRecord extends Order {
	id: string // Order ID from Polymarket
	syncedAt: number // Timestamp when synced
}

interface TransactionRecord extends Transaction {
	id: string // Transaction ID/hash
	syncedAt: number // Timestamp when synced
}

interface TradingStrategy {
	id?: number
	name: string
	description?: string
	config: Record<string, any>
	active: boolean
	createdAt: number
	updatedAt: number
}

const db = new Dexie('TradingBotDatabase') as Dexie & {
	friends: EntityTable<Friend, 'id'>
	markets: EntityTable<MarketRecord, 'id'>
	orders: EntityTable<OrderRecord, 'id'>
	transactions: EntityTable<TransactionRecord, 'id'>
	tradingStrategies: EntityTable<TradingStrategy, 'id'>
}

// Schema declaration:
// Version 1: Original structure
db.version(1).stores({
	friends: '++id, name, age'
})

// Version 2: Added 'role' field
db.version(2)
	.stores({
		friends: '++id, name, age, role'
	})
	.upgrade((tx) => {
		return tx
			.table('friends')
			.toCollection()
			.modify((friend) => {
				if (!friend.role) {
					friend.role = 'user'
				}
			})
	})

// Version 3: Added Polymarket tables
db.version(3).stores({
	friends: '++id, name, age, role',
	markets: 'id, active, closed, cachedAt',
	orders: 'id, marketId, status, side, createdAt, syncedAt',
	transactions: 'id, hash, marketId, type, status, timestamp, syncedAt',
	tradingStrategies: '++id, name, active, createdAt'
})

// Export-Funktion: Exportiert die gesamte Datenbank als Blob
export async function exportDatabase(): Promise<Blob> {
	try {
		const blob = await exportDB(db)
		return blob
	} catch (error) {
		console.error('Fehler beim Exportieren der Datenbank:', error)
		throw error
	}
}

// Download-Funktion: Lädt die Datenbank als Datei herunter
export async function downloadDatabase(filename: string = 'database-export.json'): Promise<void> {
	try {
		const blob = await exportDatabase()
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
		console.log('Datenbank erfolgreich heruntergeladen:', filename)
	} catch (error) {
		console.error('Fehler beim Herunterladen der Datenbank:', error)
		throw error
	}
}

// Import-Funktion: Importiert eine Datenbank aus einer Datei (überschreibt die aktuelle DB)
export async function importDatabase(file: File): Promise<void> {
	try {
		await db.delete() // Aktuelle Datenbank löschen
		await importDB(file)
		console.log('Datenbank erfolgreich importiert')
		// DB neu öffnen
		await db.open()
	} catch (error) {
		console.error('Fehler beim Importieren der Datenbank:', error)
		throw error
	}
}

// Import-Into-Funktion: Fügt Daten aus einer Datei zur bestehenden DB hinzu (ohne zu überschreiben)
export async function importIntoDatabase(file: File): Promise<void> {
	try {
		await importInto(db, file, {
			acceptMissingTables: true,
			overwriteValues: false
		})
		console.log('Daten erfolgreich in die bestehende Datenbank importiert')
	} catch (error) {
		console.error('Fehler beim Importieren in die Datenbank:', error)
		throw error
	}
}

export type { Friend, MarketRecord, OrderRecord, TransactionRecord, TradingStrategy }
export { db }
