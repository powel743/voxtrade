// ─────────────────────────────────────────────────────────────────────────────
// VoxTrade backend — Fastify server entrypoint
// ─────────────────────────────────────────────────────────────────────────────

import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";

import analyzeRoutes from "./routes/analyze";
import statusRoutes from "./routes/status";
import historyRoutes from "./routes/history";

// Importing db initializes the SQLite schema on first run (no manual steps).
import "./services/db";

const PORT = Number(process.env.PORT) || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "";

async function main(): Promise<void> {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  // CORS: allow the deployed Vercel frontend + local dev.
  const allowedOrigins = new Set<string>([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  if (FRONTEND_URL) {
    allowedOrigins.add(FRONTEND_URL.replace(/\/+$/, ""));
  }

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow same-origin / curl / server-to-server requests (no Origin header).
      if (!origin) {
        cb(null, true);
        return;
      }
      const normalized = origin.replace(/\/+$/, "");
      if (allowedOrigins.has(normalized) || normalized.endsWith(".vercel.app")) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  });

  // Root health check.
  app.get("/", async () => ({ service: "voxtrade-backend", status: "online" }));

  await app.register(statusRoutes);
  await app.register(analyzeRoutes);
  await app.register(historyRoutes);

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`VoxTrade backend listening on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error starting VoxTrade backend:", err);
  process.exit(1);
});
