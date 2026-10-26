# Multi-Document Research Assistant

> A complete, production-grade NLP web application for academic document processing, dense semantic vector retrieval, Retrieval-Augmented Generation (RAG), and multi-paper comparative analysis.

---

## 1. Project Overview & Architecture

The **Multi-Document Research Assistant** reduces the time required to read, cross-analyze, and extract evidence across complex academic papers, technical reports, and preprints. 

Unlike generic chatbots that produce hallucinated or generic answers, this application is a **genuine RAG system**:
- Extracts text while preserving individual page numbers.
- Segments text into page-attributed overlapping chunks (~450 tokens, ~90 tokens overlap).
- Generates 384-dimensional dense semantic embeddings using Sentence Transformers (`Xenova/all-MiniLM-L6-v2`) or 768-dim Google Gemini embeddings.
- Filters candidate embeddings exclusively within user-selected documents and executes high-performance cosine similarity vector retrieval combined with keyword overlap scoring.
- Grounds LLM answers in exact retrieved passages, providing verifiable citations with document names, page numbers, and expandable excerpts.
- Features an 8-dimension comparative synthesis matrix for comparing multiple research papers.
- Strictly guards against hallucination: detects questions outside document scope and returns an honest insufficient-evidence response.

```
Multi-Document Research Assistant/
├── backend/
│   ├── src/
│   │   ├── config/          # DB connection and environment validation
│   │   ├── models/          # Mongoose Schemas (Document, DocumentChunk, ResearchSession, ChatMessage)
│   │   ├── services/
│   │   │   ├── documents/   # PDF extraction, page-aware chunker, background ingestion
│   │   │   └── ai/          # Embeddings (Xenova/Gemini/OpenAI), VectorStore, RAG, Comparison
│   │   ├── controllers/     # Document, Chat, and Research controllers
│   │   ├── routes/          # REST API endpoints
│   │   ├── middleware/      # Multer file upload & centralized error handling
│   │   ├── tests/           # Vitest NLP unit tests & E2E integration test suite
│   │   ├── app.ts           # Express application setup & CORS
│   │   └── server.ts        # Server bootstrap & graceful shutdown
│   ├── scripts/             # PDFKit test paper generation script
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/      # Persistent Sidebar, Header, AppLayout
│   │   │   ├── documents/   # DocumentUploader, DocumentList, DocumentCard, ProcessingStatus
│   │   │   ├── chat/        # DocumentSelector, ChatMessage, ChatInput, SourceCitation
│   │   │   ├── research/    # ComparisonTable, SummaryPanel
│   │   │   └── common/      # Button, Modal, EmptyState, LoadingState, ErrorMessage
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx   # Real metrics, recent documents, quick start
│   │   │   ├── DocumentsPage.tsx   # Drag-and-drop upload, management, retry, delete
│   │   │   ├── ResearchPage.tsx    # Split-view chat, citations, insufficient evidence alerts
│   │   │   └── ComparePage.tsx     # 8-dimension comparison matrix across ≥2 papers
│   │   ├── context/         # WorkspaceContext for cross-page document selection
│   │   ├── services/        # Centralized Axios API clients
│   │   ├── types/           # TypeScript interfaces
│   │   ├── App.tsx          # React Router v6 configuration
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── samples/                 # Sample research PDFs (Attention Is All You Need, LoRA)
└── package.json             # Root unified scripts
```

---

## 2. Four Important Frontend Pages

1. **Research Dashboard (`/dashboard`)**:
   - Real database metrics: Total Documents, Ready, Ingesting, and Failed.
   - Recent papers table with page count, upload date, status badges, and direct "Research" action.
   - Global document upload modal trigger.
2. **Document Management (`/documents`)**:
   - Drag-and-drop multi-file PDF uploader with progress tracking and file validation (max 25MB).
   - Searchable document grid with status badges (`Ready`, `Processing`, `Queued`, `Failed`).
   - Modal inspection for failed processing errors with a 1-click retry ingestion action.
   - Safe cascading deletion (removes PDF from disk, document metadata, and all vector chunks).
   - Quick Paper Summarize modal.
3. **Research Workspace (`/research`)**:
   - Main RAG split-view interface: left panel for selecting target documents with search and select-all controls.
   - Conversational chat area with session persistence and Markdown rendering.
   - Verifiable source citations for every assistant answer showing document name, page number, relevance score, and expandable excerpts.
   - Dedicated banner alert for questions lacking sufficient document evidence.
   - Starter academic query shortcuts.
