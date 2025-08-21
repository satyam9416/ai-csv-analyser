import { StateGraph, Annotation, START, END, CompiledStateGraph } from "@langchain/langgraph";
import { AICodeGenerator } from "./aiCodeGenerator";
import { broadcastToSession } from "../websocket/ws";
import { logger } from "../config/logger";
import { ChatMessage, CodeExecutor, ExecutionResult, UploadedFileInfo } from "../types";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { promises as fs } from "fs";

const AgentState = Annotation.Root({
  sessionId: Annotation<string>,
  userInput: Annotation<string>,
  currentFile: Annotation<UploadedFileInfo>,
  generatedCode: Annotation<string>,
  executionResult: Annotation<ExecutionResult>,
  response: Annotation<string>,
  mode: Annotation<"chat" | "analysis">,
  wantsVisualization: Annotation<boolean>,
  chatHistory: Annotation<ChatMessage[]>,
});

export class AgentWorkflow {
  private readonly aiGenerator: AICodeGenerator;
  private readonly codeExecutor: CodeExecutor;
  private readonly classifier: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;
  private readonly chitchat: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

  private readonly workflow = new StateGraph(AgentState)
    .addNode("classify", async (_state: typeof AgentState.State) => {
      if (!_state.currentFile)
        return {
          mode: "chat",
          wantsVisualization: false,
        };

      const { mode, wantsVisualization } = await this.classifyIntent(
        _state.userInput,
        _state.chatHistory,
      );
      return { mode, wantsVisualization };
    })
    .addNode("chat", async (state: typeof AgentState.State) => {
      broadcastToSession(state.sessionId, { type: "status", message: "..." });

      const conversationContext = this.buildConversationContext(state.chatHistory || []);

      const prompt = `You are a helpful and friendly CSV data analysis assistant. You help users understand their data and guide them through analysis. You can make data visualizations by plotting graphs and all.

${conversationContext}

Current context: ${
        state.currentFile
          ? `User has uploaded a CSV file with Data:
              - Total Rows: ${state.currentFile.csvData.totalRows}
              - Columns: ${state.currentFile.csvData.headers.join(", ")}
              - Data Types: ${Object.entries(state.currentFile.dataTypes)
                .map(([col, type]) => `${col}: ${type}`)
                .join(", ")}.

Be conversational, helpful, and suggest what kind of analysis they might want to perform. Keep responses concise but informative.`
          : "User hasn't uploaded any CSV."
      }

Keep your responses consise and user friendly. Don't include unneccessary informations.

Current user message: ${state.userInput}`;

      const res = await this.chitchat.generateContent(prompt);
      const content = res.response.text();
      return { response: content };
    })
    .addNode("generateCode", async (state: typeof AgentState.State) => {
      try {
        broadcastToSession(state.sessionId, {
          type: "status",
          message: "Generating analysis code...",
        });
        const code = await this.aiGenerator.generateAnalysisCode(
          state.userInput,
          state.currentFile.csvData,
          state.currentFile.dataTypes,
          { wantsVisualization: state.wantsVisualization },
        );

        const csvFilePath = state.currentFile.path;

        const csvContent = await fs.readFile(csvFilePath, "utf-8");

        const scriptContent = `
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import warnings
import io
warnings.filterwarnings('ignore')

plt.style.use('default')
sns.set_palette("husl")

# Load CSV data from embedded content
csv_content = """${csvContent.replace(/"/g, '\\"')}"""
df = pd.read_csv(io.StringIO(csv_content))

try:
${code
  .split("\n")
  .map((line) => "    " + line)
  .join("\n")}
    print("=== EXECUTION_COMPLETED_SUCCESSFULLY ===")
except Exception as e:
    print(f"Error during execution: {str(e)}")
    print("=== EXECUTION_FAILED ===")
        `;

        return { generatedCode: scriptContent };
      } catch (error) {
        logger.error("AgentWorkflow.generateCode error", { error });
        throw error;
      }
    })
    .addNode("executeCode", async (state: typeof AgentState.State) => {
      try {
        broadcastToSession(state.sessionId, {
          type: "status",
          message: "Executing code in secure sandbox...",
        });
        const result = await this.codeExecutor.executeCode(state.generatedCode);

        logger.info("Execution result\n", result);
        return { executionResult: result };
      } catch (error) {
        logger.error("AgentWorkflow.executeCode error", { error });
        throw error;
      }
    })
    .addNode("analysisSummary", async (state: typeof AgentState.State) => {
      const { userInput, currentFile } = state;
      let responseContent = "";

      // Generate summary using CSV data, user prompt, and Gemini
      try {
        // Convert CSV data to a readable format for Gemini
        const csvDataString = currentFile.csvData.data
          .map((row) => currentFile.csvData.headers.map((header) => row[header]).join(","))
          .join("\n");

        const csvHeaders = currentFile.csvData.headers.join(",");
        const completeCsvData = `${csvHeaders}\n${csvDataString}`;

        const conversationContext = this.buildConversationContext(state.chatHistory);

        const summaryPrompt = `You are a data analyst. Analyze the following CSV data based on the user's request and provide insights.

${conversationContext}

CSV Data:
${completeCsvData}

Data Summary:
- Total Rows: ${currentFile.csvData.totalRows}
- Columns: ${currentFile.csvData.headers.join(", ")}
- Data Types: ${Object.entries(currentFile.dataTypes)
          .map(([col, type]) => `${col}: ${type}`)
          .join(", ")}

Current User Request: ${userInput}

Please analyze the actual data and provide:
1. Key findings and insights based on the data
2. Relevant statistics and calculations
3. Patterns or trends identified in the data
4. Data-driven recommendations

Consider the conversation history when providing insights. If this is a follow-up question, reference previous analysis appropriately.
Keep the response concise, user-friendly, and focused on actionable insights. Perform actual calculations on the data when relevant.`;

        const summaryResult = await this.chitchat.generateContent(summaryPrompt);
        const summary = summaryResult.response.text();

        responseContent += `📈 **Analysis Summary:**\n${summary}\n\n`;
      } catch (error) {
        logger.error("Failed to generate summary with Gemini", { error });
        // Fallback to basic success message
        responseContent += `📈 **Analysis completed successfully!**\n\n`;
      }

      responseContent += `💡 **What you can do next:**\n`;
      responseContent += `• "Show me how salary relates to experience"\n`;
      responseContent += `• "Create a different type of chart"\n`;
      responseContent += `• "Find unusual patterns in the data"\n`;
      responseContent += `• "Compare different departments or groups"`;

      return { response: responseContent };
    })
    .addEdge(START, "classify")
    .addConditionalEdges("classify", (s: typeof AgentState.State) => {
      console.log({ mode: s.mode, wantsVisualization: s.wantsVisualization });
      return s.mode === "chat" ? "chat" : s.wantsVisualization ? "generateCode" : "analysisSummary";
    })
    .addEdge("chat", END)
    .addEdge("generateCode", "executeCode")
    .addEdge("executeCode", "analysisSummary")
    .addEdge("analysisSummary", END)
    .compile();

