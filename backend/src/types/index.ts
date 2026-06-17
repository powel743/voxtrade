// ─────────────────────────────────────────────────────────────────────────────
// Shared backend types
// ─────────────────────────────────────────────────────────────────────────────

export type Timeframe = "H4" | "H1" | "M15" | "M5";

export type Signal = "BUY" | "SELL" | "NO_TRADE";

export interface Candle {
  time: string; // ISO string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

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

// ── MT5 bridge shapes ────────────────────────────────────────────────────────

export interface BridgeStatus {
  connected: boolean;
  account: string;
  balance: number;
  equity: number;
  margin_free: number;
  server: string;
  ping: string;
}

export interface TradeRequest {
  symbol: string;
  action: "BUY" | "SELL";
  lot: number;
  sl_pips: number;
  tp_pips: number;
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

export interface OpenPosition {
  ticket: number;
  type: "BUY" | "SELL";
  volume: number;
  open_price: number;
  sl: number;
  tp: number;
  profit: number;
  open_time: string;
}

// ── Persistence ──────────────────────────────────────────────────────────────

export interface SaveAnalysisInput {
  timestamp: string;
  analysis: AnalysisResult;
  trade_placed: boolean;
  tradeResult: TradeResult | null;
  error_message: string | null;
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

export interface Stats {
  total: number;
  traded: number;
  no_trade: number;
  avg_confidence: number;
  avg_rr: number;
}

// ── API responses ────────────────────────────────────────────────────────────

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
