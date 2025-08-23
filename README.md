# AI CSV Analyzer

An intelligent web application that analyzes CSV files using AI and executes
code in secure environments. Upload your CSV data, ask questions in natural
language, and get insights with generated code execution.

## 🚀 Features

- **CSV Upload & Analysis**: Upload CSV files and get automatic data type
  detection
- **AI-Powered Chat**: Ask questions about your data in natural language
- **Code Generation**: AI generates Python code to analyze your data
- **Secure Code Execution**: Runs code in isolated Docker containers or E2B
  environments
- **Real-time Updates**: WebSocket-based real-time communication
- **Session Management**: Persistent sessions with automatic cleanup
- **Modern UI**: Beautiful React interface with Tailwind CSS

## 🏗️ Architecture

This is a monorepo with two main applications:

- **Client** (`apps/client`): React + TypeScript + Vite frontend
- **Server** (`apps/server`): Node.js + Express + TypeScript backend

### Tech Stack

**Frontend:**

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Lucide React (icons)
- React Markdown
- WebSocket for real-time updates

**Backend:**

- Node.js + Express
- TypeScript
- Google Gemini AI
- LangGraph
- E2B Code Interpreter / Dockerode
- WebSocket
- Winston logging
- Rate limiting & security middleware

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker (for local code execution)
- Google Gemini API key
- E2B API key (optional, for faster and cloud code execution)

## 🛠️ Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd ai-csv-analyser
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:** Copy the example environment file and
   configure it:

   ```bash
   cp env.example .env
   ```

   Edit the `.env` file with your API keys:

   ```env
   # Required
   GEMINI_API_KEY=your_gemini_api_key_here

   # Optional
   E2B_API_KEY=your_e2b_api_key_here  # remove it if not using
   GEMINI_MODEL=gemini-1.5-flash
   PORT=3001
   FRONTEND_URL=http://localhost:5173
   ```

4. **Start the development servers:**

   ```bash
   npm run dev
   ```

   This will start both the client (port 5173) and server (port 3001) in
   development mode.

## 🚀 Development

### Available Scripts

**Root level:**

- `npm run dev` - Start both client and server in development mode
- `npm run dev:client` - Start only the client
- `npm run dev:server` - Start only the server
- `npm run build` - Build both client and server for production
- `npm run build:client` - Build only the client
- `npm run build:server` - Build only the server
- `npm run start` - Build and start the server in production mode
- `npm run clean` - Clean all node_modules directories
- `npm run install:clean` - Clean and reinstall dependencies

**Client (`apps/client`):**

- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

**Server (`apps/server`):**

- `npm run dev` - Start with nodemon for development
- `npm run build` - Build TypeScript
- `npm run start` - Build and start production server

### Project Structure

```
ai-csv-analyser/
├── apps/
│   ├── client/                 # React frontend
│   │   ├── src/
│   │   │   ├── App.tsx        # Main application component
│   │   │   └── main.tsx       # Entry point
│   │   └── package.json
│   └── server/                 # Node.js backend
│       ├── src/
│       │   ├── config/        # Configuration files
│       │   ├── routes/        # Express routes
│       │   ├── services/      # Business logic services
│       │   ├── store/         # Session management
│       │   ├── types/         # TypeScript type definitions
│       │   ├── utils/         # Utility functions
│       │   ├── websocket/     # WebSocket handling
│       │   └── server.ts      # Main server file
│       └── package.json
├── uploads/                    # Uploaded CSV files
├── results/                    # Generated analysis results
└── package.json               # Root package.json with workspaces
```

## 🔧 Configuration

### Environment Variables

| Variable         | Required | Default                 | Description                           |
| ---------------- | -------- | ----------------------- | ------------------------------------- |
| `GEMINI_API_KEY` | Yes      | -                       | Google Gemini API key for AI features |
| `E2B_API_KEY`    | No       | -                       | E2B API key for cloud code execution  |
| `GEMINI_MODEL`   | No       | `gemini-1.5-flash`      | Gemini model to use                   |
| `PORT`           | No       | `3001`                  | Server port                           |
| `FRONTEND_URL`   | No       | `http://localhost:5173` | Frontend URL for CORS                 |

### Docker Configuration

The application uses Docker for secure code execution with the following limits:

- Memory: 512MB
- CPU shares: 512
- Timeout: 60 seconds
- Network Isolation

## 🚀 Deployment

### Production Build

1. **Build both applications:**

   ```bash
   npm run build
   ```

   Or build individually:

   ```bash
   npm run build:client  # Build frontend
   npm run build:server  # Build backend
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

### Environment Setup for Production

Make sure to set all required environment variables in your production
environment:

```bash
export GEMINI_API_KEY=your_production_key
export E2B_API_KEY=your_e2b_key  # Optional
export PORT=3001
export FRONTEND_URL=https://your-domain.com
```

## 🔒 Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Protection**: Configured for specific frontend URL
- **Helmet**: Security headers
- **File Upload Limits**: 10MB maximum file size
- **Input Validation**: Zod schema validation
- **Session Management**: Automatic cleanup of old sessions

## 📊 API Endpoints

### Health Check

- `GET /api/health` - Server health status

### Session Management

- `POST /api/session` - Create new session
- `DELETE /api/session/:id` - Delete session

### File Upload

- `POST /api/upload` - Upload CSV file
- `GET /api/files/:filename` - Download file

### Chat

- `POST /api/chat` - Send chat message
- WebSocket connection for real-time updates
