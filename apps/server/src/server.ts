import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "http";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { setupWebSocket, closeAllSockets } from "./websocket/ws";
import { SessionStore } from "./store/sessionStore";
import { AICodeGenerator } from "./services/aiCodeGenerator";
import { E2BCodeExecutor } from "./services/e2bCodeExecutor";
import { healthRouter } from "./routes/health";
import { sessionRouter } from "./routes/session";
import { uploadRouter } from "./routes/upload";
import { chatRouter } from "./routes/chat";
import { filesRouter } from "./routes/files";
import { ensureDirectoryExists } from "./utils/fs";
import type { Request, Response, NextFunction } from "express";
import { startSessionCleanup } from "./jobs/sessionCleanup";
import { DockerCodeExecutor } from "./services/dockerCodeExecutor";

const app = express();
const server = http.createServer(app);
setupWebSocket(server);

const store = new SessionStore();
const aiGenerator = new AICodeGenerator();
const codeExecutor = new DockerCodeExecutor();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(
  "/api/",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: "Too many requests from this IP" }),
);

app.use("/api", healthRouter());
app.use("/api", sessionRouter(store));
app.use("/api", uploadRouter(store));
app.use("/api", chatRouter(store, aiGenerator, codeExecutor));
app.use("/api", filesRouter());

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", { error });
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "LIMIT_FILE_SIZE"
  ) {
    return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
  }
  return res.status(500).json({ error: "Internal server error" });
});

async function initializeServer(): Promise<void> {
  await ensureDirectoryExists(env.UPLOAD_DIR);
  await ensureDirectoryExists(env.RESULTS_DIR);
  if (!env.GEMINI_API_KEY) {
    logger.error("GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }
  if (!env.E2B_API_KEY) {
    logger.error("E2B_API_KEY environment variable is required");
    process.exit(1);
  }
  startSessionCleanup(store);
  logger.info("Server initialized successfully");
}

initializeServer()
  .then(() => {
    server.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`);
      logger.info(`Upload directory: ${env.UPLOAD_DIR}`);
      logger.info(`Results directory: ${env.RESULTS_DIR}`);
    });
  })
  .catch((error) => {
    logger.error("Failed to start server", { error });
    process.exit(1);
  });

process.on("SIGTERM", async () => {
  logger.info("Shutting down gracefully...");
  closeAllSockets();
  try {
    // Additional cleanup can be added here
  } catch (error) {
    logger.warn("Cleanup error", { error });
  }
  server.close(() => {
    logger.info("Server stopped");
    process.exit(0);
  });
});

export { app, server };
