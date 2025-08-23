import path from "path";
import { promises as fs } from "fs";
import Docker from "dockerode";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env";
import { ExecutionResult, CodeExecutor } from "../types";
import { ensureDirectoryExists } from "../utils/fs";
import { logger } from "../config/logger";

export class DockerCodeExecutor implements CodeExecutor {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  async executeCode(code: string): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const workDir = path.join(env.RESULTS_DIR, executionId);
    const absWorkDir = path.resolve(workDir);

    try {
      await ensureDirectoryExists(workDir);

      await fs.writeFile(path.join(workDir, "script.py"), code);

      const dockerfile = `
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "script.py"]
`;

      const requirements = `
pandas==2.0.3
matplotlib==3.7.2
seaborn==0.12.2
numpy==1.24.3
scipy==1.11.1
`;

      await fs.writeFile(path.join(workDir, "Dockerfile"), dockerfile);
      await fs.writeFile(path.join(workDir, "requirements.txt"), requirements);

      const image = await this.buildImage(workDir, executionId);

      const output = await this.runContainer(image, executionId, absWorkDir);

      const files = await fs.readdir(workDir);
      const generatedFiles = files.filter(
        (f) => f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".svg"),
      );

      await this.cleanupDocker(image, executionId);

      const cleanedOutput = this.cleanOutput(output);
      return {
        success: cleanedOutput.includes("EXECUTION_COMPLETED_SUCCESSFULLY"),
        output: cleanedOutput.replace("=== EXECUTION_COMPLETED_SUCCESSFULLY ===", "").trim(),
        error: cleanedOutput.includes("EXECUTION_FAILED")
          ? cleanedOutput
              .split("Error during execution:")[1]
              ?.split("=== EXECUTION_FAILED ===")[0]
              ?.trim() || null
          : null,
        files: generatedFiles.map((f) => `${executionId}/${f}`),
        workDir,
      };
    } catch (error) {
      logger.error("Code execution error", { error });
      throw new Error(`Execution failed: ${(error as Error).message}`);
    }
  }

  private async buildImage(workDir: string, executionId: string): Promise<string> {
    const imageName = `ai-analysis-${executionId}`;

    const stream = await this.docker.buildImage(
      { context: workDir, src: ["Dockerfile", "script.py", "requirements.txt"] },
      { t: imageName },
    );

    return new Promise((resolve, reject) => {
      (
        this.docker as unknown as {
          modem: { followProgress: (s: unknown, cb: (err?: Error, res?: unknown) => void) => void };
        }
      ).modem.followProgress(stream as unknown, (err?: Error) => {
        if (err) reject(err);
        else resolve(imageName);
      });
    });
  }

  private async runContainer(
    imageName: string,
    executionId: string,
    absWorkDir: string,
  ): Promise<string> {
    const container = await this.docker.createContainer({
      Image: imageName,
      name: `execution-${executionId}`,
      WorkingDir: "/app",
      Tty: true,
      HostConfig: {
        NetworkMode: "none",
        Memory: env.dockerLimits.memoryBytes,
        CpuShares: env.dockerLimits.cpuShares,
        Binds: [`${absWorkDir}:/app`],
      },
    });

    await container.start();

    const output = await Promise.race<string>([
      this.getContainerOutput(container),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Execution timeout")), env.dockerLimits.timeoutMs),
      ) as Promise<string>,
    ]);

    await container.remove();
    return output;
  }

  private async getContainerOutput(container: Docker.Container): Promise<string> {
    return new Promise((resolve, reject) => {
      container.logs({ stdout: true, stderr: true, follow: true }, (err, stream) => {
        if (err) return reject(err);
        let output = "";
        if (!stream) return resolve(output);
        stream.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        stream.on("end", () => resolve(output));
        stream.on("error", reject);
      });
    });
  }

  private cleanOutput(output: string): string {
    // Strip non-printable control characters except tab/newline/carriage return
    return output.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
  }

  private async cleanupDocker(imageName: string, _executionId: string): Promise<void> {
    try {
      const image = this.docker.getImage(imageName);
      await image.remove();
    } catch (error) {
      logger.warn("Docker cleanup error", { error });
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Docker containers are cleaned up after each execution
      // This method is called for interface compliance
      logger.info("DockerCodeExecutor cleanup completed");
    } catch (error) {
      logger.warn("DockerCodeExecutor cleanup error", { error });
    }
  }
}
