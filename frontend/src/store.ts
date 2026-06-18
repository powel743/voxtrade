// ─────────────────────────────────────────────────────────────────────────────
// Zustand store — local UI state: loading-message rotation + analyze cooldown
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import type { AnalyzeResponse } from "./types";

export const LOADING_MESSAGES: string[] = [
  "Fetching H1 candles...",
  "Fetching M15 candles...",
  "Fetching M5 candles...",
  "AI is analyzing market structure...",
  "Checking liquidity pools...",
  "Identifying order blocks and FVGs...",
  "Calculating confluence score...",
];

export const COOLDOWN_SECONDS = 30;

interface UiState {
  // Latest analysis result shown in the SignalCard / panels.
  result: AnalyzeResponse | null;
  error: string | null;

  // Loading state
  isAnalyzing: boolean;
  loadingMessageIndex: number;

  // Cooldown
  cooldown: number;

  // timers (kept out of render)
  _loadingTimer: ReturnType<typeof setInterval> | null;
  _cooldownTimer: ReturnType<typeof setInterval> | null;

  startAnalyzing: () => void;
  stopAnalyzing: () => void;
  setResult: (result: AnalyzeResponse) => void;
  setError: (error: string | null) => void;
  startCooldown: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  result: null,
  error: null,
  isAnalyzing: false,
  loadingMessageIndex: 0,
  cooldown: 0,
  _loadingTimer: null,
  _cooldownTimer: null,

  startAnalyzing: () => {
    const existing = get()._loadingTimer;
    if (existing) clearInterval(existing);

    set({ isAnalyzing: true, loadingMessageIndex: 0, error: null });

    const timer = setInterval(() => {
      set((s) => ({
        loadingMessageIndex: (s.loadingMessageIndex + 1) % LOADING_MESSAGES.length,
      }));
    }, 1800);

    set({ _loadingTimer: timer });
  },

  stopAnalyzing: () => {
    const timer = get()._loadingTimer;
    if (timer) clearInterval(timer);
    set({ isAnalyzing: false, _loadingTimer: null });
  },

  setResult: (result) => set({ result, error: null }),

  setError: (error) => set({ error }),

  startCooldown: () => {
    const existing = get()._cooldownTimer;
    if (existing) clearInterval(existing);

    set({ cooldown: COOLDOWN_SECONDS });

    const timer = setInterval(() => {
      const next = get().cooldown - 1;
      if (next <= 0) {
        const t = get()._cooldownTimer;
        if (t) clearInterval(t);
        set({ cooldown: 0, _cooldownTimer: null });
      } else {
        set({ cooldown: next });
      }
    }, 1000);

    set({ _cooldownTimer: timer });
  },
}));
