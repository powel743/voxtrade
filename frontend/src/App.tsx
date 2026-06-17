// ─────────────────────────────────────────────────────────────────────────────
// App — VoxTrade dashboard
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from "@tanstack/react-query";
import { getStats } from "./api/trade";
import { useUiStore } from "./store";
import type { Stats } from "./types";
import { StatusIndicator } from "./components/StatusIndicator";
import { AnalyzeButton } from "./components/AnalyzeButton";
import { SignalCard } from "./components/SignalCard";
import { TradeResultBadge } from "./components/TradeResultBadge";
import { ReasoningPanel } from "./components/ReasoningPanel";
import { HistoryTable } from "./components/HistoryTable";

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-card-border bg-card px-4 py-3">
      <p className="text-[0.65rem] uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1 text-xl font-bold text-text-primary tabular-nums">{value}</p>
    </div>
  );
}

function StatsBar(): JSX.Element {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: getStats,
  });

  const cards: { label: string; value: string }[] = [
    { label: "Total Analyses", value: isLoading || !data ? "—" : String(data.total) },
    { label: "Trades Placed", value: isLoading || !data ? "—" : String(data.traded) },
    {
      label: "Avg Confidence",
      value: isLoading || !data ? "—" : `${data.avg_confidence.toFixed(1)}/10`,
    },
    { label: "Avg RR", value: isLoading || !data ? "—" : `${data.avg_rr.toFixed(2)}R` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <StatCard key={c.label} label={c.label} value={c.value} />
      ))}
    </div>
  );
}

export default function App(): JSX.Element {
  const result = useUiStore((s) => s.result);
  const error = useUiStore((s) => s.error);

  return (
    <div className="min-h-full bg-bg text-text-primary">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-card-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              <span className="text-gold">VoxTrade</span>
            </h1>
            <p className="text-xs text-text-secondary">XAUUSD · SMC + Price Action</p>
          </div>
          <StatusIndicator />
        </header>

        {/* Stats bar */}
        <section className="mt-6">
          <StatsBar />
        </section>

        {/* Analyze panel */}
        <section className="mt-8 flex flex-col items-center rounded-2xl border border-card-border bg-card p-6 sm:p-8">
          <AnalyzeButton />
        </section>

        {/* Error state */}
        {error && (
          <div className="mt-6 rounded-xl border border-sell/40 bg-sell/10 px-5 py-4 text-sell animate-fade-in">
            <p className="font-semibold">⚠ {error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <section className="mt-6 space-y-5">
            <TradeResultBadge response={result} />
            <SignalCard analysis={result.analysis} />
            <ReasoningPanel reasoning={result.analysis.reasoning} />
          </section>
        )}

        {/* History */}
        <section className="mt-8">
          <HistoryTable />
        </section>

        <footer className="mt-10 border-t border-card-border pt-5 text-center text-xs text-text-secondary">
          VoxTrade · Gemini-powered SMC + Price Action · Test on a demo account first.
        </footer>
      </div>
    </div>
  );
}
