import { Server as HttpServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { logger } from "../config/logger";

const wsConnections: Map<string, WebSocket> = new Map();
let wss: WebSocketServer | null = null;

export function setupWebSocket(server: HttpServer): void {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WebSocket, req) => {
    const sessionId = new URL(req.url || "", "http://localhost").searchParams.get("sessionId");
    if (sessionId) {
      wsConnections.set(sessionId, ws);
      logger.debug(`WebSocket connected for session ${sessionId}`);

      ws.on("close", () => {
        wsConnections.delete(sessionId);
        logger.debug(`WebSocket closed for session ${sessionId}`);
      });
    }
  });
}

export function broadcastToSession(sessionId: string, message: unknown): void {
  const ws = wsConnections.get(sessionId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function closeAllSockets(): void {
  if (!wss) return;
  wss.clients.forEach((client) => client.close());
}
