// ─────────────────────────────────────────────────────────────────────────────
// POST /analyze — fetch candles, run Claude SMC analysis, place trade if valid
// ─────────────────────────────────────────────────────────────────────────────

import type { FastifyInstance } from "fastify";
import { analyzeMarket, ClaudeParseError } from "../services/claude";
import { BridgeOfflineError, getCandles, placeTrade } from "../services/mt5";
import { saveAnalysis } from "../services/db";
import type { AnalyzeResponse, TradeResult } from "../types";

const SYMBOL = "XAUUSD";

function confidenceThreshold(): number {
  const raw = Number(process.env.CONFIDENCE_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 ? raw : 7;
}

export default async function analyzeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/analyze", async (request, reply) => {
    // 1. Fetch candles in parallel.
    let h1, m15, m5;
    try {
      [h1, m15, m5] = await Promise.all([
        getCandles(SYMBOL, "H1", 100),
        getCandles(SYMBOL, "M15", 150),
        getCandles(SYMBOL, "M5", 50),
      ]);
    } catch (err) {
      if (err instanceof BridgeOfflineError) {
        reply.code(503);
        return {
          error:
            "MT5 bridge offline. Make sure bridge.py is running on your Windows PC and ngrok/Cloudflare tunnel is active.",
        };
      }
      request.log.error(err);
      reply.code(500);
      return { error: "Failed to fetch candle data." };
    }

    if (!h1.length || !m15.length || !m5.length) {
      reply.code(503);
      return {
        error:
          "MT5 bridge returned no candle data. Ensure XAUUSD is available in Market Watch on your terminal.",
      };
    }

    // 3. Run Claude analysis.
    let analysis;
    try {
      analysis = await analyzeMarket(h1, m15, m5);
    } catch (err) {
      if (err instanceof ClaudeParseError) {
        request.log.error({ raw: err.raw }, "Claude parse error");
        reply.code(502);
        return { error: `Claude analysis failed to parse: ${err.message}` };
      }
      request.log.error(err);
      reply.code(500);
      return { error: "Claude analysis failed." };
    }

    const threshold = confidenceThreshold();
    const timestamp = new Date().toISOString();

    const wantsTrade = analysis.signal !== "NO_TRADE" && analysis.confidence >= threshold;

    let tradeResult: TradeResult | null = null;
    let tradePlaced = false;
    let errorMessage: string | null = null;

    // 5/6. Place trade only if valid + above threshold.
    if (wantsTrade) {
      try {
        tradeResult = await placeTrade({
          symbol: SYMBOL,
          action: analysis.signal === "BUY" ? "BUY" : "SELL",
          lot: analysis.lot,
          sl_pips: analysis.sl_pips,
          tp_pips: analysis.tp_pips,
        });
        tradePlaced = tradeResult.success;
        if (!tradeResult.success) {
          errorMessage = `Trade rejected by MT5: ${tradeResult.comment} (retcode ${tradeResult.retcode})`;
        }
      } catch (err) {
        if (err instanceof BridgeOfflineError) {
          errorMessage = err.message;
        } else {
          request.log.error(err);
          errorMessage = "Unexpected error while placing the trade.";
        }
      }
    }

    // 7. Persist the full record.
    let recordId = -1;
    try {
      recordId = saveAnalysis({
        timestamp,
        analysis,
        trade_placed: tradePlaced,
        tradeResult,
        error_message: errorMessage,
      });
    } catch (err) {
      request.log.error(err, "Failed to persist analysis");
    }

    // 8. Respond.
    const response: AnalyzeResponse = {
      analysis,
      tradeResult,
      trade_placed: tradePlaced,
      recordId,
      timestamp,
      error_message: errorMessage,
    };
    return response;
  });
}