4. **Compare Documents (`/compare`)**:
   - Multi-document selector requiring at least 2 ready papers.
   - Optional comparison focus input (e.g. "Attention mechanisms and parameter efficiency").
   - Structured 8-dimension comparison table:
     1. *Research Objective*
     2. *Methodology*
     3. *Model or Technique*
     4. *Dataset*
     5. *Evaluation Metrics*
     6. *Results*
     7. *Limitations*
     8. *Conclusion*
   - Dedicated tabs for Common Similarities, Methodological Differences, Key Findings, Stated Limitations, and Grounded Excerpts.
   - Explicitly displays *"Not found in the provided document"* when a claim is absent.

---

## 3. Technology Stack

- **Frontend**: React 18+, TypeScript, Vite, Tailwind CSS, React Router v6, Axios, Lucide React.
- **Backend**: Node.js 18+ (tested on Node 24), Express.js, TypeScript, Mongoose, Multer.
- **Database**: MongoDB 8.2 (tested and running locally on `mongodb://127.0.0.1:27017/multi_doc_research`).
- **NLP & Ingestion**:
  - `pdf-parse`: page-by-page text extraction.
  - Page-aware recursive text chunker preserving sentence boundaries.
  - `@xenova/transformers`: local `all-MiniLM-L6-v2` ONNX embeddings (runs directly in Node.js without requiring paid API keys or Python services).
- **LLM Integrations**: Configurable support for Google Gemini (`gemini-1.5-flash`), OpenAI (`gpt-4o-mini`), or local Ollama (`llama3`).
- **Vector Retrieval**: High-efficiency in-memory cosine similarity engine filtered by selected document IDs + hybrid keyword scoring, with seamless support for MongoDB Atlas `$vectorSearch`.

---

## 4. Environment Configuration

Copy the example environment configuration:

```bash
cp backend/.env.example backend/.env
```

`backend/.env` options:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Backend server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/multi_doc_research` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:5173` |
| `EMBEDDING_PROVIDER` | Embedding provider (`local`, `gemini`, `openai`) | `local` |
| `EMBEDDING_MODEL` | Embedding model identifier | `all-MiniLM-L6-v2` |
| `LLM_PROVIDER` | LLM provider (`gemini`, `openai`, `ollama`) | `gemini` |
| `LLM_MODEL` | LLM model name | `gemini-1.5-flash` |
| `LLM_API_KEY` | API key for Gemini or OpenAI | *(Set your key for generative answers)* |
| `UPLOAD_DIR` | Local directory for storing PDFs | `./uploads` |
| `MAX_FILE_SIZE_MB` | Maximum PDF file upload size | `25` |
| `VECTOR_SEARCH_PROVIDER`| Vector engine (`local` or `atlas`) | `local` |

> **Note**: Even without an LLM API key, the local vector embedding and retrieval engine operates at 100% capacity: chunks are indexed, cosine similarity retrieval locates the exact passages with page numbers, and evidence is displayed cleanly in the UI. Adding an `LLM_API_KEY` enables generative answer synthesis.

---

## 5. Quick Start Instructions

### Prerequisites
1. Node.js 18+ installed
2. MongoDB running locally on port 27017 (or MongoDB Atlas URI)

### 1. Install Dependencies
```bash
# In backend
cd backend
npm install

# In frontend
cd ../frontend
npm install
```

### 2. Run Tests
Verify the entire ingestion, vector search, and RAG pipeline:
```bash
cd backend
npm test
```
*Expected: 13 / 13 tests passing across unit and end-to-end integration suites.*

### 3. Start Development Servers
From the root directory:
```bash
# Start backend (runs on http://localhost:5000)
npm run dev:backend

# In a second terminal, start frontend (runs on http://localhost:5173)
npm run dev:frontend
```

Now open **`http://localhost:5173`** in your browser.

---

## 6. Sample Documents Provided

Two multi-page academic research PDFs are included in `samples/` for immediate testing:
1. `samples/attention_is_all_you_need.pdf` (Vaswani et al. — Transformers, Scaled Dot-Product Attention, BLEU benchmarks)
2. `samples/lora_low_rank_adaptation.pdf` (Hu et al. — Low-Rank Adaptation, $\Delta W = B \cdot A$, GLUE benchmarks)

You can upload these directly via the UI in the Documents page or Dashboard.

---

## 7. Verification Results

All tests have been executed and passed:
- `backend/src/tests/nlp.test.ts`: 6/6 tests passed (text cleaning, token estimation, page preservation, cosine similarity).
- `backend/src/tests/e2e_pipeline.test.ts`: 7/7 tests passed (PDF extraction, sentence chunking, dense vector embeddings with `@xenova/transformers`, MongoDB persistence, semantic retrieval, page-accurate citations, and insufficient evidence handling).
- Frontend production build: `vite build` completed with 0 errors.
- Backend TypeScript compilation: `tsc` completed with 0 errors.
