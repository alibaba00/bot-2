import { Button } from '@/components/ui/button'
import { db, downloadDatabase, importDatabase, importIntoDatabase } from '@/lib/db'
import { useRef } from 'react'

export default function DemoTab1() {
	const fileInputRef = useRef<HTMLInputElement>(null)
	const fileInputMergeRef = useRef<HTMLInputElement>(null)

	const handleExport = async () => {
		try {
			await downloadDatabase(`friends-backup-${new Date().toISOString().slice(0, 10)}.json`)
			alert('Datenbank erfolgreich exportiert!')
		} catch (error) {
			alert('Fehler beim Exportieren: ' + error)
		}
	}

	const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) return

		try {
			await importDatabase(file)
			alert('Datenbank erfolgreich importiert! (Alte Daten wurden überschrieben)')
			// Input zurücksetzen
			if (fileInputRef.current) fileInputRef.current.value = ''
		} catch (error) {
			alert('Fehler beim Importieren: ' + error)
		}
	}

	const handleImportMerge = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) return

		try {
			await importIntoDatabase(file)
			alert('Daten erfolgreich importiert! (Zu bestehenden Daten hinzugefügt)')
			// Input zurücksetzen
			if (fileInputMergeRef.current) fileInputMergeRef.current.value = ''
		} catch (error) {
			alert('Fehler beim Importieren: ' + error)
		}
	}

	return (
		<div className='p-4 space-y-4'>
			<div className='flex gap-2 flex-wrap'>
				<Button
					onClick={() => {
						db.friends.add({ name: 'Jane', age: 21, role: 'user' }) // Mit neuem role-Feld
					}}>
					Add User
				</Button>

				<Button
					onClick={() => {
						db.friends.add({ name: 'Admin Bob', age: 35, role: 'admin' }) // Admin hinzufügen
					}}
					variant='secondary'>
					Add Admin
				</Button>

				<Button
					onClick={() => {
						db.friends.toArray().then((friends) => {
							console.log('Alle Friends:', friends, db)
							console.table(friends) // Schönere Darstellung in der Console
						})
					}}
					variant='secondary'>
					Get All Friends
				</Button>

				<Button
					onClick={() => {
						// Nur Admins abrufen (filtert nach role)
						db.friends
							.where('role')
							.equals('admin')
							.toArray()
							.then((admins) => {
								console.log('Nur Admins:', admins)
							})
					}}
					variant='outline'>
					Get Admins Only
				</Button>

				<Button
					onClick={() => {
						db.friends.clear().then(() => {
							console.log('All friends deleted')
						})
					}}
					variant='destructive'>
					Clear All
				</Button>
			</div>

			<div className='border-t pt-4'>
				<h3 className='font-semibold mb-2'>Datenbank Export/Import</h3>
				<div className='flex gap-2 flex-wrap'>
					<Button onClick={handleExport} variant='outline'>
						📥 Datenbank exportieren
					</Button>

					<Button onClick={() => fileInputRef.current?.click()} variant='outline'>
						📤 Datenbank importieren (überschreiben)
					</Button>
					<input
						ref={fileInputRef}
						type='file'
						accept='.json'
						onChange={handleImport}
						style={{ display: 'none' }}
					/>

					<Button onClick={() => fileInputMergeRef.current?.click()} variant='outline'>
						📤 Daten hinzufügen (zusammenführen)
					</Button>
					<input
						ref={fileInputMergeRef}
						type='file'
						accept='.json'
						onChange={handleImportMerge}
						style={{ display: 'none' }}
					/>
				</div>
			</div>
		</div>
	)
}

/*
	const newData = {
		test: existing?.test ? existing.test + 1 : 0,
		value: Math.random(),
		list: [1, 2, 3],
		object: {
			number: Math.random(),
			date: new Date().toISOString(),
		},
		boolean: true,
	};
*/
