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
import { getOpenOrders } from "@/lib/polymarket/orders";


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

	// const handleSetOrder = async () => {
	// 	console.log('handleSetOrder ...')
	// 	const conditionId = '0xb44e63b37ed73f1ce8e69a8ed4f894e27ca7dcaf2b112f0e16876c1c07d1f390';
	// 	const price = 0.0001;
	// 	const size = 1;
	// 	const side = Side.BUY;

	// 	// await setOrder(conditionId, price, size, side);
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