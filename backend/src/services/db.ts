// ─────────────────────────────────────────────────────────────────────────────
// MongoDB persistence (native `mongodb` driver)
// ─────────────────────────────────────────────────────────────────────────────

import { MongoClient, type Collection, type Db } from "mongodb";
import type { Confluence, SaveAnalysisInput, Stats, TradeRecord } from "../types";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB || "voxtrade";

// Document stored in the `trades` collection. Mirrors TradeRecord exactly
// (numeric `id` preserved so the API/UI contract is unchanged); Mongo adds its
// own `_id` which we never expose.
type TradeDoc = TradeRecord;

interface CounterDoc {
  _id: string;
  seq: number;
}

let client: MongoClient | null = null;
let db: Db | null = null;

/** Connect to MongoDB. Call once at startup before serving requests. */
export async function connectDb(): Promise<void> {
  if (db) return;
  const c = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  await c.connect();
  client = c;
  db = c.db(DB_NAME);
  // Index for fast newest-first history pagination.
  await db.collection<TradeDoc>("trades").createIndex({ id: -1 });
}

/** Close the connection (used on graceful shutdown). */
export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

function requireDb(): Db {
  if (!db) {
    throw new Error("Database not connected. Call connectDb() first.");
  }
  return db;
}

function tradesCol(): Collection<TradeDoc> {
  return requireDb().collection<TradeDoc>("trades");
}

function countersCol(): Collection<CounterDoc> {
  return requireDb().collection<CounterDoc>("counters");
}

function countTrueConfluence(c: Confluence): number {
  return Object.values(c).reduce((sum, v) => sum + (v ? 1 : 0), 0);
}

/** Atomic auto-increment id so the numeric `id` contract is preserved. */
async function nextId(): Promise<number> {
  const result = await countersCol().findOneAndUpdate(
    { _id: "trades" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return result?.seq ?? 1;
}

export async function saveAnalysis(data: SaveAnalysisInput): Promise<number> {
  const { analysis, tradeResult } = data;
  const score = countTrueConfluence(analysis.confluence);
  const id = await nextId();

  const doc: TradeDoc = {
    id,
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
    confluence: analysis.confluence,
    trade_placed: data.trade_placed,
    order_ticket: tradeResult ? tradeResult.order : null,
    retcode: tradeResult ? tradeResult.retcode : null,
    trade_comment: tradeResult ? tradeResult.comment : null,
    trade_price: tradeResult ? tradeResult.price : null,
    trade_sl: tradeResult ? tradeResult.sl : null,
    trade_tp: tradeResult ? tradeResult.tp : null,
    error_message: data.error_message,
  };

  await tradesCol().insertOne({ ...doc });
  return id;
}

export async function getHistory(limit: number, offset: number): Promise<TradeRecord[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const safeOffset = Math.max(0, offset);

  const docs = await tradesCol()
    .find({}, { projection: { _id: 0 } })
    .sort({ id: -1 })
    .skip(safeOffset)
    .limit(safeLimit)
    .toArray();

  // Projection strips _id; the remaining shape is exactly TradeRecord.
  return docs.map((d) => d as TradeRecord);
}

interface StatsAgg {
  total: number;
  traded: number;
  no_trade: number;
  avg_confidence: number | null;
  avg_rr: number | null;
}

export async function getStats(): Promise<Stats> {
  const agg = await tradesCol()
    .aggregate<StatsAgg>([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          traded: { $sum: { $cond: ["$trade_placed", 1, 0] } },
          no_trade: {
            $sum: { $cond: [{ $eq: ["$signal", "NO_TRADE"] }, 1, 0] },
          },
          avg_confidence: { $avg: "$confidence" },
          // $avg ignores null, so this averages only rr_ratio > 0 rows.
          avg_rr: {
            $avg: { $cond: [{ $gt: ["$rr_ratio", 0] }, "$rr_ratio", null] },
          },
        },
      },
    ])
    .toArray();

  const r = agg[0];
  if (!r) {
    return { total: 0, traded: 0, no_trade: 0, avg_confidence: 0, avg_rr: 0 };
  }
  return {
    total: r.total,
    traded: r.traded,
    no_trade: r.no_trade,
    avg_confidence: Number((r.avg_confidence ?? 0).toFixed(2)),
    avg_rr: Number((r.avg_rr ?? 0).toFixed(2)),
  };
}
