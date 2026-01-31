import type { MarketData } from "@/lib/polymarket/types copy";
import { useCLOBMarketWebSocket } from "@/hooks/use-clob-market-websocket";
import { useEffect, useMemo, useRef, useState } from "react";

type PriceEntry = { price: number; timestamp: number };

export type LastTrade = {
	price: number;
	size: number;
	side: "BUY" | "SELL" | undefined;
	outcome_id: string;
	outcome_title: string;
	timestamp: number;
	transaction_hash?: string;
}

export default function ClobMarketTicker({ market, onUpdate }:
	{ market: MarketData, onUpdate?: (lastTrade: LastTrade) => void }) {
	const [marketPrices, setMarketPrices] = useState<Record<string, PriceEntry>>({});
	const [lastTradePrices, setLastTradePrices] = useState<
		Record<
			string,
			LastTrade
		>
	>({});
	const [assetIds, setAssetIds] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);
	const autoReconnectRef = useRef(false);

	const assetIdsRef = useRef<string[]>([]);
	useEffect(() => {
		assetIdsRef.current = assetIds;
	}, [assetIds]);

	const { connect, disconnect, updateAssetIds, status } = useCLOBMarketWebSocket({
		assetIds,
		onPriceUpdate: (update) => {
			const currentAssetIds = assetIdsRef.current;
			if (!currentAssetIds.includes(update.asset_id)) return;

			setMarketPrices((prev) => ({
				...prev,
				[update.asset_id]: {
					price: update.price,
					timestamp: update.timestamp
				}
			}));
			setError(null);
		},
		onLastTradePriceUpdate: (update) => {
			const outcome = normalizedOutcomes.find((outcome) => outcome.id === update.asset_id);
			if (!outcome) return;

			const lastTrade: LastTrade = {
				price: update.price,
				size: update.size,
				side: update.side,
				outcome_id: update.asset_id,
				outcome_title: outcome?.title.toLowerCase(),
				timestamp: update.timestamp,
				transaction_hash: update.transaction_hash
			}
			onUpdate?.(lastTrade)

			setLastTradePrices((prev) => ({
				...prev,
				[update.asset_id]: lastTrade
			}));
			setError(null);
		},
		onError: (err) => {
			setError(err.message || "CLOB Market WebSocket error");
		},
		autoConnect: false
	});

	const { normalizedOutcomes, marketAssetIds } = useMemo(() => {
		if (!market) return { normalizedOutcomes: [], marketAssetIds: [] as string[] };

		console.log('------------------------ ClobMarketTicker: useMemo: market changed!', market.slug)
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

		console.log('------------------------ ClobMarketTicker: market changed!', market.slug, normalizedOutcomes)
		autoReconnectRef.current = status === "connected" || status === "connecting";
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

	return (
		<div className="flex flex-col gap-3 rounded-md border border-black/10 dark:border-white/10 p-3 flex-1 min-w-80">
			<div className="flex flex-col gap-1">
				<div className="text-sm font-medium">{market.question}</div>
				<div className="text-xs text-muted-foreground">{market.slug}</div>
				<div className="flex items-center gap-3">
					<div className="text-xs text-muted-foreground">Status: {status}</div>
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

			<div className="flex flex-col gap-2">
				{formattedOutcomes?.map((outcome) => (
					<div
						key={outcome.id}
						className="flex items-center justify-between gap-3 rounded-md bg-black/5 dark:bg-white/5 px-3 py-2"
					>
						<div className="flex flex-col">
							<span className="text-sm font-medium">{outcome.title}</span>
							<span className="text-xs text-muted-foreground">
								{outcome.side ? `${outcome.side} · ` : ""}
								{outcome.size ? `Size ${outcome.size} · ` : ""}
								{outcome.timestamp
									? new Date(outcome.timestamp).toLocaleTimeString()
									: "keine Updates"}
							</span>
						</div>
						<div className="text-sm tabular-nums">
							{outcome.price.toFixed(4)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
