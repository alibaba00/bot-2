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
