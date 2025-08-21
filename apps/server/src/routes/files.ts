import path from "path";
import { promises as fs } from "fs";
import { Router } from "express";
import { env } from "../config/env";

export function filesRouter(): Router {
  const router = Router();

  router.get("/files/:filePath(*)", async (req, res) => {
    try {
      const { filePath } = req.params as { filePath?: string };
      if (!filePath) return res.status(400).json({ error: "Invalid parameters" });

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
      return res.status(500).json({ error: "Failed to serve file" });
    }
  });

  return router;
}
