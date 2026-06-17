# VoxTrade — MT5 Bridge

A local Flask server that exposes your MetaTrader 5 (Exness) terminal over HTTP so
the hosted VoxTrade backend can fetch candles and place trades on your account.

This must run on the **Windows PC** where MetaTrader 5 is installed and logged in.

## Setup

1. Install [Python 3.10+](https://www.python.org/downloads/) and
   [MetaTrader 5](https://www.metatrader5.com/) (log in to your Exness account).
2. Install dependencies:
   ```bat
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and fill in your credentials:
   ```
   MT5_LOGIN=12345678
   MT5_PASSWORD=your_password
   MT5_SERVER=Exness-MT5Real
   BRIDGE_PORT=5001
   ```
4. Start the bridge by double-clicking **`start.bat`** (or `python bridge.py`).

## Exposing the bridge to the internet

The hosted backend cannot reach `localhost`, so tunnel it:

**ngrok**
```bat
ngrok http 5001
```
Copy the `https://....ngrok-free.app` URL into the backend's `MT5_BRIDGE_URL`.

**Cloudflare Tunnel** (recommended — stable URL)
```bat
cloudflared tunnel --url http://localhost:5001
```
Copy the `https://....trycloudflare.com` URL into the backend's `MT5_BRIDGE_URL`.

## Production

Use waitress instead of the Flask dev server:
```bat
waitress-serve --port=5001 bridge:app
```

## Endpoints

| Method | Path              | Description                                  |
|--------|-------------------|----------------------------------------------|
| GET    | `/status`         | Connection + account snapshot (always 200)   |
| GET    | `/candles`        | OHLCV — `?symbol=XAUUSD&tf=H1&count=100`      |
| POST   | `/trade`          | Place market order with SL/TP in pips        |
| GET    | `/open-positions` | Open positions — `?symbol=XAUUSD`            |
| POST   | `/close-position` | Close a position — `{ "ticket": 12345 }`     |

> **Note:** For XAUUSD, 1 pip = `0.10`. All SL/TP offsets use this.

## Troubleshooting

- **Login fails:** double-check `MT5_SERVER` (e.g. `Exness-MT5Real` or
  `Exness-MT5Trial`) and that the terminal allows automated/algo trading.
- **`/status` shows `connected: false`:** the terminal may be closed or logged
  out. The bridge keeps running and retries the connection on each request.
- **Trades rejected:** ensure "Algo Trading" is enabled in the MT5 toolbar.
