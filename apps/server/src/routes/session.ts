import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { SessionStore } from "../store/sessionStore";

export function sessionRouter(store: SessionStore): Router {
  const router = Router();

  router.post("/session", (_req, res) => {
    const sessionId = uuidv4();
    store.getOrCreate(sessionId);
    res.json({
      sessionId,
      message:
        '👋 **Welcome to Your AI Data Analyst!**\n\nI\'m here to help you analyze your CSV data with intelligent insights and beautiful visualizations.\n\n**What I can do:**\n• 📊 Create insightful charts and graphs\n• 📈 Perform statistical analysis\n• 🔍 Find correlations and patterns\n• 📋 Generate comprehensive reports\n• 💡 Provide actionable insights\n\n**Getting Started:**\n1. Upload your CSV file using the attachment button\n2. Ask me to analyze specific aspects of your data\n3. I\'ll generate code, run it securely, and show you the results\n\n**Example requests:**\n• "Show me a correlation heatmap"\n• "Create histograms for numeric columns"\n• "Analyze the distribution of salaries"\n• "Find outliers in the data"\n\nReady to explore your data? Upload a CSV file and let\'s get started! 🚀',
    });
  });

  router.get("/history/:sessionId", (req, res) => {
    const { sessionId } = req.params as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: "Invalid session ID" });

    const session = store.find(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    return res.json({
      messages: session.messages,
      uploadedFiles: session.uploadedFiles.map((f) => ({
        id: f.id,
        name: f.originalName,
        size: f.size,
        uploadedAt: f.uploadedAt,
        rows: f.csvData.totalRows,
        columns: f.csvData.headers.length,
      })),
    });
  });

  return router;
}
