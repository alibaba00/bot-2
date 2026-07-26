/**
 * order.js — Polymarket Order CLI via @polymarket/clob-client-v2
 * Usage: node order.js <balance|orders|place|cancel> [args...]
 *
 * Liest Credentials aus secrets.env
 */

const path = require('path');
const dotenv = require('dotenv');

const { ClobClient, Side } = require('@polymarket/clob-client-v2');
const { createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const SIGNATURE_TYPE = 1;

async function main() {
    const envPath = 'C:/Users/ali/AppData/Local/hermes/profiles/trader/secrets.env';
    dotenv.config({ path: envPath });
    
    const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
    const userId = process.env.POLYMARKET_USER_ID;
    const proxy = process.env.POLYMARKET_PROXY_ADDRESS || 'https://clob.polymarket.com';
    
    if (!privateKey) {
        console.error('❌ No POLYMARKET_PRIVATE_KEY in', envPath);
        process.exit(1);
    }
    
    const account = privateKeyToAccount(privateKey);
    const signer = createWalletClient({
        account,
        transport: http('https://polygon-rpc.com')
    });
    
    const apiKey = process.env.POLYMARKET_API_KEY;
    const apiSecret = process.env.POLYMARKET_API_SECRET;
    const apiPassphrase = process.env.POLYMARKET_PASSPHRASE;
    const creds = (apiKey && apiSecret && apiPassphrase)
        ? { key: apiKey, secret: apiSecret, passphrase: apiPassphrase }
        : null;
    
    const client = new ClobClient({
        host: proxy,
        chain: 137,
        signer,
        signatureType: SIGNATURE_TYPE,
        funderAddress: userId,
        creds
    });
    
    try {
        if (!creds) {
            const newCreds = await client.createOrDeriveApiKey();
            console.log('✅ API Key:', newCreds.key);
            console.log('✅ Secret:', newCreds.secret);
            console.log('✅ Passphrase:', newCreds.passphrase);
        }
        
        const mode = process.argv[2];
        
        if (mode === 'balance') {
            const balance = await client.getBalanceAllowance();
            console.log('✅ Balance:', JSON.stringify(balance, null, 2));
        } else if (mode === 'orders') {
            const orders = await client.getOpenOrders();
            console.log('✅ Open Orders:', JSON.stringify(orders, null, 2));
        } else if (mode === 'place') {
            const side = process.argv[3];
            const price = parseFloat(process.argv[4]);
            const size = parseFloat(process.argv[5]);
            const tokenId = process.argv[6];
            if (!side || !price || !size || !tokenId) {
                console.error('Usage: node order.js place <BUY|SELL> <price> <size> <token_id>');
                process.exit(1);
            }
            console.log(`Placing ${side}: ${size} shares @ ${price} on ${tokenId.substring(0, 16)}...`);
            const result = await client.createAndPostOrder(
                { tokenID: tokenId, price, size, side: Side[side] },
                { tickSize: '0.01', negRisk: false }
            );
            console.log('✅ Result:', JSON.stringify(result, null, 2));
            // Robust, machine-parseable order id on its own line so the
            // Python adapter can always extract it (even if the full
            // JSON shape changes upstream).
            const oid = result && (result.orderID || result.orderId || result.id || result.order_id);
            if (oid) {
                console.log('ORDER_ID:' + oid);
            }
        } else if (mode === 'cancel') {
            const orderId = process.argv[3];
            if (orderId) {
                await client.cancelOrder(orderId);
                console.log('✅ Cancelled:', orderId);
            } else {
                await client.cancelAll();
                console.log('✅ All orders cancelled');
            }
        } else {
            console.log('Usage:');
            console.log('  node order.js balance               - Wallet-Balance');
            console.log('  node order.js orders                - Offene Orders');
            console.log('  node order.js place BUY 0.65 100 ID - Order platzieren');
            console.log('  node order.js cancel [id]           - Stornieren');
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
        if (err.response?.data) console.error('   Response:', JSON.stringify(err.response.data).substring(0, 300));
        process.exit(1);
    }
}

main();
