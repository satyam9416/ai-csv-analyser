import multer from "multer";
import path from "path";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { ensureDirectoryExists } from "../utils/fs";
import { env } from "../config/env";
import { SessionStore } from "../store/sessionStore";
import { CSVAnalyzer } from "../services/csvAnalyzer";
import { UploadedFileInfo, ChatMessage } from "../types";
import { broadcastToSession } from "../websocket/ws";

export function uploadRouter(store: SessionStore): Router {
  const router = Router();

  const storage = multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await ensureDirectoryExists(env.UPLOAD_DIR);
        cb(null, env.UPLOAD_DIR);
      } catch (error) {
        cb(error as Error, env.UPLOAD_DIR);
      }
    },
    filename: (req, file, cb) => {
      const sessionId = (req.body as { sessionId?: string }).sessionId || uuidv4();
      const filename = `${sessionId}_${Date.now()}_${file.originalname}`;
      cb(null, filename);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) cb(null, true);
      else cb(new Error("Only CSV files are allowed"));
    },
  });

  router.post("/upload", upload.single("file"), async (req, res) => {
    try {
      const { sessionId } = req.body as { sessionId?: string };
      if (!sessionId) return res.status(400).json({ error: "Invalid session ID" });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const session = store.getOrCreate(sessionId);
      const filePath = (req.file as Express.Multer.File).path;

      const csvData = await CSVAnalyzer.parseCSV(filePath);
      const dataTypes = CSVAnalyzer.analyzeDataTypes(csvData.data);

      const fileInfo: UploadedFileInfo = {
        id: uuidv4(),
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: filePath,
        size: req.file.size,
        uploadedAt: new Date(),
        csvData,
        dataTypes,
      };

      store.addFile(session.id, fileInfo);

      // Set current file context for immediate analysis
      session.context.currentFile = fileInfo;

      // Push a bot confirmation message into chat history
      const numericCount = Object.values(dataTypes).filter((type) => type === "numeric").length;
      const categoricalCount = Object.values(dataTypes).filter(
        (type) => type === "categorical",
      ).length;
      const dateCount = Object.values(dataTypes).filter((type) => type === "date").length;

      const botMsgContent = [
        `✅ **File Uploaded Successfully!**\n`,
        `📁 **${req.file.originalname}**`,
        `📊 **Data Overview:** ${csvData.totalRows.toLocaleString()} rows × ${
          csvData.headers.length
        } columns`,
        `🔢 **Data Types:** ${numericCount} numeric, ${categoricalCount} categorical${
          dateCount > 0 ? `, ${dateCount} date` : ""
        }`,
        csvData.headers.length > 0
          ? `📋 **Columns:** ${csvData.headers.slice(0, 6).join(", ")}${
              csvData.headers.length > 6 ? ` +${csvData.headers.length - 6} more` : ""
            }`
          : "",
        `\n🎯 **Ready for Analysis!** Try asking me to:`,
        `• 📈 **"Show me key statistics and distributions"**`,
        `• 🔗 **"Create a correlation heatmap"**`,
        `• 📊 **"Plot histograms for numeric columns"**`,
        `• 🎨 **"Visualize relationships between variables"**`,
        `• 📋 **"Generate a comprehensive data summary"**`,
        `\n💡 **Pro Tip:** Be specific about what you want to analyze for better results!`,
      ]
        .filter(Boolean)
        .join("\n");

      const botMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: botMsgContent,
        timestamp: new Date(),
      };
      session.messages.push(botMessage);

      return res.json({
        success: true,
        message: `File "${req.file.originalname}" uploaded successfully!`,
        fileInfo: {
          name: req.file.originalname,
          size: req.file.size,
          rows: csvData.totalRows,
          columns: csvData.headers.length,
          headers: csvData.headers,
          dataTypes,
        },
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to process uploaded file" });
    }
  });

  return router;
}
