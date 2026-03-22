import type { MarketData } from "@/lib/polymarket/types";
import { useCLOBMarketWebSocket } from "@/hooks/use-clob-market-websocket";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";

type PriceEntry = { price: number; timestamp: number };

const TICKER_FLUSH_MS = 150;

export type LastTrade = {
	price: number;
	size: number;
	side: "BUY" | "SELL" | undefined;
	outcome_id: string;
	outcome_title: string;
	timestamp: number;
	transaction_hash?: string;
}

export default function ClobMarketTicker({ market, onUpdate, autoConnect, onTime }:
	{ market: MarketData, onUpdate?: (lastTrade: LastTrade) => void, autoConnect?: boolean, onTime?: (restSeconds: number) => void }) {
	const [marketPrices, setMarketPrices] = useState<Record<string, PriceEntry>>({});
	const [lastTradePrices, setLastTradePrices] = useState<
		Record<
			string,
			LastTrade
		>
	>({});
	const [assetIds, setAssetIds] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);
const autoReconnectRef = useRef<boolean | undefined>(autoConnect);


useEffect(() => {
	autoReconnectRef.current = autoConnect;
	if (autoConnect && status === "disconnected") {
		connect();
	}else if (!autoConnect && status === "connected") {
		disconnect();
	}
}, [autoConnect]);

	const assetIdsRef = useRef<string[]>([]);
	useEffect(() => {
		assetIdsRef.current = assetIds;
	}, [assetIds]);

	const pendingLastTradesRef = useRef<Record<string, LastTrade>>({});
	const pendingPricesRef = useRef<Record<string, PriceEntry>>({});
	const flushScheduledRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const normalizedOutcomesRef = useRef<Array<{ id: string; title: string; price: number }>>([]);

	const flushPendingUpdates = useCallback(() => {
		flushScheduledRef.current = null;
		const trades = pendingLastTradesRef.current;
		const prices = pendingPricesRef.current;
		if (Object.keys(trades).length > 0) {
			pendingLastTradesRef.current = {};
			setLastTradePrices((prev) => ({ ...prev, ...trades }));
		}
		if (Object.keys(prices).length > 0) {
			pendingPricesRef.current = {};
			setMarketPrices((prev) => ({ ...prev, ...prices }));
		}
		setError(null);
	}, []);

	const scheduleFlush = useCallback(() => {
		if (flushScheduledRef.current !== null) return;
		flushScheduledRef.current = setTimeout(flushPendingUpdates, TICKER_FLUSH_MS);
	}, [flushPendingUpdates]);

	const { connect, disconnect, updateAssetIds, status } = useCLOBMarketWebSocket({
		assetIds,
		onPriceUpdate: (update) => {
			const currentAssetIds = assetIdsRef.current;
			if (!currentAssetIds.includes(update.asset_id)) return;

			pendingPricesRef.current[update.asset_id] = {
				price: update.price,
				timestamp: update.timestamp
			};
			scheduleFlush();
		},
		onLastTradePriceUpdate: (update) => {
			const outcomes = normalizedOutcomesRef.current;
			const outcome = outcomes.find((o) => o.id === update.asset_id);
			if (!outcome) return;

			const lastTrade: LastTrade = {
				price: update.price,
				size: update.size,
				side: update.side,
				outcome_id: update.asset_id,
				outcome_title: outcome?.title?.toLowerCase(),
				timestamp: update.timestamp,
				transaction_hash: update.transaction_hash
			};
			onUpdate?.(lastTrade);

			pendingLastTradesRef.current[update.asset_id] = lastTrade;
			scheduleFlush();
		},
		onError: (err) => {
			setError(err.message || "CLOB Market WebSocket error");
		},
		autoConnect: false
	});

	const { normalizedOutcomes, marketAssetIds } = useMemo(() => {
		if (!market) return { normalizedOutcomes: [], marketAssetIds: [] as string[] };

		// console.log('---ClobMarketTicker: useMemo: market changed!', market.slug)
		const sourceData = (market as any).sourceData ?? market;

		const parseStringArray = (value: unknown): string[] => {
			if (Array.isArray(value)) {
				return value.map((item) => String(item)).filter(Boolean);
			}
			if (typeof value === "string") {
				try {
					const parsed = JSON.parse(value);
					return Array.isArray(parsed)
						? parsed.map((item) => String(item)).filter(Boolean)
						: [];
				} catch {
					return [];
				}
			}
			return [];
		};

		const clobTokenIds = parseStringArray(
			(market as any).clobTokenIds ?? sourceData?.clobTokenIds
		);
		const outcomeTitles = parseStringArray(
			(market as any).outcomes ?? sourceData?.outcomes
		);
		const outcomePricesRaw = parseStringArray(
			(market as any).outcomePrices ?? sourceData?.outcomePrices
		);
		const outcomePrices = outcomePricesRaw.map((price) => {
			const parsed = Number(price);
			return Number.isFinite(parsed) ? parsed : 0;
		});

		const outcomes =
			Array.isArray((market as any).outcomes) && (market as any).outcomes.length > 0
				? (market as any).outcomes
				: outcomeTitles.map((title, index) => ({
						id: clobTokenIds[index] || `${index}`,
						title,
						price: outcomePrices[index] ?? 0
				  }));

		return { normalizedOutcomes: outcomes, marketAssetIds: clobTokenIds };
	}, [market]);

	normalizedOutcomesRef.current = normalizedOutcomes;

	const canToggle =
		status === "connected" || (assetIds.length > 0 && status === "disconnected");
	const handleToggle = () => {
		if (status === "connected") {
			autoReconnectRef.current = false;
			disconnect();
			return;
		}
		if (status === "disconnected" && assetIds.length > 0) {
			autoReconnectRef.current = true;
			connect();
		}
	};

	useEffect(() => {
		if (!market || normalizedOutcomes.length === 0) return;

		// console.log('---ClobMarketTicker: market changed!', market.slug, normalizedOutcomes)
		// Do not overwrite autoReconnectRef here: on first mount status is "disconnected", which
		// would clear the default true and block the assetIds effect from calling connect().
		disconnect();

		const ids =
			marketAssetIds.length > 0
				? marketAssetIds
				: normalizedOutcomes.map((outcome) => outcome.id).filter(Boolean);
		setAssetIds(ids);

		const initialPrices: Record<string, PriceEntry> = {};
		normalizedOutcomes.forEach((outcome) => {
			if (outcome.id) {
				initialPrices[outcome.id] = {
					price: outcome.price,
					timestamp: Date.now()
				};
			}
		});
		setMarketPrices(initialPrices);
	}, [market]);


	useEffect(() => {
		if (assetIds.length === 0) return;
		updateAssetIds(assetIds);
		if (autoReconnectRef.current && status === "disconnected") {
			connect();
		}
	}, [assetIds, connect, status, updateAssetIds]);


	useEffect(() => {
		// start reconnect if market has not started yet
		if (!autoReconnectRef.current
			&& market?.endTimestamp
			&& Date.now() < market.endTimestamp - market.timeFrame * 60000) {
			autoReconnectRef.current = true;
			connect();
		}

		return () => {
			if (flushScheduledRef.current !== null) {
				clearTimeout(flushScheduledRef.current);
				flushScheduledRef.current = null;
			}
		};
	}, []);


	const formattedOutcomes = useMemo(() => {
		if (!market || normalizedOutcomes.length === 0) return [];
		return normalizedOutcomes.map((outcome) => {
			const lastTrade = lastTradePrices[outcome.id];
			const livePrice = marketPrices[outcome.id]?.price;
			const price = lastTrade?.price ?? livePrice ?? outcome.price;
			const timestamp =
				lastTrade?.timestamp ?? marketPrices[outcome.id]?.timestamp ?? null;
			return {
				id: outcome.id,
				title: outcome.title,
				price,
				side: lastTrade?.side,
				size: lastTrade?.size,
				timestamp
			};
		});
	}, [lastTradePrices, market, marketPrices]);

	if (!market) {
		return (
			<div className="text-sm text-muted-foreground">Kein Markt geladen.</div>
		);
	}


	// ---------------------------------------------------------------------------- onTime
	const onMarketTime = (restSeconds: number) => {
		// console.log('--- ClobMarketTicker: onTime:', restSeconds)
		onTime?.(restSeconds)

		// if (restSeconds >= market.timeFrame * 60 && !autoReconnectRef.current) {
		// 	autoReconnectRef.current = true;
		// 	connect();
		// }

		if (restSeconds <= -10 && autoReconnectRef.current) {
			autoReconnectRef.current = false;
			disconnect();
		}
	}


	// https://polymarket.com/event/btc-updown-15m-1771711200
	return (
		// <div className="flex flex-col gap-3 rounded-md border border-black/10 dark:border-white/10 p-3 flex-1 min-w-80">
		<div className="flex flex-col gap-3 flex-1 min-w-80">
			<div className="flex flex-row justify-between gap-1 w-full items-start">
				<div className="flex flex-col gap-1">
					<div className="text-sm font-medium">{market.question}</div>
					<div className="text-xs text-muted-foreground flex items-center gap-1">
						{market.slug} <ExternalLink className="w-3 h-3 cursor-pointer" onClick={(e) => {
							e.stopPropagation()
							window.open(`https://polymarket.com/event/${market.slug}`, '_blank')
							// window.open(`google-chrome://https://polymarket.com/event/${market.slug}`)
						}} />
					</div>
				</div>
				<div className="flex items-center gap-3">
					<MarketTimer market={market} onTime={onMarketTime} />
					<div
						className={`text-xs ${
							status === "connected" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
						}`}>
						{status}
					</div>
					<button
						type="button"
						onClick={handleToggle}
						disabled={!canToggle}
						className="rounded-md border border-black/10 dark:border-white/10 px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{status === "connected" ? "Ticker stoppen" : "Ticker starten"}
					</button>
				</div>
				{assetIds.length === 0 && (
					<div className="text-xs text-muted-foreground">
						Keine Outcomes/Asset-IDs gefunden.
					</div>
				)}
				{error && (
					<div className="text-xs text-red-600 dark:text-red-400">
						{error}
					</div>
				)}
			</div>

			<div className="flex flex-row gap-2">
				{formattedOutcomes?.map((outcome) => (
					<div
						key={outcome.id}
						className="flex flex-1 items-center justify-between gap-3 rounded-md bg-black/5 dark:bg-white/5 px-3 py-2"
						>
						<div className="flex flex-col">
							<span className="text-sm font-medium">{outcome.title}</span>
							<span className="text-xs text-muted-foreground">
								{outcome.timestamp
									? new Date(outcome.timestamp).toLocaleTimeString()
									: "keine Updates"}
								{outcome.side ? ` · ${outcome.side}` : ""}
								{outcome.size ? ` · Size ${outcome.size.toFixed(3)}` : ""}
							</span>
						</div>
						<div className="text-lg tabular-nums">
							{outcome.price.toFixed(4)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}


// ---------------------------------------------------------------------------- MarketTimer (for TradingBotItem)
const MarketTimer = ({market, onTime}: {market: MarketData | undefined, onTime?: (restSeconds: number) => void}) => {
	const timeout = useRef<NodeJS.Timeout | undefined>(undefined)
	const [time, setTime] = useState<string>('00:00')


	useEffect(() => {
		console.log('--- MarketTimer:', market)

		clearTimeout(timeout.current)
		setTimeString()

		return () => clearTimeout(timeout.current)
	}, [market])


	const setTimeString = () => {
		if (!market?.endTimestamp) return setTime('00:00')

		const now = Date.now()
		const diff = Math.round((market.endTimestamp - now) / 1000)	//diff in seconds
		const hours = Math.floor(diff / 3600)
		const minutes = Math.floor((diff % 3600) / 60)
		const seconds = diff % 60
		const timeString = diff < 0 ?
			'-' + Math.abs(minutes+1).toString().padStart(2, '0') + ':' + Math.abs(seconds).toString().padStart(2, '0')
			: minutes < 60 ?
			`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
			: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

		setTime(timeString)
		onTime?.(diff)

		let msec = 1000 - (now % 1000);
		if (msec < 100) msec += 1000;
		timeout.current = setTimeout(() => setTimeString(), msec)
	}

	if (!market) return null

	return (
		<div className="text-sm font-bold text-yellow-500 border border-yellow-500/30 rounded-sm px-2 py-0.5 bg-yellow-500/10">{time}</div>
	)
}
