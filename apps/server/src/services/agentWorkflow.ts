import { StateGraph, Annotation, START, END, CompiledStateGraph } from "@langchain/langgraph";
import { AICodeGenerator } from "./aiCodeGenerator";
import { broadcastToSession } from "../websocket/ws";
import { logger } from "../config/logger";
import { ChatMessage, CodeExecutor, ExecutionResult, UploadedFileInfo } from "../types";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { promises as fs } from "fs";
import { PROMPTS, buildConversationContext } from "../config/prompts";

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

      const conversationContext = buildConversationContext(state.chatHistory || []);
      const systemPrompt = PROMPTS.CHAT_ASSISTANT.SYSTEM;
      const userPrompt = PROMPTS.CHAT_ASSISTANT.USER_TEMPLATE(
        conversationContext,
        state.currentFile,
        state.userInput,
      );

      const prompt = `${systemPrompt}\n\n${userPrompt}`;

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

      try {
        const conversationContext = buildConversationContext(state.chatHistory);

        const systemPrompt = PROMPTS.ANALYSIS_SUMMARY.SYSTEM;

        const userPrompt = PROMPTS.ANALYSIS_SUMMARY.USER_TEMPLATE(
          conversationContext,
          currentFile,
          userInput,
        );

        const summaryPrompt = `${systemPrompt}\n\n${userPrompt}`;
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

    const systemPrompt = PROMPTS.INTENT_CLASSIFICATION.SYSTEM;
    const userPrompt = PROMPTS.INTENT_CLASSIFICATION.USER_TEMPLATE(userInput, recentContext);

    const prompt = `${systemPrompt}\n\n${userPrompt}`;
    const res = await this.classifier.generateContent(prompt);
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
