<!-- 5c30b39f-6fb5-40d3-9112-e201617d7552 0692b22e-6ec7-4cf5-996d-b54c988b2c99 -->
# Polymarket Trading Bot Implementation Plan

## Overview

Build a comprehensive Polymarket trading bot desktop application using the existing Electron + React + TypeScript stack. Implement core trading features starting with manual order placement and market data visualization, then expand to automated trading strategies.

## Architecture Decisions

- Use **CLOB Client** for direct trading (can add Builder Relayer later)
- Start with **manual order placement** (user-driven trading)
- **Authentication**: Load API keys from .env file, show connection status in UI
- Store trading data in Dexie database (orders, transactions, market data cache)
- Use Zustand for application state management

## Implementation Steps

### Phase 1: Core Infrastructure & Setup

#### 1.1 Environment & Configuration

- Create `.env.example` file with required variables (USER_ID, POLYMARKET_PROXY_ADDRESS, PUBLIC_KEY, PRIVATE_KEY)
- Update `vite.config.ts` to expose environment variables to renderer process
- Create `src/lib/polymarket/config.ts` to load and validate Polymarket credentials
- Add environment variable validation on app startup

#### 1.2 Install Dependencies

- Install `@polymarket/clob-client` package
- Install additional dependencies if needed (axios, ethers.js for wallet operations)
- Update `package.json` with new dependencies

#### 1.3 Database Schema (Dexie)

- Update `src/lib/db.ts` with Polymarket-specific tables:
  - `markets`: Store market data with caching
  - `orders`: Store order history and status
  - `transactions`: Store transaction history
  - `tradingStrategies`: Store strategy configurations (for future use)
- Add database migrations for versioning

### Phase 2: Polymarket API Integration

#### 2.1 Polymarket Client Service

- Create `src/lib/polymarket/client.ts`:
  - Initialize CLOB client with credentials from .env
  - Implement connection status checking
  - Handle authentication errors gracefully
- Create `src/lib/polymarket/types.ts` for TypeScript interfaces

#### 2.2 Market Data Service

- Create `src/lib/polymarket/markets.ts`:
  - Fetch active markets from Polymarket API
  - Cache market data in Dexie
  - Implement market data refresh mechanism
  - Filter and search markets

#### 2.3 Order Management Service

- Create `src/lib/polymarket/orders.ts`:
  - Place buy/sell orders
  - Cancel orders
  - Query order status
  - Store orders in database

#### 2.4 Wallet & Account Service

- Create `src/lib/polymarket/wallet.ts`:
  - Fetch wallet balance
  - Get account information
  - Query transaction history

### Phase 3: State Management

#### 3.1 Polymarket Store (Zustand)

- Create `src/lib/polymarket/store.ts`:
  - Connection status state
  - Current markets state
  - Active orders state
  - Wallet balance state
  - Transaction history state
  - Loading/error states

### Phase 4: UI Components

#### 4.1 Dashboard Page (`src/pages/polymarket/DashboardPage.tsx`)

- Convert from `.jsx` to `.tsx`
- Implement main dashboard layout with sections:
  - Connection status indicator
  - Wallet balance card
  - Active markets list/table
  - Recent orders table
  - Quick stats (P&L, open positions, etc.)

#### 4.2 Market Data Components

- Create `src/components/polymarket/MarketList.tsx`:
  - Display markets in a table/card view
  - Market search and filtering
  - Market details modal/sheet
- Create `src/components/polymarket/MarketCard.tsx`:
  - Individual market display with odds, volume, etc.

#### 4.3 Order Components

- Create `src/components/polymarket/OrderForm.tsx`:
  - Buy/sell order form
  - Price input (yes/no odds)
  - Quantity input
  - Order type selection (limit/market)
  - Order preview and confirmation
- Create `src/components/polymarket/OrderList.tsx`:
  - Display active and historical orders
  - Order status indicators
  - Cancel order functionality

