import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

const findProjectRoot = (): string => {
  let currentDir = __dirname;
  while (currentDir !== path.dirname(currentDir)) {
    try {
      const packagePath = path.join(currentDir, "package.json");
      const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      if (packageJson.workspaces) {
        return currentDir;
      }
    } catch (error) {
      // Continue searching
    }
    currentDir = path.dirname(currentDir);
  }

  return path.resolve(__dirname, "../../../..");
};

const PROJECT_ROOT = path.resolve(__dirname, findProjectRoot());

const PORT: number = Number(process.env.PORT) || 3001;
const GEMINI_API_KEY: string | undefined = process.env.GEMINI_API_KEY;
const GEMINI_MODEL: string = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const E2B_API_KEY: string | undefined = process.env.E2B_API_KEY;
const FRONTEND_URL: string = process.env.FRONTEND_URL || "http://localhost:5173";
const UPLOAD_DIR: string = path.join(PROJECT_ROOT, "uploads");
const RESULTS_DIR: string = path.join(PROJECT_ROOT, "results");
const SESSION_TIMEOUT: number = 30 * 60 * 1000; // 30 minutes

export const env = {
  PORT,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  E2B_API_KEY,
  FRONTEND_URL,
  UPLOAD_DIR,
  RESULTS_DIR,
  SESSION_TIMEOUT,
  dockerLimits: {
    memoryBytes: 512 * 1024 * 1024,
    cpuShares: 512,
    timeoutMs: 60_000,
  },
};
