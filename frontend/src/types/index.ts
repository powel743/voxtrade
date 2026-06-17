// ─────────────────────────────────────────────────────────────────────────────
// Shared frontend types (mirror the backend API contract)
// ─────────────────────────────────────────────────────────────────────────────

export type Signal = "BUY" | "SELL" | "NO_TRADE";

export interface Confluence {
  h1_bias_aligned: boolean;
  m15_structure_aligned: boolean;
  liquidity_swept: boolean;
  premium_discount_zone: boolean;
  order_block_present: boolean;
  fvg_present: boolean;
  m5_choch_confirmed: boolean;
  candlestick_confirmation: boolean;
  key_level_alignment: boolean;
  momentum_confirmation: boolean;
}

export interface Reasoning {
  h1_bias: string;
  h1_liquidity: string;
  m15_setup: string;
  m15_structure: string;
  m5_entry: string;
  sl_rationale: string;
  tp_rationale: string;
  invalidation: string;
}

export interface AnalysisResult {
  signal: Signal;
  confidence: number;
  entry_price: number;
  sl_price: number;
  tp_price: number;
  sl_pips: number;
  tp_pips: number;
  rr_ratio: number;
  lot: number;
  confluence: Confluence;
  reasoning: Reasoning;
}

export interface TradeResult {
  success: boolean;
  retcode: number;
  order: number;
  comment: string;
  price: number;
  sl: number;
  tp: number;
}

export interface AnalyzeResponse {
  analysis: AnalysisResult;
  tradeResult: TradeResult | null;
  trade_placed: boolean;
  recordId: number;
  timestamp: string;
  error_message: string | null;
}

export interface StatusResponse {
  backend: "online";
  bridge: "online" | "offline";
  message?: string;
  connected?: boolean;
  account?: string;
  balance?: number;
  equity?: number;
  margin_free?: number;
  server?: string;
}

export interface Stats {
  total: number;
  traded: number;
  no_trade: number;
  avg_confidence: number;
  avg_rr: number;
}

export interface TradeRecord {
  id: number;
  timestamp: string;
  signal: Signal;
  confidence: number;
  entry_price: number;
  sl_price: number;
  tp_price: number;
  sl_pips: number;
  tp_pips: number;
  rr_ratio: number;
  lot: number;
  h1_bias: string;
  h1_liquidity: string;
  m15_setup: string;
  m15_structure: string;
  m5_entry: string;
  sl_rationale: string;
  tp_rationale: string;
  invalidation: string;
  confluence_score: number;
  confluence: Confluence;
  trade_placed: boolean;
  order_ticket: number | null;
  retcode: number | null;
  trade_comment: string | null;
  trade_price: number | null;
  trade_sl: number | null;
  trade_tp: number | null;
  error_message: string | null;
}

export interface HistoryResponse {
  records: TradeRecord[];
  limit: number;
  offset: number;
}

// Labels + order for the 10-item confluence checklist (UI).
export const CONFLUENCE_ITEMS: { key: keyof Confluence; label: string }[] = [
  { key: "h1_bias_aligned", label: "H1 bias aligned" },
  { key: "m15_structure_aligned", label: "M15 structure aligned" },
  { key: "liquidity_swept", label: "Liquidity swept" },
  { key: "premium_discount_zone", label: "Premium/discount zone" },
  { key: "order_block_present", label: "Order block present" },
  { key: "fvg_present", label: "FVG present" },
  { key: "m5_choch_confirmed", label: "M5 CHoCH confirmed" },
  { key: "candlestick_confirmation", label: "Candlestick confirmation" },
  { key: "key_level_alignment", label: "Key level alignment" },
  { key: "momentum_confirmation", label: "Momentum confirmation" },
];
