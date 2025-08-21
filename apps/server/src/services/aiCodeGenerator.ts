import { GoogleGenerativeAI } from "@google/generative-ai";
import { ParsedCSV } from "../types";
import { env } from "../config/env";
import { logger } from "../config/logger";

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
    const numericColumns = Object.entries(dataTypes)
      .filter(([, type]) => type === "numeric")
      .map(([col]) => col);
    const categoricalColumns = Object.entries(dataTypes)
      .filter(([, type]) => type === "categorical")
      .map(([col]) => col);
    const dateColumns = Object.entries(dataTypes)
      .filter(([, type]) => type === "date")
      .map(([col]) => col);

    const prompt = `
You are an expert data analyst and visualization specialist. Generate secure Python code to analyze the provided CSV data based on the user's request.

User Request: "${userQuery}"

Data Information:
- Headers: ${csvData.headers.join(", ")}
- Data Types: ${JSON.stringify(dataTypes)}
- Numeric Columns: ${numericColumns.join(", ")}
- Categorical Columns: ${categoricalColumns.join(", ")}
- Date Columns: ${dateColumns.join(", ")}
- Total Rows: ${csvData.totalRows}

Analysis Guidelines:
1. **Intelligent Plot Selection**: Choose the most appropriate visualizations based on data types and user request:
   - For numeric data: histograms, box plots, scatter plots, correlation heatmaps
   - For categorical data: bar charts, pie charts, count plots
   - For relationships: scatter plots, correlation analysis, pair plots
   - For trends: line plots, time series analysis
   - For distributions: histograms, density plots, violin plots


3. **Summary Generation**: Extract meaningful summary from the data and provide actionable recommendations.

Requirements:
1. Use only pandas, matplotlib, seaborn, numpy, and scipy
3. Handle missing values appropriately (imputation strategies)
4. Include robust error handling
5. Generate clear, actionable summary of the analysis
6. No file system access outside the working directory
7. No network requests or external connections
8. No subprocess or system calls${
      options?.wantsVisualization !== false
        ? `
9. Create intelligent, publication-ready visualizations
10. Save plots as high-quality PNG files with descriptive names
11. Use appropriate color schemes and styling
12. Don't print any output to the console
13. Only print the user friendly summary to the console
13. Include proper titles, labels, and legends`
        : ""
    }

Return a complete Python script that:
- Uses the pre-loaded DataFrame 'df' (CSV data is already loaded), don't create any dummy data on yourself
- Performs comprehensive analysis based on the user's request${
      options?.wantsVisualization !== false
        ? `
- Creates intelligent visualizations with proper styling
- Saves plots with descriptive filenames`
        : ""
    }
- Provides user friendly summary of the analysis
- Handles errors gracefully with informative messag
- Prints a clear, readable summary of findings

Note: The DataFrame 'df' is already loaded with the CSV data, so you don't need to read the file again.

Format the response as clean Python code only.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const code = result.response.text();
      const sanitizedCode = this.sanitizeCode(code);
      return sanitizedCode;
    } catch (error) {
      logger.error("Gemini API error while generating code", { error });
      throw new Error("Failed to generate analysis code");
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
