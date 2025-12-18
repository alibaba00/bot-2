missing ticker data:
day: 2025-12-12
from 1765509300000 03:15
to 1765510200000 03:30


Crypto-Price-Ticker:
https://docs.polymarket.com/developers/RTDS/RTDS-crypto-prices

 * Polymarket RTDS (Real-Time Data Socket) WebSocket Service
 * Handles real-time crypto price data via WebSocket
 * Documentation: https://docs.polymarket.com/developers/RTDS/RTDS-overview


init:
-> createMarketFromDate
	-> createMarket
		-> fetchMarketBySlugFromGamma
		-> cacheMarket
		-> saveMarket

-> setMarketState
		-> cacheMarket

-> connectMarket
-> pollingOpenPrice
		-> getCryptoPrice
		-> cacheMarket
		-> saveMarket

-> disconnectMarket
-> pollingClosePrice
		-> getCryptoPrice
		-> cacheMarket
		-> saveMarket

-> marketCompleted
