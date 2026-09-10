# Endpoints:

## Balance:
method: GET
url: https://clob.polymarket.com/balance-allowance?asset_type=COLLATERAL&signature_type=1

result:
{
    "balance": "230003177",
    "allowances": {
        "0xE111180000d2663C0091e4f400237545B87B996B": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
        "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
        "0xe2222d279d744050d28e00520010520000310F59": "115792089237316195423570985008687907853269984665640564039457584007913129639935"
    }
}


## User Channel Websocket:
wss://ws-subscriptions-clob.polymarket.com/ws/user
{
    "type": "user",
    "auth": {
        "apiKey": "<ROTATE — leaked; never commit>",
        "secret": "<ROTATE — leaked; never commit>",
        "passphrase": "<ROTATE — leaked; never commit>"
    },
    "markets": []
}

### sample:
{
    "id": "0x6d177629496d6910eae3cbcf25fe054a47a79dd5248f35101a35279b4523dfec",
    "owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
    "market": "0x6e50bca713f4893e6a97e59230d818ad2d765c0c83864b9b92cfce1b4e56975f",
    "asset_id": "40760009086038782531283170378504210894878852203449565427744723441046050382829",
    "side": "BUY",
    "order_owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
    "original_size": "5",
    "size_matched": "0",
    "price": "0.98",
    "associate_trades": [],
    "outcome": "Down",
    "type": "PLACEMENT",
    "created_at": "1783509882",
    "expiration": "0",
    "order_type": "GTC",
    "status": "LIVE",
    "maker_address": "0xC41997C65144683AB62051EDd1f80B034756E588",
    "timestamp": "1783509882117",
    "event_type": "order"
}
{
    "id": "0x6d177629496d6910eae3cbcf25fe054a47a79dd5248f35101a35279b4523dfec",
    "owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
    "market": "0x6e50bca713f4893e6a97e59230d818ad2d765c0c83864b9b92cfce1b4e56975f",
    "asset_id": "40760009086038782531283170378504210894878852203449565427744723441046050382829",
    "side": "BUY",
    "order_owner": "5c377165-301f-d7cb-81b1-fb1f3baec608",
    "original_size": "5",
    "size_matched": "0",
    "price": "0.98",
    "associate_trades": [],
    "outcome": "Down",
    "type": "CANCELLATION",
    "created_at": "1783509882",
    "expiration": "0",
    "order_type": "GTC",
    "status": "CANCELED_MARKET_RESOLVED",
    "maker_address": "0xC41997C65144683AB62051EDd1f80B034756E588",
    "timestamp": "1783509986847",
    "event_type": "order"
}


## current positions:

method: GET
url: https://data-api.polymarket.com/positions?sizeThreshold=1&limit=100&sortBy=TOKENS&sortDirection=DESC&user=0xC41997C65144683AB62051EDd1f80B034756E588

result:
[
    {
        "proxyWallet": "0xc41997c65144683ab62051edd1f80b034756e588",
        "asset": "38048823786315073144633615287481514079563996658946721515934744138659135080559",
        "conditionId": "0x5a100616c380a15d4b6ecc3b11f81978828eda948163216cd2f80ce650e6f90a",
        "size": 10,
        "avgPrice": 0.95,
        "initialValue": 9.5,
        "currentValue": 0.05,
        "cashPnl": -9.45,
        "percentPnl": -99.4736,
        "totalBought": 10,
        "realizedPnl": 0,
        "percentRealizedPnl": -99.4736,
        "curPrice": 0.005,
        "redeemable": true,
        "mergeable": false,
        "title": "Ethereum Up or Down - July 8, 7:30AM-7:35AM ET",
        "slug": "eth-updown-5m-1783510200",
        "icon": "https://polymarket-upload.s3.us-east-2.amazonaws.com/ETH+fullsize.jpg",
        "eventId": "676544",
        "eventSlug": "eth-updown-5m-1783510200",
        "outcome": "Down",
        "outcomeIndex": 1,
        "oppositeOutcome": "Up",
        "oppositeAsset": "67434781044424245606099539316843698839798484995493512051221526190752421003808",
        "endDate": "2026-07-08",
        "negativeRisk": false
    }
]