#### 4.4 Wallet Components

- Create `src/components/polymarket/WalletStatus.tsx`:
  - Display wallet balance
  - Available balance vs. locked balance
  - Transaction history link

#### 4.5 Navigation Updates

- Update `src/pages/StartPage.tsx`:
  - Add Polymarket sub-pages to navigation:
    - Dashboard (main)
    - Markets (browse all markets)
    - Orders (order management)
    - History (transaction history)
    - Settings (trading settings)

### Phase 5: Error Handling & Testing

#### 5.1 Error Handling

- Implement error boundaries for Polymarket components
- Add user-friendly error messages
- Handle API rate limits and connection errors
- Log errors appropriately

#### 5.2 Runtime Testing

- Test app startup with missing .env variables
- Test connection to Polymarket API
- Test order placement flow (with small test orders)
- Test UI responsiveness and error states
- Verify Electron-specific functionality (file access, etc.)

### Phase 6: Future Enhancements (Out of Scope for Initial Implementation)

- Automated trading strategies
- Advanced charting/visualization
- Strategy backtesting
- Alerts and notifications
- Export/import trading data

## File Structure

```
src/
├── lib/
│   ├── polymarket/
│   │   ├── config.ts          # Configuration & env loading
│   │   ├── client.ts          # CLOB client initialization
│   │   ├── markets.ts         # Market data fetching
│   │   ├── orders.ts          # Order management
│   │   ├── wallet.ts          # Wallet & account operations
│   │   ├── store.ts           # Zustand store for Polymarket state
│   │   └── types.ts           # TypeScript interfaces
│   └── db.ts                  # Updated with Polymarket tables
├── components/
│   └── polymarket/
│       ├── MarketList.tsx
│       ├── MarketCard.tsx
│       ├── OrderForm.tsx
│       ├── OrderList.tsx
│       └── WalletStatus.tsx
└── pages/
    └── polymarket/
        ├── DashboardPage.tsx   # Main dashboard (convert to TSX)
        ├── MarketsPage.tsx     # Browse markets
        ├── OrdersPage.tsx      # Order management
        └── HistoryPage.tsx     # Transaction history
```

## Key Implementation Notes

- All API calls should be wrapped in try-catch with proper error handling
- Use React Query or similar for data fetching and caching (optional, can use useEffect + Zustand)
- Implement loading states for all async operations
- Use shadcn/ui components for consistent UI
- Follow existing code patterns (Store.ts, component structure)
- Ensure Electron security: validate all user inputs before API calls
- Add TypeScript types for all Polymarket API responses

## Testing Checklist

- [ ] App starts without errors
- [ ] Environment variables load correctly
- [ ] Polymarket connection establishes successfully
- [ ] Market data displays correctly
- [ ] Orders can be placed (test with minimal amounts)
- [ ] Orders can be cancelled
- [ ] Wallet balance displays correctly
- [ ] Transaction history loads
- [ ] Error states display user-friendly messages
- [ ] UI is responsive and works in Electron window

### To-dos

- [ ] Set up environment variable loading and validation (.env.example, config.ts, vite.config updates)
- [ ] Install Polymarket CLOB client and required dependencies
- [ ] Update Dexie database schema with Polymarket tables (markets, orders, transactions)
- [ ] Create Polymarket client service with authentication and connection management
- [ ] Implement market data fetching service with caching
- [ ] Implement order placement and management service
- [ ] Implement wallet balance and transaction history service
- [ ] Create Zustand store for Polymarket state management
- [ ] Convert DashboardPage to TypeScript and implement main dashboard UI
- [ ] Create market list and market card components
- [ ] Create order form and order list components
- [ ] Create wallet status component
- [ ] Update navigation with Polymarket sub-pages
- [ ] Implement comprehensive error handling and user feedback
- [ ] Test runtime errors, GUI functionality, and Electron-specific features