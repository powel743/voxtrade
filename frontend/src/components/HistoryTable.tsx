// ─────────────────────────────────────────────────────────────────────────────
// HistoryTable — last analyses, independent of the analyze action; row -> modal
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHistory } from "../api/trade";
import { CONFLUENCE_ITEMS } from "../types";
import type { HistoryResponse, Signal, TradeRecord } from "../types";

const PAGE_SIZE = 20;

function signalPill(signal: Signal): string {
  switch (signal) {
    case "BUY":
      return "text-buy";
    case "SELL":
      return "text-sell";
    default:
      return "text-text-secondary";
  }
}

function rowBg(signal: Signal): string {
  switch (signal) {
    case "BUY":
      return "bg-buy/5 hover:bg-buy/10";
    case "SELL":
      return "bg-sell/5 hover:bg-sell/10";
    default:
      return "hover:bg-bg/40";
  }
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReasoningModal({
  record,
  onClose,
}: {
  record: TradeRecord;
  onClose: () => void;
}): JSX.Element {
  const rows: { label: string; value: string; danger?: boolean }[] = [
    { label: "H1 Bias & Structure", value: record.h1_bias },
    { label: "H1 Liquidity", value: record.h1_liquidity },
    { label: "M15 Setup", value: record.m15_setup },
    { label: "M15 Structure Alignment", value: record.m15_structure },
    { label: "M5 Entry Trigger", value: record.m5_entry },
    { label: "SL Rationale", value: record.sl_rationale },
    { label: "TP Rationale", value: record.tp_rationale },
    { label: "Invalidation Conditions", value: record.invalidation, danger: true },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-card-border bg-card p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-text-primary">
              <span className={signalPill(record.signal)}>{record.signal}</span> ·{" "}
              {fmtTime(record.timestamp)}
            </h3>
            <p className="text-sm text-text-secondary">
              Confidence {record.confidence}/10 · Confluence {record.confluence_score}/10 ·{" "}
              RR {record.rr_ratio.toFixed(2)}R
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-card-border px-3 py-1 text-text-secondary hover:bg-bg/40"
          >
            ✕
          </button>
        </div>

        {/* Trade levels */}
        <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg border border-card-border bg-bg/40 px-3 py-2">
            <p className="text-[0.65rem] uppercase text-text-secondary">Entry</p>
            <p className="font-mono text-text-primary">{record.entry_price.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-card-border bg-bg/40 px-3 py-2">
            <p className="text-[0.65rem] uppercase text-text-secondary">SL</p>
            <p className="font-mono text-text-primary">{record.sl_price.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-card-border bg-bg/40 px-3 py-2">
            <p className="text-[0.65rem] uppercase text-text-secondary">TP</p>
            <p className="font-mono text-text-primary">{record.tp_price.toFixed(2)}</p>
          </div>
        </div>

        {/* Confluence */}
        <div className="mb-4 grid grid-cols-2 gap-1.5">
          {CONFLUENCE_ITEMS.map((item) => {
            const ok = record.confluence[item.key];
            return (
              <div key={item.key} className="flex items-center gap-2 text-sm">
                <span className={ok ? "text-buy" : "text-notrade"}>{ok ? "✓" : "✗"}</span>
                <span className={ok ? "text-text-primary" : "text-text-secondary"}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Reasoning sections */}
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <p
                className={[
                  "text-xs font-bold uppercase tracking-wide",
                  r.danger ? "text-sell" : "text-text-secondary",
                ].join(" ")}
              >
                {r.label}
              </p>
              <p
                className={[
                  "mt-0.5 text-sm leading-relaxed",
                  r.danger ? "text-sell/90" : "text-text-primary",
                ].join(" ")}
              >
                {r.value || "—"}
              </p>
            </div>
          ))}
        </div>

        {record.trade_placed && record.order_ticket ? (
          <div className="mt-4 rounded-lg border border-buy/40 bg-buy/10 px-3 py-2 text-sm text-buy">
            ✓ Trade placed — Order #{record.order_ticket}
            {record.trade_price ? ` at ${record.trade_price.toFixed(2)}` : ""}
          </div>
        ) : record.error_message ? (
          <div className="mt-4 rounded-lg border border-sell/40 bg-sell/10 px-3 py-2 text-sm text-sell">
            {record.error_message}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SkeletonRows(): JSX.Element {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-card-border">
          <td colSpan={10} className="px-3 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-bg/60" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function HistoryTable(): JSX.Element {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<TradeRecord | null>(null);

  const { data, isLoading, isError, error, isFetching } = useQuery<HistoryResponse>({
    queryKey: ["history", limit],
    queryFn: () => getHistory(limit, 0),
  });

  const records = data?.records ?? [];
  const canLoadMore = records.length >= limit;

  return (
    <div className="rounded-xl border border-card-border bg-card">
      <div className="border-b border-card-border px-4 py-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-text-secondary">
          Analysis History
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-card-border text-[0.7rem] uppercase tracking-wide text-text-secondary">
              <th className="px-3 py-2 font-semibold">Time</th>
              <th className="px-3 py-2 font-semibold">Signal</th>
              <th className="px-3 py-2 font-semibold">Conf</th>
              <th className="px-3 py-2 font-semibold">Confluence</th>
              <th className="px-3 py-2 font-semibold">Entry</th>
              <th className="px-3 py-2 font-semibold">SL</th>
              <th className="px-3 py-2 font-semibold">TP</th>
              <th className="px-3 py-2 font-semibold">RR</th>
              <th className="px-3 py-2 font-semibold">Traded</th>
              <th className="px-3 py-2 font-semibold">Order</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows />
            ) : isError ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sell">
                  {error instanceof Error ? error.message : "Failed to load history."}
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-text-secondary">
                  <div className="text-3xl">📊</div>
                  <p className="mt-2">No analyses yet. Click “Analyze &amp; Trade” to begin.</p>
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={[
                    "cursor-pointer border-b border-card-border transition-colors",
                    rowBg(r.signal),
                  ].join(" ")}
                >
                  <td className="px-3 py-2 text-text-secondary">{fmtTime(r.timestamp)}</td>
                  <td className={["px-3 py-2 font-semibold", signalPill(r.signal)].join(" ")}>
                    {r.signal}
                  </td>
                  <td className="px-3 py-2 font-mono text-text-primary">{r.confidence}/10</td>
                  <td className="px-3 py-2 font-mono text-text-primary">
                    {r.confluence_score}/10
                  </td>
                  <td className="px-3 py-2 font-mono text-text-primary">
                    {r.entry_price.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 font-mono text-text-primary">{r.sl_price.toFixed(2)}</td>
                  <td className="px-3 py-2 font-mono text-text-primary">{r.tp_price.toFixed(2)}</td>
                  <td className="px-3 py-2 font-mono text-text-primary">
                    {r.rr_ratio.toFixed(2)}R
                  </td>
                  <td className="px-3 py-2">
                    {r.trade_placed ? (
                      <span className="text-buy">Yes</span>
                    ) : (
                      <span className="text-text-secondary">No</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-text-secondary">
                    {r.order_ticket ? `#${r.order_ticket}` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canLoadMore && (
        <div className="border-t border-card-border p-3 text-center">
          <button
            type="button"
            disabled={isFetching}
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
            className="rounded-lg border border-card-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg/40 disabled:opacity-50"
          >
            {isFetching ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {selected && <ReasoningModal record={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
