// ─────────────────────────────────────────────────────────────────────────────
// GET /status — keep-warm endpoint pinged by cron-job.org every 10 minutes.
// MUST always return HTTP 200, even when the MT5 bridge is offline.
// ─────────────────────────────────────────────────────────────────────────────

import type { FastifyInstance } from "fastify";
import { getStatus } from "../services/mt5";
import type { StatusResponse } from "../types";

export default async function statusRoutes(app: FastifyInstance): Promise<void> {
  app.get("/status", async (_request, reply) => {
    reply.code(200);
    try {
      const bridge = await getStatus(5000);
      const response: StatusResponse = {
        backend: "online",
        bridge: "online",
        connected: bridge.connected,
        account: bridge.account,
        balance: bridge.balance,
        equity: bridge.equity,
        margin_free: bridge.margin_free,
        server: bridge.server,
      };
      return response;
    } catch {
      const response: StatusResponse = {
        backend: "online",
        bridge: "offline",
        message: "Start bridge.py on your Windows PC and activate ngrok tunnel",
      };
      return response;
    }
  });
}
