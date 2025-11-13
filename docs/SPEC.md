# Polymarket Trading-Bot Specification

Erstelle mir eine Projekt-Planung und eine Spezifikation für einen Trading-Bot für die Polymarket Plattform.
Der Bot soll in einem Desktop-Client laufen und eine GUI haben.
Die Applikation ist als Electron Desktop app unter Windows Vorkonfiguriert.
NodeIntegration und Sandboxing sind bereits aktiviert.
Teste die Applikation auf mögliche Laufzeitfehler und Fehler in der GUI.
Verwende die bestehende DashboardPage.tsx als Basis für die Polymarket DashboardPage.
Die Registrierung auf Polymarket ist über die Email-Adresse erfolgt.
Die Credentials sind in der .env Datei gespeichert und werden ausgelesen.
Beginne mit der Implementierung der Core Features und erweitere dann.


## Aktuelles Framework & Technologien:
- node v24.6.0
- typescript
- react
- vite
- electron
- tailwindcss
- shadcn/ui
- zustand
- localforage
- dexie


## Funktionen:
- Login mit Polymarket
- Auslesen der Markt-Daten
- Trading-Strategie
- visualisieren der Markt-Daten
- Order-Placement
- Order-Status
- Wallet-Status
- Transaction-History


## API Keys (Environment Variables in der .env Datei):
USER_ID
POLYMARKET_PROXY_ADDRESS
PUBLIC_KEY
PRIVATE_KEY


## Linklist:
- Polymarket Website:
https://polymarket.com/

- Polymarket Documentation:
https://docs.polymarket.com/polymarket-learn/get-started/what-is-polymarket

- Polymarket API Documentation:
https://docs.polymarket.com/quickstart/introduction/main

- Polymarket CLOB Client:
https://github.com/Polymarket/clob-client

- Polymarket Builder Relayer Client:
https://github.com/Polymarket/builder-relayer-client


