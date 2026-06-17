# ⚡ VoxTrade

An AI-powered XAUUSD (Gold) trading system. Click **Analyze & Trade** on a hosted
dashboard; VoxTrade pulls live multi-timeframe MT5 candles, asks Gemini for a deep
**Smart Money Concepts (SMC) + Price Action** analysis, and — if a high-probability
setup is found — automatically places the trade on your Exness MT5 account.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VoxTrade  Architecture                            │
└─────────────────────────────────────────────────────────────────────────────┘

   User (Chrome on Windows)
        │  clicks "Analyze & Trade"
        ▼
   ┌──────────────────────┐        ┌──────────────────────────┐
   │  Frontend (Vercel)   │  HTTPS │   Backend (Render)        │
   │  React + Vite + TQ   │ ─────► │   Fastify + TypeScript    │
   │  Tailwind / Zustand  │        │   /analyze /status /stats │
   └──────────────────────┘        │   /history                │
                                    └────────────┬──────────────┘
                                                 │
                       ┌─────────────────────────┼──────────────────────────┐
                       │                         │                          │
                       ▼                         ▼                          ▼
              ┌─────────────────┐      ┌────────────────────┐     ┌─────────────────┐
              │  Gemini API     │      │  ngrok / Cloudflare │     │  SQLite (better │
              │  2.0 Flash      │      │  Tunnel             │     │  -sqlite3)      │
              │  SMC analysis   │      └─────────┬──────────┘     │  trade history  │
              └─────────────────┘                │                └─────────────────┘
                                                 ▼
                                       ┌────────────────────┐
                                       │  bridge.py (Flask)  │
                                       │  localhost:5001     │
                                       │  Windows PC         │
                                       └─────────┬──────────┘
                                                 ▼
                                       ┌────────────────────┐
                                       │  MetaTrader 5       │
                                       │  Exness account     │
                                       │  → trade executed   │
                                       └────────────────────┘

   cron-job.org ──(GET /status every 10 min)──► Render backend  (prevents cold starts)
```

---

## How the SMC + Price Action analysis works

Gemini is prompted to think like an institutional trader and analyze top-down:
**H1 for bias → M15 for the setup → M5 for entry.**

It looks for:

- **Liquidity sweeps** — price wicks above buy-side liquidity (BSL) or below
  sell-side liquidity (SSL) to grab retail stops, then reverses. The reversal is the
  setup trigger.
- **Order Blocks (OB)** — the last opposing candle before a strong impulse. Only
  *unmitigated* OBs in the direction of bias are tradable.
- **Fair Value Gaps (FVG)** — 3-candle imbalances price tends to return and fill.
- **CHoCH / BOS** — Change of Character (reversal) and Break of Structure
  (continuation) define market structure.
- **Premium / discount zones** — sell from premium (upper 50% of a swing), buy from
  discount (lower 50%).
- **Price Action confirmation** — engulfing candles, pin bars, momentum candles, plus
  PDH/PDL, PWH/PWL and round numbers.

Each present factor adds **+1** to a **confluence score** (max 10). A trade is only
placed when the score meets the backend's `CONFIDENCE_THRESHOLD` (default **7**);
otherwise the result is `NO_TRADE`.

---

## Prerequisites

- **Linux / Mac (for development & deploys):** Node.js 18+, Git
- **Windows PC (runs the MT5 bridge):** Python 3.10+, MetaTrader 5 (logged in to
  Exness), and **ngrok** *or* **Cloudflare Tunnel**

---

## Setup — Part A: Windows PC (MT5 Bridge)

1. Clone the repo.
2. `cd mt5-bridge`
3. `pip install -r requirements.txt`
4. Copy `.env.example` to `.env` and fill in your MT5 login, password, and server:
   ```
   MT5_LOGIN=12345678
   MT5_PASSWORD=your_password
   MT5_SERVER=Exness-MT5Real
   BRIDGE_PORT=5001
   ```
5. Double-click **`start.bat`** to run the bridge (you should see
   `MT5 Bridge running on port 5001`).
6. Install **ngrok**: <https://ngrok.com/download>
7. Run: `ngrok http 5001`
8. Copy the HTTPS URL (e.g. `https://abc123.ngrok-free.app`).
9. **Alternative — Cloudflare Tunnel** (free, more stable URL):
   - Install `cloudflared`
   - Run: `cloudflared tunnel --url http://localhost:5001`
   - Copy the `https://....trycloudflare.com` URL.

