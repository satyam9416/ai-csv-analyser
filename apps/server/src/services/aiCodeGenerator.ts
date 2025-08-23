import { GoogleGenerativeAI } from "@google/generative-ai";
import { ParsedCSV } from "../types";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { PROMPTS } from "../config/prompts";

export class AICodeGenerator {
  private model = new GoogleGenerativeAI(env.GEMINI_API_KEY || "").getGenerativeModel({
    model: env.GEMINI_MODEL,
  });

  async generateAnalysisCode(
    userQuery: string,
    csvData: ParsedCSV,
    dataTypes: Record<string, string>,
    options?: { wantsVisualization?: boolean },
  ): Promise<string> {
    const systemPrompt = PROMPTS.CODE_GENERATION.SYSTEM;
    const userPrompt = PROMPTS.CODE_GENERATION.USER_TEMPLATE(
      userQuery,
      csvData,
      dataTypes,
      options,
    );

    const prompt = `${systemPrompt}\n\n${userPrompt}`;

    try {
      const result = await this.model.generateContent(prompt);
      const code = result.response.text();
      const sanitizedCode = this.sanitizeCode(code);
      return sanitizedCode;
    } catch (error) {
      logger.error("Gemini API error while generating code", { error });
      throw error;
    }
  }

  private sanitizeCode(code: string): string {
    const dangerousPatterns: RegExp[] = [
      /import\s+os/gi,
      /import\s+sys/gi,
      /import\s+subprocess/gi,
      /import\s+requests/gi,
      /exec\s*\(/gi,
      /eval\s*\(/gi,
      /__import__/gi,
      /open\s*\(/gi,
      /file\s*\(/gi,
    ];

    let sanitized = code;
    dangerousPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, "# REMOVED_FOR_SECURITY");
    });

    const codeMatch = sanitized.match(/```python\n([\s\S]*?)\n```/);
    if (codeMatch) sanitized = codeMatch[1];
    else sanitized = sanitized.replace(/```[\s\S]*?```/g, "");

    return sanitized.trim();
  }
}
