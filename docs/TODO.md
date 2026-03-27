* switch to db dexie
real utc-price tickers ab 2026-01-29 15:00:00
first: btc-updown-15m-1769698800

* sitch to final data target for logs (A:/DATA/polymarket/...)

* tabs for all symbols (btc, eth, sol, xrp)

* save trades to db and files

* load and save trade from endpoint

* find out the right starttime on polymarket

* webworker? (for performance)

* show wallet balance

* edit price investment

* show transaction history

* online/mobile-dahsboard

* close trade before market ends

* code splitting for trading app

* trade-mode: none | up | down | up-and-down | up-or-down


wss://ws-subscriptions-clob.polymarket.com/ws/market
last_trade_price
{
    "market": "0xf07da0c8c6911549e0c5ceb565f2799548ef83a0883ae7cb2acc70da3bb7971e",
    "asset_id": "7718732804779432076693595396379147486297386645444554630113753530831895894559",
    "price": "0.2",
    "size": "6.19",
    "fee_rate_bps": "1000",
    "side": "SELL",
    "timestamp": "1774612297100",
    "event_type": "last_trade_price",
    "transaction_hash": "0xac4e765b5546bc17c7087a002870971c105babb354d4e4873008906f5e23dd9e"
}


price_change
{
    "market": "0xcb6bb3ef8e49a0bb06b9a5bc189c8bdcd55851ec82230585388beaa83f7104a1",
    "price_changes": [
        {
            "asset_id": "46309986580834629872052649585174845364275641035313378253238650633639050239804",
            "price": "0.53",
            "size": "16",
            "side": "BUY",
            "hash": "3572545fd3f073b9df3be42ce2b0f37558f2ee56",
            "best_bid": "0.54",
            "best_ask": "0.56"
        },
        {
            "asset_id": "58371917098904379849156711529744337352963568550576966929646361745810188748747",
            "price": "0.47",
            "size": "16",
            "side": "SELL",
            "hash": "22977f5852044c87b4419eba55cad47c93b04994",
            "best_bid": "0.44",
            "best_ask": "0.46"
        }
    ],
    "timestamp": "1774625245133",
    "event_type": "price_change"
}