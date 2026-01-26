// import { Button } from "@/components/ui/button";
// import { fetchMarket, fetchMarketBySlugFromGamma, fetchMarketPricesFromClob, fetchMarkets } from "@/lib/polymarket/markets";
// import { getOpenOrders } from "@/lib/polymarket/orders";
import { usePolymarketConnection } from "@/lib/polymarket/store";
// import { getTransactionHistory, getWalletBalance } from "@/lib/polymarket/wallet";
// import { Side } from "@polymarket/clob-client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getAccountInfo, getTransactionHistory, getWalletBalance } from "@/lib/polymarket/wallet";
import { fetchMarketBySlugFromGamma, fetchMarkets } from "@/lib/polymarket/markets";
import { cancelOrder, getOpenOrders, placeOrder } from "@/lib/polymarket/orders";
// import { Side } from "@polymarket/clob-client";


export default function TradingPage() {
	const { status, connect } = usePolymarketConnection()

	useEffect(() => {
		// handleConnect()
	}, [])

	const handleConnect = async () => {	
		console.log('handleConnect ...')
		await connect()		
	}

	// --- get Account Info
	const handleGetAccountInfo = async () => {
		console.log('handleGetAccountInfo ...')
		const accountInfo = await getAccountInfo();
		console.log(accountInfo);
	}

	// --- get wallet balance
	const handleGetBalance = async () => {
		console.log('handleGetBalance ...')
		const balance = await getWalletBalance();
		console.log(balance);
	}

	// --- get orders
	const handleGetOrders = async () => {
		console.log('handleGetOrders ...')
		const orders = await getOpenOrders();
		console.log(orders);
	}

	// --- get transaction history
	const handleGetTrades = async () => {
		console.log('handleGetTrades ...')
		// View your trade history
		const transactions = await getTransactionHistory();
		console.log(`You've made ${transactions.length} trades`);
		console.log(transactions);
	}

	// --- fetch markets
	const handleFetchMarkets = async () => {
		console.log('handleFetchMarkets ...')
		const markets = await fetchMarkets();
		console.log(markets);
	}

	// --- fetch market by slug from gamma
	// https://gamma-api.polymarket.com/markets/slug/elon-musk-of-tweets-january-26-january-28-90-114
	const handleFetchMarketBySlugFromGamma = async () => {
		console.log('handleFetchMarketBySlugFromGamma ...')
		const market = await fetchMarketBySlugFromGamma('elon-musk-of-tweets-january-26-january-28-90-114');
		console.log(market);
	}

	// --- set order
	const handleSetOrder = async () => {
		console.log('handleSetOrder ...')
		// Market + YES token from Gamma
		const conditionId = '0x81cf3f03aa3f2a297485df5855df13364628b07823fd27f71077d88d42233a86';
		const yesTokenId = '50214305297176962065773245512961547550198516374144624237468290586352509598213';
		const price = 0.2;		//price per share
		const size = 10;		//10 shares
		// const side = Side.BUY;

		const order = await placeOrder({
			marketId: conditionId,
			price: price,
			quantity: size,
			side: 'BUY',
			outcome: 'YES',
			outcomeId: yesTokenId
		});
		console.log(order);
	}

	// --- cancel order
	const handleCancelOrder = async () => {
		console.log('handleCancelOrder ...')
		// const orderId = '0x3eb73f7df073f02049648d90871d2d411b2f3c4eefd3c8d84ea7d344d0a37f03';
		const orders = await getOpenOrders();
		const orderId = orders[0].id;
		console.log('orderId:', orderId);
		const order = await cancelOrder(orderId);
		console.log('order:', order);
	}

	// const handleFetchMarketFromConditionId = async () => {
	// 	console.log('handleFetchMarketFromConditionId ...')
	// 	const conditionId = '0xb44e63b37ed73f1ce8e69a8ed4f894e27ca7dcaf2b112f0e16876c1c07d1f390';
	// 	const prices = await fetchMarketPricesFromClob(conditionId);
	// 	console.log(prices);
	// }

	// const handleFetchMarket = async () => {
	// 	console.log('handleFetchMarket ...')
	// 	const conditionId = '0xb44e63b37ed73f1ce8e69a8ed4f894e27ca7dcaf2b112f0e16876c1c07d1f390';
	// 	const market = await fetchMarket(conditionId);
	// 	console.log(market);
	// }


	console.log('status:', status)

	return (
		<div className="flex flex-col gap-2 p-4">
			<h1>Trading Page</h1>
			<div className="flex gap-2 flex-wrap">
				<Button variant='default' onClick={handleConnect}>Connect to Polymarket</Button>
				<Button variant='default' onClick={handleGetAccountInfo}>Get Account Info</Button>
				<Button variant='default' onClick={handleGetBalance}>Get Balance</Button>
				<Button variant='default' onClick={handleGetOrders}>Get Orders</Button>
				<Button variant='default' onClick={handleGetTrades}>Get Trades</Button>
				<Button variant='default' onClick={handleFetchMarkets}>Fetch Markets</Button>
				<Button variant='default' onClick={handleFetchMarketBySlugFromGamma}>Fetch Market By Slug From Gamma</Button>
				<Button variant='default' onClick={handleSetOrder}>Set Order</Button>
				<Button variant='default' onClick={handleCancelOrder}>Cancel Order</Button>
			</div>
				{/* <Button onClick={() => {
					handleFetchMarketBySlugFromGamma()
				}}>get market by slug from gamma</Button>
				<Button onClick={() => {
					handleFetchMarketFromConditionId()
				}}>get market from condition id</Button>
				<Button onClick={() => {
					handleFetchMarket()
				}}>fetch market</Button>
				<Button onClick={() => {
					handleSetOrder()
				}}>set order</Button> */}
		</div>
	)
}