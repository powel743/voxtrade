// ─────────────────────────────────────────────────────────────────────────────
// API client — talks to the VoxTrade backend
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AnalyzeResponse,
  HistoryResponse,
  Stats,
  StatusResponse,
} from "../types";

const BASE = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

export class ApiError extends Error {
  public readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      "Cannot reach the VoxTrade backend. Check your connection and that the backend is running.",
      0,
    );
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return body as T;
}

export function getStatus(): Promise<StatusResponse> {
  return request<StatusResponse>("/status");
}

export function getStats(): Promise<Stats> {
  return request<Stats>("/stats");
}

export function getHistory(limit: number, offset: number): Promise<HistoryResponse> {
  return request<HistoryResponse>(`/history?limit=${limit}&offset=${offset}`);
}

export function analyzeAndTrade(): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>("/analyze", { method: "POST", body: JSON.stringify({}) });
}
