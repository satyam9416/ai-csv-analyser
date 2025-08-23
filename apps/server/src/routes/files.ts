import path from "path";
import { promises as fs } from "fs";
import { Router } from "express";
import { env } from "../config/env";
import { logger } from "../config/logger";

export function filesRouter(): Router {
  const router = Router();

  router.get("/files/*filePaths", async (req, res) => {
    try {
      const { filePaths } = req.params as { filePaths?: string[] };
      if (!filePaths) return res.status(400).json({ error: "Invalid parameters" });

      const filePath = filePaths.join("/");

      const resolvedBase = path.resolve(env.RESULTS_DIR);
      const resolvedPath = path.resolve(env.RESULTS_DIR, filePath);
      if (!resolvedPath.startsWith(resolvedBase)) {
        return res.status(400).json({ error: "Invalid file path" });
      }

      try {
        await fs.access(resolvedPath);
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        return res.sendFile(resolvedPath);
      } catch {
        return res.status(404).json({ error: "File not found" });
      }
    } catch (_error) {
      logger.error(_error);
      return res.status(500).json({ error: "Failed to serve file" });
    }
  });

  return router;
}