  constructor(aiGenerator: AICodeGenerator, codeExecutor: CodeExecutor) {
    this.aiGenerator = aiGenerator;
    this.codeExecutor = codeExecutor;
    const client = new GoogleGenerativeAI(env.GEMINI_API_KEY || "");
    this.classifier = client.getGenerativeModel({ model: env.GEMINI_MODEL });
    this.chitchat = client.getGenerativeModel({ model: env.GEMINI_MODEL });
  }

  private async classifyIntent(
    userInput: string,
    chatHistory: ChatMessage[] = [],
  ): Promise<{ mode: "chat" | "analysis"; wantsVisualization: boolean }> {
    const recentContext = chatHistory
      .slice(-4)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const sys = `Classify the user's intent for a CSV analysis assistant.
Answer strictly as JSON with keys: mode (chat|analysis) and wantsVisualization (true|false).

${recentContext ? `Recent conversation context:\n${recentContext}\n` : ""}

Analysis mode triggers when user asks to:
- analyze, compute, summarize, find, calculate
- plot, chart, visualize, graph, show
- correlation, trend, distribution, pattern
- statistics, stats, mean, median, correlation
- compare, relationship, insight
- follow-up questions about previous analysis (like "what about X column?", "show me more", "can you also check Y?")

Chat mode for:
- general conversation, greetings, thanks
- clarification questions about the tool
- non-analysis related questions

Visualization (wantsVisualization: true) ONLY when user explicitly asks for:
- plot, chart, visualize, graph, show, display
- "create a chart", "make a graph", "show me a plot"
- "visualize the data", "draw a chart"
- "correlation plot", "trend chart", "distribution graph"

For summary-only requests like "summarize", "give me insights", "what are the key findings", use wantsVisualization: false.

For follow-up questions like "show me more details", "what about X", "can you explain", use analysis mode with wantsVisualization: false unless they specifically ask for charts.`;

    const res = await this.classifier.generateContent(`${sys}\nUser: ${userInput}`);
    const txt = res.response.text();
    try {
      const parsed = JSON.parse(txt.replace(/```json\n?|```/g, ""));
      const mode = parsed.mode === "analysis" ? "analysis" : "chat";
      const wants = Boolean(parsed.wantsVisualization);
      return { mode, wantsVisualization: wants };
    } catch {
      // Fallback logic: only want visualization for explicit chart/plot requests
      const wantsVisualization =
        /plot|chart|visual|graph|show.*chart|create.*graph|make.*plot/i.test(userInput);
      return {
        mode: wantsVisualization ? "analysis" : "chat",
        wantsVisualization,
      };
    }
  }

  private buildConversationContext(chatHistory: ChatMessage[]): string {
    if (!chatHistory.length) return "";

    // Get recent conversation history (last 10 messages to avoid token limits)
    const recentHistory = chatHistory.slice(-10);

    let context = "Previous conversation:\n";
    recentHistory.forEach((msg, index) => {
      const role = msg.role === "user" ? "User" : "Assistant";
      context += `${role}: ${msg.content}\n`;

      // Add analysis results if available
      if (msg.executionResult?.success && msg.executionResult.files.length > 0) {
        context += `[Charts created: ${msg.executionResult.files
          .map((f) => f.split("/").pop())
          .join(", ")}]\n`;
      }
    });
    context += "\n";

    return context;
  }

  async run(
    sessionId: string,
    userInput: string,
    currentFile: UploadedFileInfo | undefined,
    chatHistory: ChatMessage[],
  ): Promise<{ content: string; executionResult?: ExecutionResult; generatedCode: string }> {
    const resultState = await this.workflow.invoke({
      sessionId,
      userInput,
      currentFile,
      chatHistory,
    } as typeof AgentState.State);

    if (!resultState.response) {
      throw new Error("Agent workflow did not produce a valid response");
    }

    return {
      content: resultState.response,
      executionResult: resultState.executionResult as ExecutionResult,
      generatedCode: resultState.generatedCode || "",
    };
  }
}
