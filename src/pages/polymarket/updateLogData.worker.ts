// Web Worker for running updateLogData logic off the main thread

declare const self: DedicatedWorkerGlobalScope & typeof globalThis;

const isElectron =
	typeof self !== 'undefined' &&
	typeof self.navigator !== 'undefined' &&
	typeof (self as any).require === 'function' &&
	self.navigator.userAgent.includes('Electron');

const fs = isElectron ? (self as any).require?.('fs') : null;
const fsPromises = isElectron ? (self as any).require?.('fs/promises') : null;

const logDataSources: Record<string, { importPath: string; exportPath: string }> = {
	clob: {
		importPath: 'H:/DEV/TRADE/POLY/bot-3/logs/clob',
		exportPath: 'A:/DATA/polymarket/',
	},
	chainlink: {
		importPath: 'H:/DEV/PY/polymarket/chainlink_price_ticker/logs/chainlink',
		exportPath: 'A:/DATA/polymarket/chainlink/',
	},
	binance: {
		importPath: 'H:/DEV/PY/polymarket/binance_price_ticker/logs/binance',
		exportPath: 'A:/DATA/polymarket/binance/',
	},
	polling: {
		importPath: 'H:/DEV/PY/polymarket/binance_polling_ticker/logs/binance',
		exportPath: 'A:/DATA/polymarket/binance-polling/',
	},
	coinbase: {
		importPath: 'H:/DEV/PY/polymarket/coinbase_price_ticker/logs/coinbase',
		exportPath: 'A:/DATA/polymarket/coinbase/',
	},
	kraken: {
		importPath: 'H:/DEV/PY/polymarket/kraken_price_ticker/logs/kraken',
		exportPath: 'A:/DATA/polymarket/kraken/',
	},
};

self.onmessage = async (event: MessageEvent) => {
	if (!event.data || event.data.type !== 'run') return;

	const logDataType: string = event.data.logDataType ?? 'clob';
	const config = logDataSources[logDataType];

	if (!config) {
		self.postMessage({
			type: 'error',
			error: `Unknown log data type: ${logDataType}`,
		});
		self.postMessage({ type: 'done' });
		return;
	}

	if (!fs || !fsPromises) {
		self.postMessage({
			type: 'error',
			error: 'fs or fsPromises not available in worker environment',
		});
		self.postMessage({ type: 'done' });
		return;
	}

	try {
		self.postMessage({ type: 'log', args: ['Updating log data:', logDataType] });

		const { importPath, exportPath } = config;
		const importList = await fsPromises.readdir(importPath, {
			withFileTypes: true,
			recursive: true,
		} as any);

		const stat = {
			exists: 0,
			updatedFiles: 0,
			newFiles: 0,
		};

		for (const entry of importList) {
			if (entry.isDirectory() || !entry.name.endsWith('.csv')) continue;

			const path = entry.path.replaceAll('\\', '/');
			const filePath = path + '/' + entry.name;
			const symbol =
				logDataType === 'clob' ? path.split('logs/')[1] : path.split('/').pop();
			const exportDir = exportPath + symbol;
			const exportFile = exportDir + '/' + entry.name;

			if (fs.existsSync(exportFile)) {
				stat.exists++;
				const exportCreatedAt = fs.statSync(exportFile).ctime;
				const importCreatedAt = fs.statSync(filePath).ctime;
				if (exportCreatedAt >= importCreatedAt) continue;

				stat.updatedFiles++;
				self.postMessage({ type: 'log', args: ['', 'update file:', exportFile] });
			} else {
				stat.newFiles++;
				self.postMessage({ type: 'log', args: ['export new file:', exportFile] });
			}

			if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
			await fsPromises.copyFile(filePath, exportFile);
		}

		self.postMessage({ type: 'log', args: ['stat:', stat] });
		self.postMessage({ type: 'done', stat });
	} catch (error: any) {
		self.postMessage({
			type: 'error',
			error: error?.message ?? String(error),
		});
		self.postMessage({ type: 'done' });
	}
};

export {};
