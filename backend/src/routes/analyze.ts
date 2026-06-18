// ─────────────────────────────────────────────────────────────────────────────
// POST /analyze — fetch candles, run Groq SMC analysis, place trade if valid
// ─────────────────────────────────────────────────────────────────────────────

import type { FastifyInstance, FastifyRequest } from "fastify";
import { analyzeMarket, ClaudeParseError } from "../services/claude";
import {
  BridgeOfflineError,
  BridgeTimeoutError,
  getCandles,
  placeTrade,
} from "../services/mt5";
import { saveAnalysis } from "../services/db";
import { SYMBOL } from "../config";
import type { AnalysisResult, AnalyzeResponse, Candle, TradeResult } from "../types";

// Candle counts kept small enough to stay within the Groq TPM budget.
const H1_COUNT = 50;
const M15_COUNT = 75;
const M5_COUNT = 100; // primary entry context — kept high

// On a 413/429 retry, shrink context further (M5 still favoured for entry detail).
const RETRY_H1 = 30;
const RETRY_M15 = 40;
const RETRY_M5 = 60;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function confidenceThreshold(): number {
  const raw = Number(process.env.CONFIDENCE_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 ? raw : 7;
}

/** Extract an HTTP status from a provider/SDK error (Groq APIError exposes `status`). */
function httpStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status: unknown }).status;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

/**
 * Run the Groq SMC analysis. If Groq replies 413 (request too large) or 429
 * (rate limit), wait 2s and retry ONCE with a reduced candle context.
 */
async function runAnalysisWithRetry(
  h1: Candle[],
  m15: Candle[],
  m5: Candle[],
  request: FastifyRequest,
): Promise<AnalysisResult> {
  try {
    return await analyzeMarket(h1, m15, m5);
  } catch (err) {
    const status = httpStatus(err);
    if (status === 413 || status === 429) {
      request.log.warn(
        `Groq returned ${status} (token/rate limit). Retrying once with reduced context in 2s…`,
      );
      await sleep(2000);
      return await analyzeMarket(
        h1.slice(-RETRY_H1),
        m15.slice(-RETRY_M15),
        m5.slice(-RETRY_M5),
      );
    }
    throw err;
  }
}

export default async function analyzeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/analyze", async (request, reply) => {
    // 1. Fetch candles in parallel (reduced counts to fit the token budget).
    let h1: Candle[], m15: Candle[], m5: Candle[];
    try {
      [h1, m15, m5] = await Promise.all([
        getCandles(SYMBOL, "H1", H1_COUNT),
        getCandles(SYMBOL, "M15", M15_COUNT),
        getCandles(SYMBOL, "M5", M5_COUNT),
      ]);
    } catch (err) {
      // Timeout gets its own clear message and a 504 (not a 503).
      if (err instanceof BridgeTimeoutError) {
        reply.code(504);
        return { error: err.message };
      }
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
        error: `MT5 bridge returned no candle data. Ensure ${SYMBOL} is available in Market Watch on your terminal.`,
      };
    }

    // 2. Run the SMC analysis (with one reduced-context retry on 413/429).
    let analysis: AnalysisResult;
    try {
      analysis = await runAnalysisWithRetry(h1, m15, m5, request);
    } catch (err) {
      if (err instanceof ClaudeParseError) {
        request.log.error({ raw: err.raw }, "Groq parse error");
        reply.code(502);
        return { error: `AI analysis failed to parse: ${err.message}` };
      }
      const status = httpStatus(err);
      if (status === 413 || status === 429) {
        request.log.error(err, "Groq token/rate limit after retry");
        reply.code(429);
        return {
          error:
            "AI provider is rate-limited or the request is too large right now. Please wait a few seconds and try again.",
        };
      }
      request.log.error(err);
      reply.code(500);
      return { error: "AI analysis failed." };
    }

    const threshold = confidenceThreshold();
    const timestamp = new Date().toISOString();

    const wantsTrade = analysis.signal !== "NO_TRADE" && analysis.confidence >= threshold;

    let tradeResult: TradeResult | null = null;
    let tradePlaced = false;
    let errorMessage: string | null = null;

    // 3. Place trade only if valid + above threshold.
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
        if (err instanceof BridgeTimeoutError || err instanceof BridgeOfflineError) {
          errorMessage = err.message;
        } else {
          request.log.error(err);
          errorMessage = "Unexpected error while placing the trade.";
        }
      }
    }

    // 4. Persist the full record.
    let recordId = -1;
    try {
      recordId = await saveAnalysis({
        timestamp,
        analysis,
        trade_placed: tradePlaced,
        tradeResult,
        error_message: errorMessage,
      });
    } catch (err) {
      request.log.error(err, "Failed to persist analysis");
    }

    // 5. Respond.
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
