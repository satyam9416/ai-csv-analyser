import { Sandbox } from "@e2b/code-interpreter";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env";
import { ExecutionResult, CodeExecutor } from "../types";
import { ensureDirectoryExists } from "../utils/fs";
import { broadcastToSession } from "../websocket/ws";
import { logger } from "../config/logger";

export class E2BCodeExecutor implements CodeExecutor {
  private sandbox: Sandbox | null = null;

  constructor(apiKey: string | undefined = undefined) {
    // Initialize sandbox
    this.initializeSandbox(apiKey);
  }

  private async initializeSandbox(apiKey: string | undefined = undefined): Promise<void> {
    try {
      if (!apiKey && !env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY is not configured");
      }

      this.sandbox = await Sandbox.create({
        apiKey: apiKey ?? env.E2B_API_KEY,
      });
      logger.info("E2B Sandbox initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize E2B Sandbox", { error });
      throw new Error("Failed to initialize code execution environment");
    }
  }

  async executeCode(code: string): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const workDir = path.join(env.RESULTS_DIR, executionId);

    try {
      await ensureDirectoryExists(workDir);

      // store script in workdir for debugging
      // await fs.writeFile(path.join(workDir, "script.py"), code);

      if (!this.sandbox) {
        await this.initializeSandbox();
      }

      // Execute the code
      const execution = await this.sandbox!.runCode(code);
      // Extract output and files - handle different possible response structures
      let output = "";
      if (execution.logs && execution.logs.stdout && Array.isArray(execution.logs.stdout)) {
        output = execution.logs.stdout.join("");
      } else if (execution.text) {
        output = execution.text;
      } else if ((execution as any).stdout) {
        output = (execution as any).stdout;
      } else if ((execution as any).output) {
        output = (execution as any).output;
      } else if (typeof execution === "string") {
        output = execution;
      } else if ((execution as any).result) {
        output = (execution as any).result;
      }

      const files: string[] = [];

      // Process generated files from results - handle different possible structures
      let results = [];
      if (execution.results && Array.isArray(execution.results)) {
        results = execution.results;
      } else if ((execution as any).files && Array.isArray((execution as any).files)) {
        results = (execution as any).files;
      } else if ((execution as any).artifacts && Array.isArray((execution as any).artifacts)) {
        results = (execution as any).artifacts;
      }

      if (results.length > 0) {
        logger.info(`Found ${results.length} generated files`);
        for (const result of results) {
          if (result.png) {
            // Save PNG file to local directory
            const fileName = `plot_${Date.now()}.png`;
            const localFilePath = path.join(workDir, fileName);
            await fs.writeFile(localFilePath, Buffer.from(result.png, "base64"));
            files.push(`${executionId}/${fileName}`);
          }
          if (result.jpeg) {
            // Save JPEG file to local directory
            const fileName = `plot_${Date.now()}.jpg`;
            const localFilePath = path.join(workDir, fileName);
            await fs.writeFile(localFilePath, Buffer.from(result.jpeg, "base64"));
            files.push(`${executionId}/${fileName}`);
          }
          if (result.svg) {
            // Save SVG file to local directory
            const fileName = `plot_${Date.now()}.svg`;
            const localFilePath = path.join(workDir, fileName);
            await fs.writeFile(localFilePath, result.svg);
            files.push(`${executionId}/${fileName}`);
          }
        }
      }

      logger.info("E2B execution completed", {
        outputLength: output.length,
        filesCount: files.length,
      });

      const cleanedOutput = this.cleanOutput(output);
      return {
        success: cleanedOutput.includes("EXECUTION_COMPLETED_SUCCESSFULLY") && !execution.error,
        output: cleanedOutput.replace("=== EXECUTION_COMPLETED_SUCCESSFULLY ===", "").trim(),
        error:
          execution.error || cleanedOutput.includes("EXECUTION_FAILED")
            ? cleanedOutput
                .split("Error during execution:")[1]
                ?.split("=== EXECUTION_FAILED ===")[0]
                ?.trim() || null
            : null,
        files,
        workDir,
      };
    } catch (error) {
      logger.error("E2B Code execution error", { error });
      throw new Error(`Execution failed: ${(error as Error).message}`);
    }
  }

  private cleanOutput(output: string): string {
    // Strip non-printable control characters except tab/newline/carriage return
    return output.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
  }

  async cleanup(): Promise<void> {
    try {
      // E2B sandboxes are automatically cleaned up when they go out of scope
      // or when the process ends, so we just set to null
      this.sandbox = null;
    } catch (error) {
      logger.warn("E2B cleanup error", { error });
    }
  }
}
