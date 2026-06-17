// ─────────────────────────────────────────────────────────────────────────────
// TradeResultBadge — outcome panel: placed / no-trade / failed
// ─────────────────────────────────────────────────────────────────────────────

import { CONFLUENCE_ITEMS } from "../types";
import type { AnalyzeResponse } from "../types";

const THRESHOLD = 7;

function topMissingFactor(response: AnalyzeResponse): string {
  const missing = CONFLUENCE_ITEMS.find((item) => !response.analysis.confluence[item.key]);
  return missing ? missing.label : "no confluence data";
}

export function TradeResultBadge({ response }: { response: AnalyzeResponse }): JSX.Element {
  const { analysis, tradeResult, trade_placed, error_message } = response;

  // Trade placed successfully.
  if (trade_placed && tradeResult && tradeResult.success) {
    return (
      <div className="rounded-xl border border-buy/40 bg-buy/10 px-5 py-4 text-buy animate-fade-in">
        <p className="font-semibold">
          ✓ Trade Placed — Order #{tradeResult.order} at {tradeResult.price.toFixed(2)}
        </p>
        <p className="mt-1 text-sm text-buy/80">
          SL: {tradeResult.sl.toFixed(2)} | TP: {tradeResult.tp.toFixed(2)}
        </p>
      </div>
    );
  }

  // A trade was attempted but MT5 rejected it (signal valid + above threshold).
  const attempted =
    analysis.signal !== "NO_TRADE" && analysis.confidence >= THRESHOLD;
  if (attempted && (error_message || (tradeResult && !tradeResult.success))) {
    const comment = tradeResult?.comment || error_message || "Unknown error";
    return (
      <div className="rounded-xl border border-sell/40 bg-sell/10 px-5 py-4 text-sell animate-fade-in">
        <p className="font-semibold">✗ Trade Failed — {comment}</p>
      </div>
    );
  }

  // No trade — confidence below threshold or NO_TRADE signal.
  return (
    <div className="rounded-xl border border-notrade/40 bg-notrade/10 px-5 py-4 text-text-secondary animate-fade-in">
      <p className="font-semibold text-text-primary">
        — No Trade — Confidence {analysis.confidence}/10 (threshold: {THRESHOLD})
      </p>
      <p className="mt-1 text-sm">Top missing factor: {topMissingFactor(response)}</p>
    </div>
  );
}
