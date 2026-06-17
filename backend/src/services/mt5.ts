// ─────────────────────────────────────────────────────────────────────────────
// MT5 bridge client — talks to bridge.py through the ngrok/Cloudflare tunnel
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BridgeStatus,
  Candle,
  OpenPosition,
  Timeframe,
  TradeRequest,
  TradeResult,
} from "../types";

const BRIDGE_URL = (process.env.MT5_BRIDGE_URL || "").replace(/\/+$/, "");

export class BridgeOfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BridgeOfflineError";
  }
}

const OFFLINE_HINT =
  "MT5 bridge offline. Make sure bridge.py is running on your Windows PC and ngrok/Cloudflare tunnel is active.";

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function ensureBridgeConfigured(): void {
  if (!BRIDGE_URL) {
    throw new BridgeOfflineError(
      "MT5_BRIDGE_URL is not configured on the backend. Set it to your ngrok/Cloudflare tunnel URL.",
    );
  }
}

/** Status snapshot from the bridge. Short timeout — used by /status (cron keep-warm). */
export async function getStatus(timeoutMs = 5000): Promise<BridgeStatus> {
  ensureBridgeConfigured();
  try {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/status`, { method: "GET" }, timeoutMs);
    if (!res.ok) {
      throw new BridgeOfflineError(`Bridge /status returned HTTP ${res.status}`);
    }
    return (await res.json()) as BridgeStatus;
  } catch (err) {
    if (err instanceof BridgeOfflineError) throw err;
    throw new BridgeOfflineError(OFFLINE_HINT);
  }
}

export async function getCandles(
  symbol: string,
  tf: Timeframe,
  count: number,
  timeoutMs = 15000,
): Promise<Candle[]> {
  ensureBridgeConfigured();
  const url = `${BRIDGE_URL}/candles?symbol=${encodeURIComponent(symbol)}&tf=${tf}&count=${count}`;
  try {
    const res = await fetchWithTimeout(url, { method: "GET" }, timeoutMs);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new BridgeOfflineError(`Bridge /candles ${tf} failed: HTTP ${res.status} ${body}`);
    }
    return (await res.json()) as Candle[];
  } catch (err) {
    if (err instanceof BridgeOfflineError) throw err;
    throw new BridgeOfflineError(OFFLINE_HINT);
  }
}

export async function placeTrade(req: TradeRequest, timeoutMs = 20000): Promise<TradeResult> {
  ensureBridgeConfigured();
  try {
    const res = await fetchWithTimeout(
      `${BRIDGE_URL}/trade`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      },
      timeoutMs,
    );
    const data = (await res.json().catch(() => null)) as TradeResult | null;
    if (!data) {
      throw new BridgeOfflineError("Bridge /trade returned an unparseable response");
    }
    return data;
  } catch (err) {
    if (err instanceof BridgeOfflineError) throw err;
    throw new BridgeOfflineError(OFFLINE_HINT);
  }
}

export async function getOpenPositions(
  symbol = "XAUUSD",
  timeoutMs = 10000,
): Promise<OpenPosition[]> {
  ensureBridgeConfigured();
  const url = `${BRIDGE_URL}/open-positions?symbol=${encodeURIComponent(symbol)}`;
  try {
    const res = await fetchWithTimeout(url, { method: "GET" }, timeoutMs);
    if (!res.ok) {
      throw new BridgeOfflineError(`Bridge /open-positions failed: HTTP ${res.status}`);
    }
    return (await res.json()) as OpenPosition[];
  } catch (err) {
    if (err instanceof BridgeOfflineError) throw err;
    throw new BridgeOfflineError(OFFLINE_HINT);
  }
}

export async function closePosition(
  ticket: number,
  timeoutMs = 20000,
): Promise<{ success: boolean; comment: string }> {
  ensureBridgeConfigured();
  try {
    const res = await fetchWithTimeout(
      `${BRIDGE_URL}/close-position`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
      },
      timeoutMs,
    );
    const data = (await res.json().catch(() => null)) as
      | { success: boolean; comment: string }
      | null;
    if (!data) {
      throw new BridgeOfflineError("Bridge /close-position returned an unparseable response");
    }
    return data;
  } catch (err) {
    if (err instanceof BridgeOfflineError) throw err;
    throw new BridgeOfflineError(OFFLINE_HINT);
  }
}
