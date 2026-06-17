// ─────────────────────────────────────────────────────────────────────────────
// GET /history and GET /stats — read analysis records from SQLite
// ─────────────────────────────────────────────────────────────────────────────

import type { FastifyInstance } from "fastify";
import { getHistory, getStats } from "../services/db";

interface HistoryQuery {
  limit?: string;
  offset?: string;
}

export default async function historyRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: HistoryQuery }>("/history", async (request) => {
    const limit = Number(request.query.limit ?? "20");
    const offset = Number(request.query.offset ?? "0");
    const safeLimit = Number.isFinite(limit) ? limit : 20;
    const safeOffset = Number.isFinite(offset) ? offset : 0;
    const records = getHistory(safeLimit, safeOffset);
    return { records, limit: safeLimit, offset: safeOffset };
  });

  app.get("/stats", async () => {
    return getStats();
  });
}
