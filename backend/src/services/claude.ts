// ─────────────────────────────────────────────────────────────────────────────
// Gemini analysis service — sends SMC prompt, parses + validates the JSON result
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { buildSMCPrompt } from "../prompts/smc";
import type { AnalysisResult, Candle, Confluence, Reasoning, Signal } from "../types";

const MODEL = "gemini-2.0-flash";
const MAX_TOKENS = 2048;
const TEMPERATURE = 0;

export class ClaudeParseError extends Error {
  public readonly raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = "ClaudeParseError";
    this.raw = raw;
  }
}

let model: GenerativeModel | null = null;

function getClient(): GenerativeModel {
  if (model) return model;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set on the backend.");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_TOKENS,
      responseMimeType: "application/json",
    },
  });
  return model;
}

/** Remove accidental markdown fences and isolate the JSON object. */
function extractJson(text: string): string {
  let cleaned = text.trim();

  // Strip ```json ... ``` or ``` ... ``` fences.
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Isolate the outermost JSON object if there is stray text around it.
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }

  return cleaned;
}

const CONFLUENCE_KEYS: (keyof Confluence)[] = [
  "h1_bias_aligned",
  "m15_structure_aligned",
  "liquidity_swept",
  "premium_discount_zone",
  "order_block_present",
  "fvg_present",
  "m5_choch_confirmed",
  "candlestick_confirmation",
  "key_level_alignment",
  "momentum_confirmation",
];

const REASONING_KEYS: (keyof Reasoning)[] = [
  "h1_bias",
  "h1_liquidity",
  "m15_setup",
  "m15_structure",
  "m5_entry",
  "sl_rationale",
  "tp_rationale",
  "invalidation",
];

function toNumber(value: unknown, field: string, raw: string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || Number.isNaN(n)) {
    throw new ClaudeParseError(`Field '${field}' is not a valid number`, raw);
  }
  return n;
}

function validateAndNormalize(parsed: unknown, raw: string): AnalysisResult {
  if (typeof parsed !== "object" || parsed === null) {
    throw new ClaudeParseError("Response is not a JSON object", raw);
  }
  const obj = parsed as Record<string, unknown>;

  const signal = obj.signal;
  if (signal !== "BUY" && signal !== "SELL" && signal !== "NO_TRADE") {
    throw new ClaudeParseError(`Invalid 'signal': ${String(signal)}`, raw);
  }

  // Confluence
  const confluenceRaw = obj.confluence;
  if (typeof confluenceRaw !== "object" || confluenceRaw === null) {
    throw new ClaudeParseError("Missing 'confluence' object", raw);
  }
  const cObj = confluenceRaw as Record<string, unknown>;
  const confluence = {} as Confluence;
  for (const key of CONFLUENCE_KEYS) {
    confluence[key] = Boolean(cObj[key]);
  }

  // Reasoning
  const reasoningRaw = obj.reasoning;
  if (typeof reasoningRaw !== "object" || reasoningRaw === null) {
    throw new ClaudeParseError("Missing 'reasoning' object", raw);
  }
  const rObj = reasoningRaw as Record<string, unknown>;
  const reasoning = {} as Reasoning;
  for (const key of REASONING_KEYS) {
    reasoning[key] = typeof rObj[key] === "string" ? (rObj[key] as string) : "";
  }

  const confidence = toNumber(obj.confidence ?? 0, "confidence", raw);
  const entry_price = toNumber(obj.entry_price ?? 0, "entry_price", raw);
  const sl_price = toNumber(obj.sl_price ?? 0, "sl_price", raw);
  const tp_price = toNumber(obj.tp_price ?? 0, "tp_price", raw);
  const sl_pips = toNumber(obj.sl_pips ?? 0, "sl_pips", raw);
  const tp_pips = toNumber(obj.tp_pips ?? 0, "tp_pips", raw);
  const lot = typeof obj.lot === "number" && obj.lot > 0 ? obj.lot : 0.01;

  // Recompute rr_ratio if missing or inconsistent.
  let rr_ratio = typeof obj.rr_ratio === "number" ? obj.rr_ratio : 0;
  if (sl_pips > 0) {
    const computed = Number((tp_pips / sl_pips).toFixed(2));
    if (!rr_ratio || Math.abs(rr_ratio - computed) > 0.05) {
      rr_ratio = computed;
    }
  }

  return {
    signal: signal as Signal,
    confidence,
    entry_price,
    sl_price,
    tp_price,
    sl_pips,
    tp_pips,
    rr_ratio,
    lot,
    confluence,
    reasoning,
  };
}

/** Run the SMC analysis through Gemini and return a validated result. */
export async function analyzeMarket(
  h1: Candle[],
  m15: Candle[],
  m5: Candle[],
): Promise<AnalysisResult> {
  const prompt = buildSMCPrompt(h1, m15, m5);
  const gemini = getClient();

  const result = await gemini.generateContent(prompt);

  const raw = result.response.text();
  if (!raw) {
    throw new ClaudeParseError("Gemini returned no text content", JSON.stringify(result.response));
  }

  const jsonStr = extractJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new ClaudeParseError("Failed to JSON.parse Gemini response", raw);
  }

  return validateAndNormalize(parsed, raw);
}
