import { useState } from "react"
import moment from "moment"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

type LogEntry = {
	timestamp: string
	action: string
	data: any
	open: boolean
}

export default function useLog() {
	const [logEntries, setLogEntries] = useState<LogEntry[]>([])

	const addLog = (action: string, data: any) => {
		const entry = {
			// timestamp: new Date().toISOString(),
			// timestamp: new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 23),
			// timestamp: new Date().toLocaleString(undefined, { hour12: false }).replace(',', ''),
			timestamp: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
			action,
			data,
			open: true
		}
		setLogEntries(prev => [entry, ...prev])
	}

	const handleLogEntryClick = (entry: LogEntry) => {
		entry.open = !entry.open
		setLogEntries(prev => [...prev])
	}

	return {
		logView: () => (
			<div className="space-y-2">
			<div className="border rounded-md p-4 bg-muted/50 max-h-96 overflow-y-auto">
				<div className="flex items-center justify-between mb-2 border-b pb-2">
					<Label className="text-sm font-medium">Log View</Label>
					{logEntries.length > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="h-5 w-5"
							onClick={() => setLogEntries([])}
							title="Clear Log"
						>
							<X className="h-3 w-3" />
						</Button>
					)}
				</div>

				{logEntries.length === 0 ? (
					<div className="text-muted-foreground text-sm">No log entries yet...</div>
				) : (
					<div className="space-y-2 font-mono text-xs">
						{logEntries.map((entry, index) => (
							<div key={index} className="border-b pb-2 last:border-0">
								<div className="flex gap-2 mb-1 cursor-pointer" onClick={() => handleLogEntryClick(entry)}>
									<span className="text-muted-foreground">{entry.timestamp}</span>
									<span className="font-semibold">{entry.action}</span>
								</div>
								{entry.open && (
									<pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
										{JSON.stringify(entry.data, null, 2)}
									</pre>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
		),

		addLog
	}
}