---

## Setup — Part B: Deploy Backend to Render

1. Push the code to GitHub.
2. Create a new **Web Service** on [render.com](https://render.com), connect the repo,
   and set the root directory to **`backend/`** (the included `render.yaml` already
   configures build/start commands).
3. Set environment variables:
   - `GEMINI_API_KEY` — your Google Gemini API key
   - `MT5_BRIDGE_URL` — the ngrok / Cloudflare URL from Part A
   - `FRONTEND_URL` — your Vercel app URL (for CORS)
   - `CONFIDENCE_THRESHOLD` — defaults to `7`
4. Deploy.
5. Copy your Render backend URL (e.g. `https://voxtrade-backend.onrender.com`).

---

## Setup — Part C: Deploy Frontend to Vercel

1. Import the repo on [vercel.com](https://vercel.com), set the root directory to
   **`frontend/`**.
2. Set the environment variable `VITE_BACKEND_URL` to your Render backend URL.
3. Deploy. (`vercel.json` already handles SPA rewrites.)

---

## Setup — Part D: Keep the Backend Warm (cron-job.org)

Render's free tier sleeps after inactivity. Keep it warm:

1. Go to [cron-job.org](https://cron-job.org) and create a free account.
2. Create a new cronjob with URL = `https://your-backend.onrender.com/status`.
3. Set the interval to **every 10 minutes**.
4. Enable and save.

The `/status` endpoint always returns HTTP 200 (even if the bridge is offline), so the
ping keeps Render awake without erroring.

---

## How to trade

1. Boot into Windows.
2. Open MetaTrader 5 and log in to your Exness account (enable **Algo Trading**).
3. Double-click **`start.bat`** in the `mt5-bridge` folder.
4. Start the tunnel: `ngrok http 5001` (or `cloudflared tunnel --url http://localhost:5001`).
5. If the ngrok URL changed, update `MT5_BRIDGE_URL` in your Render env vars.
6. Open your Vercel app URL in Chrome.
7. Verify the green **MT5 Connected** status in the header (balance + equity shown).
8. Click **⚡ Analyze & Trade**.

The dashboard shows the signal, confidence bar, full confluence checklist, Gemini's
reasoning, and — if a trade was placed — the order ticket. Every analysis is saved to
the history table.

---

## ⚠️ WARNING

**Test on a demo account first.** Never risk real money until you have validated at
least **20 signals** manually. Automated trading carries significant risk; you are
solely responsible for any trades placed on your account.

---

## Production tips

- Use **Cloudflare Tunnel** instead of ngrok for a stable URL that never changes (so
  you don't have to keep updating `MT5_BRIDGE_URL`).
- Use **pm2** to keep the Node backend running if you self-host:
  `pm2 start dist/index.js --name voxtrade-backend`.
- Run the bridge with **waitress** instead of the Flask dev server in production:
  ```bat
  waitress-serve --port=5001 bridge:app
  ```

---

## Project layout

```
voxtrade/
├── frontend/     React + Vite dashboard (deploy to Vercel)
├── backend/      Fastify API + Gemini + SQLite (deploy to Render)
└── mt5-bridge/   Flask bridge to MetaTrader 5 (runs on Windows)
```

## API reference (backend)

| Method | Path        | Description                                    |
|--------|-------------|------------------------------------------------|
| GET    | `/status`   | Backend + bridge health (always 200)           |
| POST   | `/analyze`  | Fetch candles → Gemini analysis → maybe trade  |
| GET    | `/history`  | Recent analyses — `?limit=20&offset=0`         |
| GET    | `/stats`    | Aggregate stats (total, traded, avg conf/RR)   |
