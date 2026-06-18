// ─────────────────────────────────────────────────────────────────────────────
// AnalyzeButton — the main "Analyze & Trade" action with loading + cooldown
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { analyzeAndTrade, ApiError } from "../api/trade";
import { LOADING_MESSAGES, useUiStore } from "../store";
import type { AnalyzeResponse } from "../types";

function Spinner(): JSX.Element {
  return (
    <span
      className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-bg/40 border-t-bg"
      aria-hidden="true"
    />
  );
}

export function AnalyzeButton(): JSX.Element {
  const queryClient = useQueryClient();
  const isAnalyzing = useUiStore((s) => s.isAnalyzing);
  const loadingMessageIndex = useUiStore((s) => s.loadingMessageIndex);
  const cooldown = useUiStore((s) => s.cooldown);
  const startAnalyzing = useUiStore((s) => s.startAnalyzing);
  const stopAnalyzing = useUiStore((s) => s.stopAnalyzing);
  const setResult = useUiStore((s) => s.setResult);
  const setError = useUiStore((s) => s.setError);
  const startCooldown = useUiStore((s) => s.startCooldown);

  const mutation = useMutation<AnalyzeResponse, Error>({
    mutationFn: analyzeAndTrade,
    onMutate: () => {
      startAnalyzing();
    },
    onSuccess: (data) => {
      setResult(data);
      // Refresh history + stats so they reflect the new record.
      void queryClient.invalidateQueries({ queryKey: ["history"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.message
          : "Something went wrong while analyzing the market.";
      setError(message);
    },
    onSettled: () => {
      stopAnalyzing();
      startCooldown();
    },
  });

  const disabled = isAnalyzing || cooldown > 0;

  const label = (() => {
    if (isAnalyzing) return LOADING_MESSAGES[loadingMessageIndex];
    if (cooldown > 0) return `Cooldown… ${cooldown}s`;
    return "⚡ Analyze & Trade";
  })();

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => mutation.mutate()}
        className={[
          "flex w-full items-center justify-center gap-3 rounded-xl px-6 py-4 text-lg font-bold transition-all sm:w-auto sm:min-w-[20rem]",
          disabled
            ? "cursor-not-allowed bg-gold/40 text-bg/70"
            : "bg-gold text-bg shadow-lg shadow-gold/20 hover:brightness-110 active:scale-[0.99]",
        ].join(" ")}
      >
        {isAnalyzing && <Spinner />}
        <span className="tabular-nums">{label}</span>
      </button>
      <p className="text-center text-xs text-text-secondary">
        Powered by Groq AI · SMC + Price Action · H1 → M15 → M5
      </p>
    </div>
  );
}
