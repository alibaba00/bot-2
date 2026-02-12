# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

price-ticker:

kraken:
wss://ws.kraken.com

binance:
wss://ws-api.binance.com:443/ws-api/v3

chainlink:
wss://bridge.chain.link/btc/usd

polling:
https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT
https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT
https://api.binance.com/api/v3/ticker/price?symbol=XRPUSDT

binanceDirect:
wss://ws-api.binance.com:443/ws-api/v3

coinbase:
wss://ws-feed.exchange.coinbase.com

kraken:
wss://ws.kraken.com

binance:
wss://ws-api.binance.com:443/ws-api/v3

-----------------

real utc-price tickers ab 2026-01-29 15:00:00
first: btc-updown-15m-1769698800

timestamp:1769698800


-> handle combined trade
	-> fetch market data
	-> determine outcome title
	-> find outcome token ID
	-> place buy order
	-> store active combined trade info for auto-sell
	-> update orders after placing
	-> execute sell order automatically
	-> clear active combined trade
	-> update orders after placing
	-> update balance
	-> update trades

