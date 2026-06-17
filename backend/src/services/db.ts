// ─────────────────────────────────────────────────────────────────────────────
// SQLite persistence (better-sqlite3)
// ─────────────────────────────────────────────────────────────────────────────

import path from "path";
import Database from "better-sqlite3";
import type {
  Confluence,
  SaveAnalysisInput,
  Stats,
  TradeRecord,
} from "../types";

const DB_PATH = process.env.DB_PATH || "./voxtrade.db";

const db = new Database(path.resolve(DB_PATH));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp         TEXT    NOT NULL,
    signal            TEXT    NOT NULL,
    confidence        REAL    NOT NULL,
    entry_price       REAL    NOT NULL,
    sl_price          REAL    NOT NULL,
    tp_price          REAL    NOT NULL,
    sl_pips           REAL    NOT NULL,
    tp_pips           REAL    NOT NULL,
    rr_ratio          REAL    NOT NULL,
    lot               REAL    NOT NULL,
    h1_bias           TEXT    NOT NULL,
    h1_liquidity      TEXT    NOT NULL,
    m15_setup         TEXT    NOT NULL,
    m15_structure     TEXT    NOT NULL,
    m5_entry          TEXT    NOT NULL,
    sl_rationale      TEXT    NOT NULL,
    tp_rationale      TEXT    NOT NULL,
    invalidation      TEXT    NOT NULL,
    confluence_score  INTEGER NOT NULL,
    confluence_json   TEXT    NOT NULL,
    trade_placed      INTEGER NOT NULL,
    order_ticket      INTEGER,
    retcode           INTEGER,
    trade_comment     TEXT,
    trade_price       REAL,
    trade_sl          REAL,
    trade_tp          REAL,
    error_message     TEXT
  );
`);

function countTrueConfluence(c: Confluence): number {
  return Object.values(c).reduce((sum, v) => sum + (v ? 1 : 0), 0);
}

const insertStmt = db.prepare(`
  INSERT INTO trades (
    timestamp, signal, confidence, entry_price, sl_price, tp_price,
    sl_pips, tp_pips, rr_ratio, lot,
    h1_bias, h1_liquidity, m15_setup, m15_structure, m5_entry,
    sl_rationale, tp_rationale, invalidation,
    confluence_score, confluence_json,
    trade_placed, order_ticket, retcode, trade_comment,
    trade_price, trade_sl, trade_tp, error_message
  ) VALUES (
    @timestamp, @signal, @confidence, @entry_price, @sl_price, @tp_price,
    @sl_pips, @tp_pips, @rr_ratio, @lot,
    @h1_bias, @h1_liquidity, @m15_setup, @m15_structure, @m5_entry,
    @sl_rationale, @tp_rationale, @invalidation,
    @confluence_score, @confluence_json,
    @trade_placed, @order_ticket, @retcode, @trade_comment,
    @trade_price, @trade_sl, @trade_tp, @error_message
  )
`);

export function saveAnalysis(data: SaveAnalysisInput): number {
  const { analysis, tradeResult } = data;
  const score = countTrueConfluence(analysis.confluence);

  const row = {
    timestamp: data.timestamp,
    signal: analysis.signal,
    confidence: analysis.confidence,
    entry_price: analysis.entry_price,
    sl_price: analysis.sl_price,
    tp_price: analysis.tp_price,
    sl_pips: analysis.sl_pips,
    tp_pips: analysis.tp_pips,
    rr_ratio: analysis.rr_ratio,
    lot: analysis.lot,
    h1_bias: analysis.reasoning.h1_bias,
    h1_liquidity: analysis.reasoning.h1_liquidity,
    m15_setup: analysis.reasoning.m15_setup,
    m15_structure: analysis.reasoning.m15_structure,
    m5_entry: analysis.reasoning.m5_entry,
    sl_rationale: analysis.reasoning.sl_rationale,
    tp_rationale: analysis.reasoning.tp_rationale,
    invalidation: analysis.reasoning.invalidation,
    confluence_score: score,
    confluence_json: JSON.stringify(analysis.confluence),
    trade_placed: data.trade_placed ? 1 : 0,
    order_ticket: tradeResult ? tradeResult.order : null,
    retcode: tradeResult ? tradeResult.retcode : null,
    trade_comment: tradeResult ? tradeResult.comment : null,
    trade_price: tradeResult ? tradeResult.price : null,
    trade_sl: tradeResult ? tradeResult.sl : null,
    trade_tp: tradeResult ? tradeResult.tp : null,
    error_message: data.error_message,
  };

  const info = insertStmt.run(row);
  return Number(info.lastInsertRowid);
}

interface DbRow {
  id: number;
  timestamp: string;
  signal: string;
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
  confluence_json: string;
  trade_placed: number;
  order_ticket: number | null;
  retcode: number | null;
  trade_comment: string | null;
  trade_price: number | null;
  trade_sl: number | null;
  trade_tp: number | null;
  error_message: string | null;
}

function rowToRecord(row: DbRow): TradeRecord {
  return {
    id: row.id,
    timestamp: row.timestamp,
    signal: row.signal as TradeRecord["signal"],
    confidence: row.confidence,
    entry_price: row.entry_price,
    sl_price: row.sl_price,
    tp_price: row.tp_price,
    sl_pips: row.sl_pips,
    tp_pips: row.tp_pips,
    rr_ratio: row.rr_ratio,
    lot: row.lot,
    h1_bias: row.h1_bias,
    h1_liquidity: row.h1_liquidity,
    m15_setup: row.m15_setup,
    m15_structure: row.m15_structure,
    m5_entry: row.m5_entry,
    sl_rationale: row.sl_rationale,
    tp_rationale: row.tp_rationale,
    invalidation: row.invalidation,
    confluence_score: row.confluence_score,
    confluence: JSON.parse(row.confluence_json) as Confluence,
    trade_placed: row.trade_placed === 1,
    order_ticket: row.order_ticket,
    retcode: row.retcode,
    trade_comment: row.trade_comment,
    trade_price: row.trade_price,
    trade_sl: row.trade_sl,
    trade_tp: row.trade_tp,
    error_message: row.error_message,
  };
}

const historyStmt = db.prepare(`
  SELECT * FROM trades
  ORDER BY id DESC
  LIMIT ? OFFSET ?
`);

export function getHistory(limit: number, offset: number): TradeRecord[] {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const safeOffset = Math.max(0, offset);
  const rows = historyStmt.all(safeLimit, safeOffset) as DbRow[];
  return rows.map(rowToRecord);
}

const statsStmt = db.prepare(`
  SELECT
    COUNT(*)                                                AS total,
    COALESCE(SUM(trade_placed), 0)                          AS traded,
    COALESCE(SUM(CASE WHEN signal = 'NO_TRADE' THEN 1 ELSE 0 END), 0) AS no_trade,
    COALESCE(AVG(confidence), 0)                            AS avg_confidence,
    COALESCE(AVG(CASE WHEN rr_ratio > 0 THEN rr_ratio END), 0) AS avg_rr
  FROM trades
`);

export function getStats(): Stats {
  const r = statsStmt.get() as {
    total: number;
    traded: number;
    no_trade: number;
    avg_confidence: number;
    avg_rr: number;
  };
  return {
    total: r.total,
    traded: r.traded,
    no_trade: r.no_trade,
    avg_confidence: Number(r.avg_confidence.toFixed(2)),
    avg_rr: Number(r.avg_rr.toFixed(2)),
  };
}

export default db;
