// ─────────────────────────────────────────────────────────────────────────────
// SignalCard — signal badge, confidence bar, trade details, confluence checklist
// ─────────────────────────────────────────────────────────────────────────────

import { CONFLUENCE_ITEMS } from "../types";
import type { AnalysisResult, Signal } from "../types";

function signalStyles(signal: Signal): { label: string; classes: string } {
  switch (signal) {
    case "BUY":
      return { label: "BUY", classes: "bg-buy/15 text-buy border-buy/40" };
    case "SELL":
      return { label: "SELL", classes: "bg-sell/15 text-sell border-sell/40" };
    default:
      return { label: "NO TRADE", classes: "bg-notrade/15 text-text-secondary border-notrade/40" };
  }
}

function confidenceColor(confidence: number): string {
  if (confidence >= 9) return "bg-buy";
  if (confidence >= 7) return "bg-lime-400";
  if (confidence >= 5) return "bg-gold";
  return "bg-sell";
}

function DetailCell({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-card-border bg-bg/40 px-3 py-2">
      <p className="text-[0.65rem] uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-text-primary tabular-nums">
        {value}
      </p>
    </div>
  );
}

export function SignalCard({ analysis }: { analysis: AnalysisResult }): JSX.Element {
  const sig = signalStyles(analysis.signal);
  const pct = Math.max(0, Math.min(100, (analysis.confidence / 10) * 100));

  return (
    <div className="space-y-5 rounded-xl border border-card-border bg-card p-5 animate-fade-in">
      {/* Signal badge + confidence */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className={["rounded-xl border px-6 py-3 text-2xl font-extrabold tracking-wide", sig.classes].join(" ")}
        >
          {sig.label}
        </div>
        <div className="flex-1 sm:max-w-md">
          <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
            <span>Confidence</span>
            <span className="font-mono font-semibold text-text-primary">
              {analysis.confidence}/10
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-bg">
            <div
              className={["h-full rounded-full transition-all", confidenceColor(analysis.confidence)].join(" ")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Trade details */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <DetailCell label="Entry" value={analysis.entry_price.toFixed(2)} />
        <DetailCell label="SL" value={analysis.sl_price.toFixed(2)} />
        <DetailCell label="TP" value={analysis.tp_price.toFixed(2)} />
        <DetailCell label="RR Ratio" value={`${analysis.rr_ratio.toFixed(2)}R`} />
        <DetailCell label="SL pips" value={String(analysis.sl_pips)} />
        <DetailCell label="TP pips" value={String(analysis.tp_pips)} />
        <DetailCell label="Lot" value={String(analysis.lot)} />
      </div>

      {/* Confluence checklist */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
          Confluence Checklist
        </p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {CONFLUENCE_ITEMS.map((item) => {
            const ok = analysis.confluence[item.key];
            return (
              <div
                key={item.key}
                className="flex items-center gap-2 rounded-md border border-card-border bg-bg/40 px-3 py-1.5 text-sm"
              >
                <span className={ok ? "text-buy" : "text-notrade"}>{ok ? "✓" : "✗"}</span>
                <span className={ok ? "text-text-primary" : "text-text-secondary"}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
