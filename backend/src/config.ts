// ─────────────────────────────────────────────────────────────────────────────
// Backend configuration constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The MT5 trading symbol. Brokers expose gold under slightly different tickers
 * (e.g. Exness standard = "XAUUSD", Exness cent/raw = "XAUUSDm"). Configure via
 * the SYMBOL env var; defaults to "XAUUSDm".
 */
export const SYMBOL = process.env.SYMBOL || "XAUUSDm";
