import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Send, Bot, Loader2, Paperclip, X, FileText, BarChart3, Database } from "lucide-react";
import useWebSocket from "react-use-websocket";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// StrictMode in dev mounts components twice; use this guard to avoid double init
const useOnce = () => {
  const didRunRef = useRef(false);
  return () => {
    if (didRunRef.current) return false;
    didRunRef.current = true;
    return true;
  };
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "status";
  content: string;
  timestamp: string;
  images?: string[];
  uploadInfo?: {
    name: string;
    size: number;
    rows: number;
    columns: number;
    headers: string[];
    dataTypes: Record<string, string>;
  };
};

type UploadResponse = {
  success: boolean;
  message: string;
  fileInfo: {
    name: string;
    size: number;
    rows: number;
    columns: number;
    headers: string[];
    dataTypes: Record<string, string>;
  };
};

const CSVUploadCard = ({ uploadInfo }: { uploadInfo: UploadResponse["fileInfo"] }) => {
  const numericColumns = Object.values(uploadInfo.dataTypes).filter(
    (type) => type === "numeric",
  ).length;
  const categoricalColumns = Object.values(uploadInfo.dataTypes).filter(
    (type) => type === "categorical",
  ).length;
  const dateColumns = Object.values(uploadInfo.dataTypes).filter((type) => type === "date").length;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 max-w-sm">
      <div className="flex items-start gap-3">
        <div className="bg-blue-100 p-2 rounded-lg">
          <FileText className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-blue-900 truncate">{uploadInfo.name}</h3>
          <div className="flex items-center gap-4 mt-2 text-sm text-blue-700">
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              <span>{uploadInfo.rows.toLocaleString()} rows</span>
            </div>
            <div className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              <span>{uploadInfo.columns} columns</span>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="text-xs text-blue-600 font-medium">Data Types:</div>
            <div className="flex flex-wrap gap-1">
              {numericColumns > 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                  {numericColumns} numeric
                </span>
              )}
              {categoricalColumns > 0 && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                  {categoricalColumns} categorical
                </span>
              )}
              {dateColumns > 0 && (
                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                  {dateColumns} date
                </span>
              )}
            </div>

            {uploadInfo.headers.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-blue-600 font-medium mb-1">Sample Headers:</div>
                <div className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                  {uploadInfo.headers.slice(0, 5).join(", ")}
                  {uploadInfo.headers.length > 5 && "..."}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [, setUploading] = useState<boolean>(false);
  const [thinking, setThinking] = useState<boolean>(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  const shouldInit = useOnce();

  // Start session on mount
  useEffect(() => {
    if (!shouldInit()) return;
    const start = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/session`, { method: "POST" });
        const data = await res.json();
        setSessionId(data.sessionId);
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.message,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "status",
            content: "Failed to start session. Please refresh.",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    };
    start();
  }, [shouldInit]);

  // WebSocket for live status -> render as chat status messages
  const wsUrl = useMemo(
    () => (sessionId ? `${API_BASE.replace("http", "ws")}/?sessionId=${sessionId}` : ""),
    [sessionId],
  );
  const { lastMessage } = useWebSocket(wsUrl, { shouldReconnect: () => true, share: true });

  useEffect(() => {
    if (!lastMessage) return;
    try {
      const payload = JSON.parse(lastMessage.data);
      if (payload?.type === "status" && typeof payload.message === "string") {
        setMessages((m) => {
          // Find the last status message and update it; otherwise append a new one
          let lastStatusIndex = -1;
          for (let i = m.length - 1; i >= 0; i--) {
            if (m[i].role === "status") {
              lastStatusIndex = i;
              break;
            }
          }
          if (lastStatusIndex >= 0) {
            const next = m.slice();
            next[lastStatusIndex] = {
              ...next[lastStatusIndex],
              content: payload.message,
              timestamp: new Date().toISOString(),
            };
            return next;
          }
          return [
            ...m,
            {
              id: crypto.randomUUID(),
              role: "status",
              content: payload.message,
              timestamp: new Date().toISOString(),
            },
          ];
        });
      }
    } catch (error) {
      console.error(error);
    }
  }, [lastMessage]);

  const uploadAttachedFile = async () => {
    if (!attachedFile) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", attachedFile);
      form.append("sessionId", sessionId);
      const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const data: UploadResponse = await res.json();
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: "",
          timestamp: new Date().toISOString(),
          uploadInfo: data.fileInfo,
        },
      ]);
      setAttachedFile(null);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "status",
          content: "Upload failed. Please try again.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !attachedFile) return;

    if (attachedFile) {
      await uploadAttachedFile();
      // Wait a tick to let UI update
      await new Promise((r) => setTimeout(r, 50));
    }

    if (!input.trim()) return;

    // Clear any previous status messages when starting a new request
    setMessages((m) => m.filter((msg) => msg.role !== "status"));

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setThinking(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: userMsg.content, messageId: userMsg.id }),
      });
      const data = await res.json();
      const imageUrls: string[] = Array.isArray(data.files)
        ? data.files.map((p: string) => `${API_BASE}/api/files/${p}`)
        : [];
      setMessages((m) => {
        const cleaned = m.filter((msg) => msg.role !== "status");
        return [
          ...cleaned,
          {
            id: data.messageId,
            role: "assistant",
            content: data.response,
            timestamp: new Date().toISOString(),
            images: imageUrls,
          } as ChatMessage,
        ];
      });
    } catch {
      setMessages((m) => {
        const cleaned = m.filter((msg) => msg.role !== "status");
        return [
          ...cleaned,
          {
            id: crypto.randomUUID(),
            role: "status",
            content: "Failed to send message. Please try again.",
            timestamp: new Date().toISOString(),
          } as ChatMessage,
        ];
      });
    } finally {
      setThinking(false);
    }
  };

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center gap-3">
          <Bot className="h-6 w-6" />
          <h1 className="text-lg font-semibold">AI Data Analyst</h1>
          <div className="ml-auto text-xs text-slate-500">Session: {sessionId.slice(0, 8)}</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-6">
        <div className="bg-white rounded-xl border p-4 flex flex-col h-[75vh]">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 shadow-sm max-w-[85%] ${
                    m.role === "user"
                      ? "bg-blue-600 text-white"
                      : m.role === "assistant"
                      ? "bg-slate-100"
                      : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {m.uploadInfo ? (
                    <CSVUploadCard uploadInfo={m.uploadInfo} />
                  ) : (
                    <>
                      {m.images && m.images.length > 0 && (
                        <div className="mt-3 grid grid-cols-1 gap-3">
                          {m.images.map((src) => (
                            <img
                              key={src}
                              src={src}
                              alt={src}
                              className="w-full rounded-lg border"
                            />
                          ))}
                        </div>
                      )}
                      {m.role === "assistant" ? (
                        <div className="prose prose-slate prose-sm">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="prose prose-slate prose-sm">
                          {m.content.split("\n").map((line, idx) => (
                            <p key={idx} className={m.role === "status" ? "italic" : ""}>
                              {line || "\u00A0"}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="mt-4 space-y-2">
            {attachedFile && (
              <div className="flex items-center justify-between rounded-xl border bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> {attachedFile.name}
                </div>
                <button
                  className="text-slate-500 hover:text-slate-700"
                  onClick={() => setAttachedFile(null)}
                  aria-label="Remove attachment"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <form className="flex items-center gap-2" onSubmit={sendMessage}>
              <label className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-slate-50 cursor-pointer">
                <Paperclip className="h-4 w-4" />
                <span className="text-sm">Attach CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => setAttachedFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <input
                className="flex-1 rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                required
              />
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
                disabled={(thinking && !attachedFile) || !input}
              >
                {thinking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
