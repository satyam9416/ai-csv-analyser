import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { AICodeGenerator } from "../services/aiCodeGenerator";
import { AgentWorkflow } from "../services/agentWorkflow";
import { SessionStore } from "../store/sessionStore";
import { ChatMessage, CodeExecutor } from "../types";
import { broadcastToSession } from "../websocket/ws";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { logger } from "../config/logger";

export function chatRouter(
  store: SessionStore,
  aiGenerator: AICodeGenerator,
  codeExecutor: CodeExecutor,
): Router {
  const router = Router();
  const agentWorkflow = new AgentWorkflow(aiGenerator, codeExecutor);

  router.post("/chat", async (req, res) => {
    try {
      const { sessionId, message, messageId } = req.body as {
        sessionId?: string;
        message?: string;
        messageId?: string;
      };

      if (!sessionId) return res.status(400).json({ error: "Invalid session ID" });
      if (!message) return res.status(400).json({ error: "Invalid message" });

      const session = store.getOrCreate(sessionId);

      const userMessage: ChatMessage = {
        id: messageId || uuidv4(),
        role: "user",
        content: message,
        timestamp: new Date(),
      };

      session.messages.push(userMessage);

      broadcastToSession(sessionId, { type: "status", message: "..." });
      const currentFile = session.context.currentFile;

      const { content, executionResult } = await agentWorkflow.run(
        sessionId,
        message,
        currentFile,
        session.messages || [],
      );

      const botResponse: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content,
        timestamp: new Date(),
        executionResult,
      };

      session.messages.push(botResponse);

      return res.json({
        success: true,
        response: botResponse.content,
        messageId: botResponse.id,
        hasVisualization: (executionResult?.files?.length ?? 0) > 0,
        files: executionResult?.files ?? [],
      });
    } catch (_error) {
      logger.error("Error in chat route", {
        error: _error,
        stack: _error instanceof Error ? _error.stack : undefined,
      });
      const errorResponse: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content:
          "❌ Sorry, I encountered an error processing your request. Please try again with a different approach.",
        timestamp: new Date(),
      };
      const { sessionId } = req.body as { sessionId?: string };
      const session = store.getOrCreate(sessionId);
      session.messages.push(errorResponse);
      return res.status(500).json({
        success: false,
        error: "Processing failed",
        response: errorResponse.content,
        messageId: errorResponse.id,
      });
    }
  });

  return router;
}
