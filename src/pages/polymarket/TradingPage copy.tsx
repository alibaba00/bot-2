// import { Button } from "@/components/ui/button";
// import { fetchMarket, fetchMarketBySlugFromGamma, fetchMarketPricesFromClob, fetchMarkets } from "@/lib/polymarket/markets";
// import { getOpenOrders } from "@/lib/polymarket/orders";
import { usePolymarketConnection } from "@/lib/polymarket/store";
// import { getTransactionHistory, getWalletBalance } from "@/lib/polymarket/wallet";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getWalletBalance } from "@/lib/polymarket/wallet";
import { getOpenOrders, placeOrder } from "@/lib/polymarket/orders";
import { 
	fetchMarkets, 
	fetchMarketBySlugFromGamma, 
	fetchMarket,
	fetchMarketPricesFromClob
} from "@/lib/polymarket/markets";

export default function TradingPage() {
	const { status, connect } = usePolymarketConnection()

	useEffect(() => {
		// handleConnect()
	}, [])

	const handleConnect = async () => {	
		console.log('handleConnect ...')
		await connect()		
	}

	// const handleGetTrades = async () => {
	// 	console.log('handleGetTrades ...')
	// 	// View your trade history
	// 	const transactions = await getTransactionHistory();
	// 	console.log(`You've made ${transactions.length} trades`);
	// 	console.log(transactions);
	// }

	const handleGetBalance = async () => {
		console.log('handleGetBalance ...')
		const balance = await getWalletBalance();
		console.log('Current wallet balance:', balance);
		// console.log('balance:', balance);
	}

	const handleGetOrders = async () => {
		console.log('handleGetOrders ...')
		const orders = await getOpenOrders();
		console.log(orders);
	}

	const handleFetchMarkets = async () => {
		console.log('handleFetchMarkets ...')
		const markets = await fetchMarkets();
		console.log(markets);
	}

	const handleFetchMarketBySlugFromGamma = async () => {
		console.log('handleFetchMarketBySlugFromGamma ...')
		const market = await fetchMarketBySlugFromGamma('elon-musk-of-tweets-january-16-january-23-380-399');
		console.log(market);
	}

	const handleFetchMarketFromConditionId = async () => {
		console.log('handleFetchMarketFromConditionId ...')
		const conditionId = '0xb44e63b37ed73f1ce8e69a8ed4f894e27ca7dcaf2b112f0e16876c1c07d1f390';
		const prices = await fetchMarketPricesFromClob(conditionId);
		console.log(prices);
	}

	const handleFetchMarket = async () => {
		console.log('handleFetchMarket ...')
		const conditionId = '0xb44e63b37ed73f1ce8e69a8ed4f894e27ca7dcaf2b112f0e16876c1c07d1f390';
		const market = await fetchMarket(conditionId);
		console.log(market);
		const prices = await fetchMarketPricesFromClob(conditionId);
		console.log(prices);
	}

	const handleSetOrder = async () => {
		console.log('handleSetOrder ...')
		const slug = 'btc-updown-4h-1769288400';
		const market = await fetchMarketBySlugFromGamma(slug);

		if (!market?.conditionId) {
			console.error(`Market not found or missing conditionId for slug: ${slug}`);
			return;
		}

		console.log('market:', market);

		const conditionId = market.conditionId;
		const price = 0.2;
		const size = 10;
		const outcome =
			market.outcomes.find((item) => item.title.toLowerCase() === 'up') ||
			market.outcomes[0];

		if (!outcome) {
			console.error('No outcomes found for market:', market);
			return;
		}

		const order = await placeOrder({
			marketId: conditionId,
			price: price,
			quantity: size,
			side: 'BUY',
			outcome: outcome.title,
			outcomeId: outcome.id
		});

		console.log('order:', order);
	}

	console.log('status:', status)

	return (
		<div className="flex flex-col gap-2 p-4">
			<h1>Trading Page</h1>
			<div className="flex gap-2 flex-wrap">
				<Button variant='default' onClick={handleConnect}>Connect to Polymarket</Button>
				<Button variant='default' onClick={handleGetBalance}>Get Balance</Button>
				<Button variant='default' onClick={handleGetOrders}>Get Orders</Button>
				<Button variant='default' onClick={handleFetchMarkets}>Fetch Markets</Button>
				<Button variant='default' onClick={handleFetchMarketBySlugFromGamma}>Fetch Market By Slug From Gamma</Button>
				<Button variant='default' onClick={handleFetchMarketFromConditionId}>Fetch Market From Condition Id</Button>
				<Button variant='default' onClick={handleFetchMarket}>Fetch Market</Button>
				<Button variant='default' onClick={handleSetOrder}>Set Order</Button>
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