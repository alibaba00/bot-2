missing ticker data:
day: 2025-12-12
from 1765509300000 03:15
to 1765510200000 03:30


Crypto-Price-Ticker:
https://docs.polymarket.com/developers/RTDS/RTDS-crypto-prices

 * Polymarket RTDS (Real-Time Data Socket) WebSocket Service
 * Handles real-time crypto price data via WebSocket
 * Documentation: https://docs.polymarket.com/developers/RTDS/RTDS-overview


----------------------------
market trading process:

init:

CryptoTicker:
CryptoTickersPage:
marketItem:
-> createMarketFromDate
	-> createMarket
		-> fetchMarketBySlugFromGamma
		-> cacheMarket
		-> saveMarket

-> setMarketState
		-> cacheMarket

-> connectMarket
-> openMarket
		-> getCryptoPrice
		-> cacheMarket
		-> saveMarket

-> disconnectMarket
-> closeMarket
		-> getCryptoPrice
		-> cacheMarket
		-> saveMarket

-> marketCompleted-type


----------------------------
update process:

updateAllMarketData
	-> getAllMarkets
	updateMarketData
		-> createMarketFromSlug
		-> fetchMarketBySlug
---------
TODOS:

✔️ pending only till market ends
- add hours & daily markets
- add binance price polling
✔️ update data when market is finished (alle 15 min)
- add openTicker, closeTicker
- caching chart & strategy data
- webworker for file updates


----------------------------
Kurz und für’s Trading relevant:

Was du nicht als „Ausführungspreis“ nehmen solltest
price_changes → Feld price: Das ist der Preis der konkret geänderten Order (ein Level im Buch), nicht zwingend der Preis, zu dem du als Nächstes handelst. Gut für Buch-Updates, schlecht als alleinige Order-Referenz.
Was du für echte Ausführung brauchst
Kaufen (aggressiv, sofort füllen) → best_ask aus dem gleichen Kontext (aktueller bester Ask = was du zahlst, wenn du die Ask-Seite „nimmst“).
Verkaufen (aggressiv, sofort füllen) → best_bid (aktueller bester Bid = was du bekommst, wenn du die Bid-Seite „nimmst“).
best_bid / best_ask in den price_change-Objekten sind genau die Touch-Preise des Orderbuchs nach der jeweiligen Änderung – das ist die sinnvolle Echtzeit-Basis für „was kostet mich ein Marketable Buy/Sell jetzt“.

last_trade_price
Ist der Preis des letzten abgeschlossenen Trades – gut als Referenz (zuletzt gehandelt), aber:
kann kurz verzögert sein,
muss nicht mit dem aktuellen Touch übereinstimmen, sobald sich das Buch bewegt.
Fazit: Für ausführbare Entscheidungen in Echtzeit best_ask (Buy) und best_bid (Sell); optional last_trade_price nur ergänzend (Kontext), nicht als Ersatz für Bid/Ask. Die Mitte (best_bid + best_ask)/2 ist eher ein Indikator, kein garantierter Ausführungspreis.

(In eurem Code werden diese Felder aus price_change-Nachrichten in handlePriceChanges geparst; last_trade_price ist ein separates Event – siehe clob-market-websocket.ts.)

--------------------------------
last_trade_price:
{
    "market": "0x9440ffb2c61fc99d26b9e2aafa98a2788f0840dd5d489b7f666297eb11dde060",
    "asset_id": "58996621595566626344910782533109381327703705960528571559079746376466725827893",
    "price": "0.77",
    "size": "1.2987",
    "fee_rate_bps": "1000",
    "side": "BUY",
    "timestamp": "1775864365492",
    "event_type": "last_trade_price",
    "transaction_hash": "0x41d65e2f458815c64da19a39e7abe7584549dfcfcac7a8e4a0b6e5b75a875660"
}


price_changes:
{
    "market": "0x9440ffb2c61fc99d26b9e2aafa98a2788f0840dd5d489b7f666297eb11dde060",
    "price_changes": [
        {
            "asset_id": "82490216337783439933522749267412323222818218980267524326067321148188791342484",
            "price": "0.01",
            "size": "5565",
            "side": "BUY",
            "hash": "6b52ee3df25063a2a2b8dba2f00710554f25da8e",
            "best_bid": "0.24",
            "best_ask": "0.26"
        },
        {
            "asset_id": "58996621595566626344910782533109381327703705960528571559079746376466725827893",
            "price": "0.99",
            "size": "5565",
            "side": "SELL",
            "hash": "13f5c7c23980125d59ee2ef6e5c4c87f417fb032",
            "best_bid": "0.74",
            "best_ask": "0.76"
        }
    ],
    "timestamp": "1775864373089",
    "event_type": "price_change"
}


--------------------------------
clob-bit/ask prices ab:
2026-04-03 13:00:00 (slug: 1775214000)

no glitches ab:
2026-05-04 15:30:00 (slug: 1777901400)
