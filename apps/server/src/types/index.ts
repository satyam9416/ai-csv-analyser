export interface ParsedCSV {
  headers: string[];
  data: Array<Record<string, string>>;
  totalRows: number;
  sample: Array<Record<string, string>>;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error: string | null;
  files: string[];
  workDir: string;
}

export interface CodeExecutor {
  executeCode(code: string): Promise<ExecutionResult>;
  cleanup(): Promise<void>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  executionResult?: ExecutionResult;
}

export interface UploadedFileInfo {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  uploadedAt: Date;
  csvData: ParsedCSV;
  dataTypes: Record<string, string>;
}

export interface SessionContext {
  currentFile?: UploadedFileInfo;
  [key: string]: unknown;
}

export interface Session {
  id: string;
  messages: ChatMessage[];
  uploadedFiles: UploadedFileInfo[];
  context: SessionContext;
  lastActivity: number;
}
