import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowLeft,
  Layers,
  Cpu,
  TableProperties,
  Binary,
  CheckCircle2,
  FileText,
  Database,
  Search,
  Filter,
  Bot,
  Quote,
  GitCompare,
  History,
  AlertTriangle,
  Info,
  ShieldCheck,
  Zap,
  BookOpen,
  FileCheck2,
} from 'lucide-react';

export const WorkflowGuidePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'ingestion' | 'retrieval' | 'generation'>('all');

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navLinks = [
    { id: 'overview', label: '1. Overview', icon: BookOpen },
    { id: 'workflow', label: '2. Workflow & Pipeline', icon: Layers },
    { id: 'technologies', label: '3. Tech Stack & Uses', icon: Cpu },
    { id: 'rubric', label: '4. Rubric Mapping (CO1–CO4)', icon: TableProperties },
    { id: 'algorithms', label: '5. Algorithms & NLP', icon: Binary },
    { id: 'demo', label: '6. Faculty Demo Guide', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-full bg-slate-50 text-slate-800 pb-20">
      {/* Top Banner / Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/research"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-brand-50 hover:text-brand-600 rounded-lg border border-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Research Workspace</span>
            </Link>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-brand-100 text-brand-700 border border-brand-200">
                  Academic Reference & Architecture
                </span>
                <span className="text-xs text-slate-400 font-medium">v1.2 Production</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Project Workflow & Technology Guide
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/compare"
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-xs hover:bg-slate-50 transition-colors"
            >
              View Compare Matrix
            </Link>
            <Link
              to="/research"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm shadow-brand-500/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch Live Assistant</span>
            </Link>
          </div>
        </div>

        {/* Quick Jump Navigation Bar */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] shrink-0 mr-1">
              Jump to Section:
            </span>
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-slate-600 hover:text-brand-600 hover:bg-white hover:shadow-xs border border-transparent hover:border-slate-200 font-medium whitespace-nowrap transition-all"
              >
                <link.icon className="w-3 h-3 text-slate-400" />
                <span>{link.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-8 space-y-16">
        {/* ========================================== */}
        {/* SECTION 1: PROJECT OVERVIEW */}
        {/* ========================================== */}
        <section id="overview" className="scroll-mt-32">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold mb-2">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Section 1</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Project Overview</h2>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              An executive summary explaining what the system does, the specific real-world academic research challenge it addresses, and how it differs from traditional document readers and generic chatbots.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1 */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs hover:border-brand-200 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                What is a Multi-Document Research Assistant?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                The <strong>Multi-Document Research Assistant</strong> is an intelligent knowledge retrieval and synthesis platform engineered specifically for academic literature, technical research papers, and institutional reports. It allows researchers to upload heterogeneous documents (PDF, Word DOCX/DOC, and TXT), index them using a <em>local semantic vector engine</em>, and ask complex research inquiries that require synthesizing evidence across multiple papers simultaneously with verifiable page-level citations.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs hover:border-brand-200 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                What Problem Does It Solve?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Conducting literature reviews requires reading dozens of 10-to-30 page papers. Researchers encounter three critical bottlenecks:
              </p>
              <ul className="text-sm text-slate-600 space-y-1.5 mt-2 list-disc list-inside">
                <li><strong>Information Silos:</strong> Keyword searches (Ctrl+F) fail when papers use synonymous terminology or different technical phrasing.</li>
                <li><strong>Context Limitations:</strong> Generic LLMs cannot fit multiple complete 20-page papers into a single prompt without token limits and degradation.</li>
                <li><strong>AI Hallucination:</strong> Commercial chatbots invent plausible-sounding benchmark numbers and fictitious paper citations.</li>
              </ul>
            </div>

            {/* Card 3 */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs hover:border-brand-200 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Why is It Useful?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                It transforms passive document archives into an active, conversational knowledge base. Researchers can:
              </p>
              <ul className="text-sm text-slate-600 space-y-1.5 mt-2 list-disc list-inside">
                <li>Formulate complex cross-paper queries (e.g., <em>"Compare the training datasets and accuracy between Paper A and Paper B"</em>).</li>
                <li>Trace every generated assertion back to its original source document and page number.</li>
                <li>Generate automated 10-dimension comparison matrices across objectives, methodologies, datasets, and limitations.</li>
                <li>Operate locally with zero external vector database subscription costs.</li>
              </ul>
            </div>

            {/* Card 4 */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs hover:border-brand-200 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                What Makes It Different from a Reader or Generic Chatbot?
              </h3>
              <div className="space-y-2 mt-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-800">Conventional PDF Reader:</span>
                  <span className="text-slate-600 ml-1">Static viewer with raw keyword search. Cannot answer queries, compare documents, or synthesize insights.</span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 text-amber-900">
                  <span className="font-bold">Generic Cloud Chatbot (e.g. ChatGPT):</span>
                  <span className="ml-1">Lacks private local corpus access, hallucinates citations, leaks proprietary drafts to cloud providers, and lacks strict page anchoring.</span>
                </div>
                <div className="p-2.5 rounded-lg bg-brand-50 border border-brand-200 text-brand-900">
                  <span className="font-bold">Our Assistant:</span>
                  <span className="ml-1">Hybrid Retrieval (Dense Vector + BM25) with Reciprocal Rank Fusion (RRF), MMR diversity filtering, local ONNX embeddings, and strict anti-hallucination citation validation.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* SECTION 2: COMPLETE PROJECT WORKFLOW */}
        {/* ========================================== */}
        <section id="workflow" className="scroll-mt-32">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold mb-2">
              <Layers className="w-3.5 h-3.5" />
              <span>Section 2</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Complete Project Workflow</h2>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              A comprehensive end-to-end visualization of the system architecture. Follow the sequential progression from raw multi-format document ingestion through local vectorization, hybrid ranking, grounded generation, and verified citation anchoring.
            </p>
          </div>

          {/* Workflow Stage Filter Buttons */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs font-semibold text-slate-500 mr-1">Filter View:</span>
            {[
              { id: 'all', label: 'Complete End-to-End Pipeline (Steps 1–14)' },
              { id: 'ingestion', label: '1. Ingestion & Vector Storage' },
              { id: 'retrieval', label: '2. Hybrid Retrieval & RRF' },
              { id: 'generation', label: '3. Grounded Generation & Citations' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sequential Visual Pipeline Steps */}
          <div className="space-y-4">
            {/* STAGE 1: INGESTION & PROCESSING */}
            {(activeTab === 'all' || activeTab === 'ingestion') && (
              <div className="bg-white rounded-xl border border-blue-200 shadow-xs overflow-hidden">
                <div className="bg-blue-50/80 px-6 py-3 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Stage 1: Document Ingestion, Preprocessing & Local Vectorization
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    Steps 1 to 7
                  </span>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Step 1 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Step 1</span>
                        <FileText className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Multi-Format Upload</h4>
                      <p className="text-xs text-slate-600">
                        User selects files via drag-and-drop or file picker. Supports <code>.pdf</code>, <code>.docx</code>, <code>.doc</code>, and <code>.txt</code>.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      Multer middleware (50MB limit)
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Step 2</span>
                        <ShieldCheck className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Validation & Security</h4>
                      <p className="text-xs text-slate-600">
                        Inspects MIME type, magic bytes, file extensions, and checks for corrupted or empty uploads before proceeding.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      upload.ts validation filter
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Step 3</span>
                        <FileCheck2 className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Text Extraction</h4>
                      <p className="text-xs text-slate-600">
                        Extracts text streams and page boundaries using specialized parsers for each format:
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      pdf-parse, mammoth, word-extractor
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Step 4</span>
                        <Filter className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Cleaning & Normalizing</h4>
                      <p className="text-xs text-slate-600">
                        Strips unprintable control characters, fixes hyphens, normalizes unicode whitespaces, and preserves paragraph breaks.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      extractor.ts cleanText regex
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Step 5</span>
                        <Layers className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Document Chunking</h4>
                      <p className="text-xs text-slate-600">
                        Splits document into sliding-window text chunks (500–1000 characters) with 15% overlap, preserving page numbers and offsets.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      chunker.ts semantic chunking
                    </div>
                  </div>

                  {/* Step 6 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">Step 6</span>
                        <Cpu className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Local Embedding</h4>
                      <p className="text-xs text-slate-600">
                        In-memory neural vectorization generating 384-dimensional dense float arrays using <code>Xenova/all-MiniLM-L6-v2</code> ONNX model.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      embeddingService.ts (Node.js ONNX)
                    </div>
                  </div>

                  {/* Step 7 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between lg:col-span-2">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">Step 7</span>
                        <Database className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">MongoDB Vector & Metadata Persistence</h4>
                      <p className="text-xs text-slate-600">
                        Saves document records to <code>DocumentModel</code> (page count, checksum, status: ready) and individual chunks with 384d vectors to <code>ChunkModel</code>. Atomic transactional replacement ensures zero chunk corruption during reprocessing.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      Mongoose: DocumentModel & ChunkModel
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 2: HYBRID RETRIEVAL & RE-RANKING */}
            {(activeTab === 'all' || activeTab === 'retrieval') && (
              <div className="bg-white rounded-xl border border-amber-200 shadow-xs overflow-hidden">
                <div className="bg-amber-50/80 px-6 py-3 border-b border-amber-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Stage 2: Conversational Inquiry & Dual-Channel Hybrid Retrieval
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    Steps 8 to 11
                  </span>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Step 8 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">Step 8</span>
                        <Search className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Query & Follow-up Context</h4>
                      <p className="text-xs text-slate-600">
                        User inputs inquiry. System checks last 6 conversation turns and uses conversational query rewriting to resolve ambiguous pronouns (e.g. <em>"What are its limits?"</em>).
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      ragService.ts queryRewriting
                    </div>
                  </div>

                  {/* Step 9 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">Step 9</span>
                        <Zap className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Dual Hybrid Retrieval</h4>
                      <p className="text-xs text-slate-600">
                        Executes two parallel search streams across selected documents:
                        <br /><strong>1. Dense Vector:</strong> Cosine similarity on 384d embeddings.
                        <br /><strong>2. Lexical Search:</strong> In-memory Okapi BM25 for keywords.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      vectorStore.ts & bm25.ts
                    </div>
                  </div>

                  {/* Step 10 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">Step 10</span>
                        <Binary className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Reciprocal Rank Fusion</h4>
                      <p className="text-xs text-slate-600">
                        Combines semantic and BM25 rank positions without score calibration issues using formula:
                        <code className="block mt-1 bg-white p-1 rounded text-[10px]">RRF = 1 / (60 + rank)</code>
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      vectorStore.ts computeRRF()
                    </div>
                  </div>

                  {/* Step 11 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">Step 11</span>
                        <Filter className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">MMR Diversity Selection</h4>
                      <p className="text-xs text-slate-600">
                        Maximal Marginal Relevance (λ = 0.7) eliminates redundant, duplicate passages, guaranteeing diverse perspectives from all selected papers.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      vectorStore.ts computeMMR()
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 3: GENERATION & CITATIONS */}
            {(activeTab === 'all' || activeTab === 'generation') && (
              <div className="bg-white rounded-xl border border-purple-200 shadow-xs overflow-hidden">
                <div className="bg-purple-50/80 px-6 py-3 border-b border-purple-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                    <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                      Stage 3: Context Assembly, LLM Generation & Verifiable Citations
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                    Steps 12 to 14
                  </span>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Step 12 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">Step 12</span>
                        <ShieldCheck className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Prompt Hardening & Grounding</h4>
                      <p className="text-xs text-slate-600">
                        Injects top candidate chunks into an isolated prompt enclosure with strict anti-injection rules: answer only using provided text; explicitly state if insufficient.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      ragService.ts buildSystemPrompt()
                    </div>
                  </div>

                  {/* Step 13 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">Step 13</span>
                        <Bot className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Multi-Provider LLM Synthesis</h4>
                      <p className="text-xs text-slate-600">
                        Queries configured LLM engine: Google Gemini 2.5 Flash, OpenAI GPT-4o, local offline Ollama (Llama-3), or deterministic Mock for testing.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      llmService.ts multi-provider adapter
                    </div>
                  </div>

                  {/* Step 14 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">Step 14</span>
                        <Quote className="w-4 h-4 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Citation Verification & UI Rendering</h4>
                      <p className="text-xs text-slate-600">
                        Extracts and validates citations <code>[Doc: ..., Page: ...]</code>. Highlights source chunks in the response and enables one-click snippet inspection.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                      citationVerifier.ts & frontend UI
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Specialized Auxiliary Workflows */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 mb-3 text-brand-600">
                <GitCompare className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900">10-Dimension Cross Comparison</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                Queries all selected documents simultaneously across 10 structured academic facets: Objectives, Methodology, Dataset/Benchmarks, Results, Advantages, Research Gaps, Technical Innovations, Practical Implications, Future Work, and Verdict.
              </p>
              <div className="text-[11px] font-mono bg-slate-50 p-2 rounded border border-slate-200 text-slate-600">
                backend: comparisonService.ts
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 mb-3 text-indigo-600">
                <FileText className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900">Automated Executive Summarization</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                Generates instant executive syntheses for single documents or multi-paper corpora, summarizing high-level contributions, research methodologies, and validated quantitative outcomes.
              </p>
              <div className="text-[11px] font-mono bg-slate-50 p-2 rounded border border-slate-200 text-slate-600">
                backend: documentSummaryService.ts
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 mb-3 text-emerald-600">
                <History className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900">Session History & Persistence</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                Persists multi-turn conversation messages (user questions, assistant answers, retrieved chunk IDs) into MongoDB <code>ResearchSessionModel</code>. Enables conversational continuity, audit logs, and context-aware follow-ups.
              </p>
              <div className="text-[11px] font-mono bg-slate-50 p-2 rounded border border-slate-200 text-slate-600">
                model: ResearchSession.ts
              </div>
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* SECTION 3: TECHNOLOGIES & THEIR USES */}
        {/* ========================================== */}
        <section id="technologies" className="scroll-mt-32">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold mb-2">
              <Cpu className="w-3.5 h-3.5" />
              <span>Section 3</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Technologies and Their Uses</h2>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              A comprehensive breakdown of all production libraries, runtime frameworks, AI services, and algorithms implemented in the project. Each entry details where it is located in the source code and why it was chosen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Tech 1 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    Frontend Layer
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">React 19 + TS</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">React + TypeScript</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Where used:</strong> Entire <code>frontend/src/</code> application (Dashboard, Documents, Research Workspace, Compare Matrix).
                  <br /><strong>Why used:</strong> Delivers a responsive, reactive single-page application (SPA). TypeScript provides compile-time type safety across API schemas, chat messages, and citation models.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                frontend/src/App.tsx
              </div>
            </div>

            {/* Tech 2 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    Build Tool
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">Vite 8</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Vite</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Where used:</strong> Frontend development server and production bundler.
                  <br /><strong>Why used:</strong> Provides instantaneous Hot Module Replacement (HMR) during development and tree-shaken, optimized Rollup production builds with zero latency.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                frontend/vite.config.ts
              </div>
            </div>

            {/* Tech 3 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                    Styling
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">Tailwind CSS 3</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Tailwind CSS</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Where used:</strong> Global styling, layout containers, and design system tokens.
                  <br /><strong>Why used:</strong> Enables clean, consistent typography, custom indigo/brand theme tokens, dark sidebar aesthetics, responsive mobile breakpoints, and micro-interactions without bloated custom CSS files.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                frontend/tailwind.config.js
              </div>
            </div>

            {/* Tech 4 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Backend Engine
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">Node.js + Express</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Node.js + Express</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Where used:</strong> REST API server handling ingestion, streaming RAG queries, comparisons, and sessions.
                  <br /><strong>Why used:</strong> Asynchronous, non-blocking event-driven runtime ideal for concurrent file stream parsing, background local ONNX vectorization, and external LLM API communication.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                backend/src/server.ts
              </div>
            </div>

            {/* Tech 5 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                    Database
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">MongoDB + Mongoose</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">MongoDB & Mongoose</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Where used:</strong> Models: <code>DocumentModel</code>, <code>ChunkModel</code>, and <code>ResearchSessionModel</code>.
                  <br /><strong>Why used:</strong> Flexible NoSQL document database perfectly suited for storing polymorphic chunk metadata, 384d floating-point vector arrays, conversational turn trees, and summaries with transactional isolation.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                backend/src/models/
              </div>
            </div>

            {/* Tech 6 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Local Embeddings
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">ONNX 384d</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">all-MiniLM-L6-v2 (Local)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Where used:</strong> <code>embeddingService.ts</code> via <code>@xenova/transformers</code>.
                  <br /><strong>Why used:</strong> Generates high-quality 384-dimensional dense semantic embeddings entirely in-process on CPU without external API fees, rate limits, or network privacy leakage.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                backend/src/services/ai/embeddingService.ts
              </div>
            </div>

            {/* Tech 7 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    Keyword Search
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">Okapi BM25</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">BM25 Lexical Retrieval</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Where used:</strong> <code>backend/src/services/ai/bm25.ts</code>.
                  <br /><strong>Why used:</strong> Matches exact acronyms (e.g. <em>"ResNet-50"</em>), specialized symbols, formulas, and rare terminology that dense embeddings frequently blur or miss.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                backend/src/services/ai/bm25.ts
              </div>
            </div>

            {/* Tech 8 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                    Hybrid Rank Fusion
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">k = 60</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Reciprocal Rank Fusion (RRF)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Where used:</strong> <code>vectorStore.ts</code> inside hybrid retrieval pipeline.
                  <br /><strong>Why used:</strong> Merges rankings from disparate scoring domains (dense cosine scores between 0 and 1 vs uncalibrated BM25 positive scores) in a mathematically stable, parameter-free manner.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                backend/src/services/ai/vectorStore.ts
              </div>
            </div>

            {/* Tech 9 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    Diversity Re-ranking
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">λ = 0.7</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Maximal Marginal Relevance (MMR)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Where used:</strong> <code>vectorStore.ts</code> candidate selection step.
                  <br /><strong>Why used:</strong> Penalizes redundant chunks from the same document section, ensuring the LLM context window receives diverse evidence across multiple facets of the user question.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                backend/src/services/ai/vectorStore.ts
              </div>
            </div>

            {/* Tech 10 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                    Multi-Provider AI
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">Gemini / OpenAI / Ollama</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">LLM Multi-Provider Architecture</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Where used:</strong> <code>llmService.ts</code>.
                  <br /><strong>Why used:</strong> Pluggable provider adapter supporting:
                  <br />• <strong>Google Gemini:</strong> <code>gemini-2.5-flash</code> via <code>@google/genai</code>.
                  <br />• <strong>OpenAI:</strong> <code>gpt-4o-mini</code> / <code>gpt-4o</code> via <code>openai</code> SDK.
                  <br />• <strong>Ollama:</strong> Local self-hosted LLM (Llama 3 / Mistral).
                  <br />• <strong>Mock:</strong> Deterministic provider for testing without API keys.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                backend/src/services/ai/llmService.ts
              </div>
            </div>

            {/* Tech 11 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between md:col-span-2">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    Document Extraction Suite
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">PDF, DOCX, DOC, TXT</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Unified Multi-Format Extraction Suite</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Where used:</strong> <code>extractor.ts</code>.
                  <br /><strong>Why each is used:</strong>
                  <br />• <code>pdf-parse</code> (v1.1.1): Reads PDF streams, extracting text blocks, form feeds, and mapping them to exact page indices.
                  <br />• <code>mammoth</code> (v1.13.0): Converts Microsoft Word <code>.docx</code> XML archives into clean semantic paragraphs and tables without formatting garbage.
                  <br />• <code>word-extractor</code> (v1.0.4): Parses legacy binary OLE2 Compound Document format for older Microsoft Word <code>.doc</code> files.
                  <br />• Native UTF-8 stream decoder for plain text <code>.txt</code> documents.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                backend/src/services/documents/extractor.ts
              </div>
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* SECTION 4: ASSESSMENT RUBRIC MAPPING */}
        {/* ========================================== */}
        <section id="rubric" className="scroll-mt-32">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-xs font-semibold mb-2">
              <TableProperties className="w-3.5 h-3.5" />
              <span>Section 4</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Assessment Rubric Mapping (CO1 to CO4)
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Direct mapping of our implemented features to your college's official Project Demonstration Assessment Rubric (30 Total Marks). This table provides faculty evaluators with an objective, verified breakdown of every criteria.
            </p>
          </div>

          {/* Academic Transparency Alert */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 mb-6 flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong>Academic Integrity & Scope Disclosure:</strong> In accordance with strict software engineering ethics, this guide accurately reports both fully implemented features and curriculum gaps. Specifically, <em>Sentiment Analysis</em> (CO2) is marked as out of scope for factual academic grounding, and <em>Unsupervised Topic Modeling / Multilingual NLP</em> (CO3) is explicitly identified as a curriculum limitation rather than falsely claiming embedding clusters are topic models.
            </div>
          </div>

          {/* Rubric Mapping Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4 w-28">CO & Marks</th>
                    <th className="py-3.5 px-4 w-48">Assessment Criteria</th>
                    <th className="py-3.5 px-4 w-44">Project Feature</th>
                    <th className="py-3.5 px-4 w-52">Technologies / Algorithms Used</th>
                    <th className="py-3.5 px-4">How It Works in Our Project & Coverage Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* ROW CO1 */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-4 align-top">
                      <div className="font-bold text-sm text-brand-700">CO1</div>
                      <div className="text-[11px] font-semibold text-slate-500">7 Marks</div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        100% Implemented
                      </span>
                    </td>
                    <td className="py-4 px-4 align-top font-medium text-slate-800">
                      Text extraction, preprocessing, cleaning and vectorization of unstructured data.
                    </td>
                    <td className="py-4 px-4 align-top text-slate-700">
                      <strong>Multi-Format Ingestion & Semantic Vector Pipeline</strong>
                      <div className="text-slate-500 mt-1">PDF, Word (DOCX/DOC), TXT processing with sliding chunking and local embeddings.</div>
                    </td>
                    <td className="py-4 px-4 align-top text-slate-600 font-mono text-[11px]">
                      • pdf-parse (1.1.1)<br />
                      • mammoth (1.13.0)<br />
                      • word-extractor (1.0.4)<br />
                      • Xenova/all-MiniLM-L6-v2<br />
                      • MongoDB ChunkModel
                    </td>
                    <td className="py-4 px-4 align-top text-slate-600 leading-relaxed">
                      Files are uploaded via Multer, verified by MIME/magic bytes, and extracted into text streams. <code>extractor.ts</code> strips non-printable control characters and fixes hyphenation. <code>chunker.ts</code> executes sliding-window chunking (500–1000 chars, 15% overlap) retaining exact page metadata. <code>embeddingService.ts</code> generates 384-dimensional dense vectors locally using ONNX runtime in Node.js and persists them to MongoDB with atomic transactional replacement.
                    </td>
                  </tr>

                  {/* ROW CO2 */}
                  <tr className="hover:bg-slate-50/60 transition-colors bg-slate-50/30">
                    <td className="py-4 px-4 align-top">
                      <div className="font-bold text-sm text-brand-700">CO2</div>
                      <div className="text-[11px] font-semibold text-slate-500">8 Marks</div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Information Extraction: Active<br />Sentiment Analysis: Out of Scope
                      </span>
                    </td>
                    <td className="py-4 px-4 align-top font-medium text-slate-800">
                      Implementation and evaluation of sentiment analysis and information extraction using appropriate algorithms.
                    </td>
                    <td className="py-4 px-4 align-top text-slate-700">
                      <strong>Scientific Information Extraction & Factual Grounding</strong>
                      <div className="text-slate-500 mt-1">Structured metadata parsing, 10-dimension academic extraction, claim-citation verification.</div>
                    </td>
                    <td className="py-4 px-4 align-top text-slate-600 font-mono text-[11px]">
                      • Regex metadata parser<br />
                      • 10-Dimension comparison schema<br />
                      • citationVerifier.ts<br />
                      • Zod schema validation
                    </td>
                    <td className="py-4 px-4 align-top text-slate-600 leading-relaxed">
                      <strong>Information Extraction:</strong> Fully implemented. Extracts titles, authors, page counts, numerical benchmark metrics, and extracts evidence across 10 structured dimensions (Objectives, Architectures, Results, Limitations, Gaps).
                      <br /><br />
                      <strong className="text-amber-800">Sentiment Analysis Audit Note:</strong> Not implemented in source code. Academic literature requires objective, empirical veracity rather than emotional polarity classification (positive/negative sentiment). We deliberately do not fabricate sentiment labels on scholarly papers.
                    </td>
                  </tr>

                  {/* ROW CO3 */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-4 align-top">
                      <div className="font-bold text-sm text-brand-700">CO3</div>
                      <div className="text-[11px] font-semibold text-slate-500">7 Marks</div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Cloud AI: Implemented<br />Topic/Multilingual: Future Work
                      </span>
                    </td>
                    <td className="py-4 px-4 align-top font-medium text-slate-800">
                      Implementation of topic modeling or multilingual NLP using appropriate NLP techniques and cloud-based AI services.
                    </td>
                    <td className="py-4 px-4 align-top text-slate-700">
                      <strong>Cloud AI Integration & Research Synthesis</strong>
                      <div className="text-slate-500 mt-1">Google Gemini 2.5 Flash API integration for high-level semantic synthesis and categorization.</div>
                    </td>
                    <td className="py-4 px-4 align-top text-slate-600 font-mono text-[11px]">
                      • Google Gemini 2.5 Flash (@google/genai)<br />
                      • OpenAI GPT-4o SDK<br />
                      • Rule-based topic classifier
                    </td>
                    <td className="py-4 px-4 align-top text-slate-600 leading-relaxed">
                      <strong>Cloud AI Services:</strong> Fully integrated. Connects to <code>@google/genai</code> (Gemini 2.5 Flash) and OpenAI APIs for executive summarization, cross-document synthesis, and query rewriting.
                      <br /><br />
                      <strong className="text-amber-800">Topic Modeling & Multilingual Audit Note:</strong> Unsupervised topic models (e.g., LDA or BERTopic) and cross-lingual translation are curriculum gaps not present in the current release. The system relies on semantic embedding neighborhoods and LLM semantic synthesis rather than statistical topic Dirichlet distributions.
                    </td>
                  </tr>

                  {/* ROW CO4 */}
                  <tr className="hover:bg-slate-50/60 transition-colors bg-slate-50/30">
                    <td className="py-4 px-4 align-top">
                      <div className="font-bold text-sm text-brand-700">CO4</div>
                      <div className="text-[11px] font-semibold text-slate-500">8 Marks</div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        100% Implemented
                      </span>
                    </td>
                    <td className="py-4 px-4 align-top font-medium text-slate-800">
                      Generative AI/LLM application, prompt engineering, integration and working demonstration of the project solution.
                    </td>
                    <td className="py-4 px-4 align-top text-slate-700">
                      <strong>Production RAG System with Citations & Cross-Comparison</strong>
                      <div className="text-slate-500 mt-1">Full question answering, prompt hardening, RRF + MMR re-ranking, multi-turn history.</div>
                    </td>
                    <td className="py-4 px-4 align-top text-slate-600 font-mono text-[11px]">
                      • RAG pipeline (ragService.ts)<br />
                      • Reciprocal Rank Fusion (k=60)<br />
                      • MMR diversity re-ranking<br />
                      • Anti-injection prompts<br />
                      • Multi-provider adapter
                    </td>
                    <td className="py-4 px-4 align-top text-slate-600 leading-relaxed">
                      Generates fully grounded answers by assembling retrieved document chunks into hardened system prompts with explicit anti-injection and anti-hallucination guardrails. Emits verifiable citations <code>[Doc: ..., Page: ...]</code> that cross-reference MongoDB chunk records. Features multi-turn query rewriting, 10-dimension comparative matrix generation, and full multi-provider support (Gemini, OpenAI, Ollama, Mock).
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Rubric Total Score Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-2">
              <span className="font-semibold text-slate-800">
                Total Assessment Weight: 30 Marks (CO1: 7M + CO2: 8M + CO3: 7M + CO4: 8M)
              </span>
              <span className="text-slate-500 text-[11px]">
                Verified against active source code on branch <code>improvements</code>
              </span>
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* SECTION 5: ALGORITHMS AND NLP TECHNIQUES */}
        {/* ========================================== */}
        <section id="algorithms" className="scroll-mt-32">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold mb-2">
              <Binary className="w-3.5 h-3.5" />
              <span>Section 5</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Algorithms and NLP Techniques</h2>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              In-depth explanations of the 8 fundamental mathematical algorithms and Natural Language Processing techniques implemented in our codebase. Each card covers theoretical meaning, motivation, code location, and an intuitive example.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Algorithm 1: Text Preprocessing & Cleaning */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-brand-200 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">NLP Foundation</span>
                  <span className="text-[11px] font-mono text-slate-400">cleanText()</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">1. Text Preprocessing & Cleaning</h3>
                <div className="space-y-2 text-xs text-slate-600">
                  <p>
                    <strong>What it means:</strong> The transformation of raw, noisy extracted document text into a sanitized, standardized string representation.
                  </p>
                  <p>
                    <strong>Why it is used:</strong> PDF and Word extractors frequently output non-printable Unicode characters (e.g. <code>\u0000</code>), split words with trailing hyphens (<code>connec- tion</code>), or inject irregular whitespace that degrades embedding quality.
                  </p>
                  <p>
                    <strong>Where used:</strong> <code>backend/src/services/documents/extractor.ts</code> and <code>chunker.ts</code>.
                  </p>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-2 font-mono text-[11px] text-slate-700">
                    <span className="text-slate-400">// Example</span><br />
                    Input: &quot;Transformer\u0002 archi-\n tecture  yields 94%&quot;<br />
                    Output: &quot;Transformer architecture yields 94%&quot;
                  </div>
                </div>
              </div>
            </div>

            {/* Algorithm 2: Document Chunking & Overlap */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-brand-200 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Segmentation</span>
                  <span className="text-[11px] font-mono text-slate-400">chunkText()</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">2. Document Chunking & Sliding Overlap</h3>
                <div className="space-y-2 text-xs text-slate-600">
                  <p>
                    <strong>What it means:</strong> Partitioning a 30-page document into bite-sized semantic segments (500–1000 characters) with a 15% sliding window overlap.
                  </p>
                  <p>
                    <strong>Why it is used:</strong> Dense embedding models have a maximum sequence length (512 tokens). Chunking also allows precision retrieval: only the specific paragraph containing the answer is sent to the LLM, preventing noise.
                  </p>
                  <p>
                    <strong>Where used:</strong> <code>backend/src/services/documents/chunker.ts</code>.
                  </p>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-2 font-mono text-[11px] text-slate-700">
                    <span className="text-slate-400">// Example</span><br />
                    Chunk 1: &quot;...achieved 89.4% F1 score on SQuAD dataset [overlap end]&quot;<br />
                    Chunk 2: &quot;[overlap start] on SQuAD dataset using 8 A100 GPUs...&quot;
                  </div>
                </div>
              </div>
            </div>

            {/* Algorithm 3: Sentence Embeddings */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-brand-200 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Vector Space</span>
                  <span className="text-[11px] font-mono text-slate-400">all-MiniLM-L6-v2</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">3. Dense Sentence Embeddings</h3>
                <div className="space-y-2 text-xs text-slate-600">
                  <p>
                    <strong>What it means:</strong> Mapping natural language text passages into continuous 384-dimensional dense vectors where semantic conceptual similarity corresponds to spatial proximity.
                  </p>
                  <p>
                    <strong>Why it is used:</strong> Enables finding passages that mean the same thing even if they use completely different vocabularies (e.g. <em>&quot;accuracy score&quot;</em> vs <em>&quot;classification performance&quot;</em>).
                  </p>
                  <p>
                    <strong>Where used:</strong> <code>backend/src/services/ai/embeddingService.ts</code>.
                  </p>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-2 font-mono text-[11px] text-slate-700">
                    <span className="text-slate-400">// Example</span><br />
                    &quot;Convolutional Neural Net&quot; → [0.034, -0.198, 0.441, ... 384 floats]<br />
                    Vector magnitude normalized: ||v|| = 1.0
                  </div>
                </div>
              </div>
            </div>

            {/* Algorithm 4: Semantic Search (Cosine Similarity) */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-brand-200 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Metric Space</span>
                  <span className="text-[11px] font-mono text-slate-400">cos(θ) = (A·B)/(||A||||B||)</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">4. Cosine Similarity Semantic Search</h3>
                <div className="space-y-2 text-xs text-slate-600">
                  <p>
                    <strong>What it means:</strong> Measuring the cosine of the angle between the query vector and document chunk vectors. Scores range from -1.0 (opposite) to +1.0 (identical direction).
                  </p>
                  <p>
                    <strong>Why it is used:</strong> Because embedding vectors are unit-normalized, cosine similarity reduces to a fast dot product that measures conceptual alignment independent of passage length.
                  </p>
                  <p>
                    <strong>Where used:</strong> <code>backend/src/services/ai/vectorStore.ts</code>.
                  </p>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-2 font-mono text-[11px] text-slate-700">
                    <span className="text-slate-400">// Example</span><br />
                    Query: &quot;How fast was inference?&quot;<br />
                    Chunk: &quot;Latency measured at 12ms per token&quot; → Cosine Similarity: 0.84
                  </div>
                </div>
              </div>
            </div>

            {/* Algorithm 5: BM25 Lexical Retrieval */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-brand-200 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Lexical Ranking</span>
                  <span className="text-[11px] font-mono text-slate-400">BM25(k1=1.2, b=0.75)</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">5. Okapi BM25 Keyword Search</h3>
                <div className="space-y-2 text-xs text-slate-600">
                  <p>
                    <strong>What it means:</strong> A probabilistic information retrieval algorithm that scores document relevance based on term frequency (TF), inverse document frequency (IDF), and document length normalization.
                  </p>
                  <p>
                    <strong>Why it is used:</strong> Dense vectors can overlook rare acronyms, code identifiers, chemical compounds, or exact author names. BM25 guarantees precision keyword matching.
                  </p>
                  <p>
                    <strong>Where used:</strong> <code>backend/src/services/ai/bm25.ts</code>.
                  </p>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-2 font-mono text-[11px] text-slate-700">
                    <span className="text-slate-400">// Example</span><br />
                    Query: &quot;BERT-large-uncased BLEU-4 score&quot;<br />
                    BM25 identifies rare tokens &quot;BLEU-4&quot; and &quot;BERT-large-uncased&quot; with high IDF weights.
                  </div>
                </div>
              </div>
            </div>

            {/* Algorithm 6: Reciprocal Rank Fusion */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-brand-200 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-800">Hybrid Fusion</span>
                  <span className="text-[11px] font-mono text-slate-400">RRF = Σ 1/(k + rank)</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">6. Reciprocal Rank Fusion (RRF)</h3>
                <div className="space-y-2 text-xs text-slate-600">
                  <p>
                    <strong>What it means:</strong> A rank-aggregation algorithm that merges two or more ranked lists (dense vector ranks and BM25 ranks) into a unified master ranking using smoothing constant <em>k = 60</em>.
                  </p>
                  <p>
                    <strong>Why it is used:</strong> BM25 scores (0 to 50+) and cosine similarities (0 to 1) cannot be simply added together without fragile calibration. RRF depends solely on ordinal position, making it immune to scale mismatch.
                  </p>
                  <p>
                    <strong>Where used:</strong> <code>backend/src/services/ai/vectorStore.ts</code>.
                  </p>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-2 font-mono text-[11px] text-slate-700">
                    <span className="text-slate-400">// Example</span><br />
                    Chunk X: Dense rank #1, BM25 rank #4<br />
                    RRF Score = 1/(60+1) + 1/(60+4) = 0.01639 + 0.01562 = 0.03201
                  </div>
                </div>
              </div>
            </div>

            {/* Algorithm 7: Maximal Marginal Relevance */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-brand-200 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">Diversity Re-ranking</span>
                  <span className="text-[11px] font-mono text-slate-400">MMR(λ = 0.7)</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">7. Maximal Marginal Relevance (MMR)</h3>
                <div className="space-y-2 text-xs text-slate-600">
                  <p>
                    <strong>What it means:</strong> An optimization algorithm that iteratively selects the next chunk by balancing relevance to the user query with dissimilarity to already selected chunks.
                  </p>
                  <p>
                    <strong>Why it is used:</strong> Prevents the top-K list from being filled with three nearly identical paragraphs from the same page, ensuring multi-faceted context coverage.
                  </p>
                  <p>
                    <strong>Where used:</strong> <code>backend/src/services/ai/vectorStore.ts</code>.
                  </p>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-2 font-mono text-[11px] text-slate-700">
                    <span className="text-slate-400">// Example</span><br />
                    Candidate A is 92% relevant but 90% identical to Selected Chunk 1.<br />
                    Candidate B is 85% relevant but covers a new section. MMR picks B!
                  </div>
                </div>
              </div>
            </div>

            {/* Algorithm 8: Retrieval Augmented Generation */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-brand-200 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-100 text-brand-800">Generative Synthesis</span>
                  <span className="text-[11px] font-mono text-slate-400">RAG Pipeline</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">8. Retrieval-Augmented Generation (RAG)</h3>
                <div className="space-y-2 text-xs text-slate-600">
                  <p>
                    <strong>What it means:</strong> A hybrid architectural pattern that conditions a large language model&apos;s output on external, dynamically retrieved document passages injected directly into the prompt.
                  </p>
                  <p>
                    <strong>Why it is used:</strong> Eliminates hallucinations, bounds the LLM strictly to your verified uploaded papers, guarantees up-to-date knowledge, and provides transparent audit citations.
                  </p>
                  <p>
                    <strong>Where used:</strong> <code>backend/src/services/ai/ragService.ts</code>.
                  </p>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-2 font-mono text-[11px] text-slate-700">
                    <span className="text-slate-400">// Example</span><br />
                    Prompt: &quot;Answer using ONLY the retrieved chunks below. Cite [Doc, Page].<br />
                    Context: [Doc1, P.4: F1 was 92.1%] ... Output: F1 was 92.1% [Doc1, P.4]&quot;
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* SECTION 6: LIVE DEMONSTRATION GUIDE */}
        {/* ========================================== */}
        <section id="demo" className="scroll-mt-32">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Section 6</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Faculty Viva & Live Demonstration Guide
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              A 10-step sequential demonstration checklist designed specifically for presentation to project evaluators, faculty members, and external examiners. Follow these steps to showcase all working features seamlessly.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100">
            {[
              {
                step: 1,
                title: 'Upload a Research Document (PDF or Word)',
                action: 'Navigate to the Documents tab or click "Upload" in the header. Drag and drop an academic PDF or Word DOCX/DOC file (e.g. an AI research paper or technical report).',
                highlight: 'Demonstrates multi-format file validation, MIME verification, and 50MB upload limits.',
                badge: 'CO1',
              },
              {
                step: 2,
                title: 'Show Real-Time Ingestion & Local Vectorization',
                action: 'Observe the processing badge transition from "processing" to "ready". Point out that text extraction, regex cleaning, and ONNX vectorization run locally on the backend.',
                highlight: 'Proves the local Xenova/all-MiniLM-L6-v2 pipeline runs without external API fees or third-party vector databases.',
                badge: 'CO1',
              },
              {
                step: 3,
                title: 'Inspect Processed Document Metadata & Chunks',
                action: 'Open the document details card in the Documents view. Review extracted page counts, character length, chunk counts, and preview the raw text.',
                highlight: 'Demonstrates clean segmentation, paragraph preservation, and database persistence in MongoDB.',
                badge: 'CO1',
              },
              {
                step: 4,
                title: 'Ask a Domain-Specific Question on One Document',
                action: 'Go to the Research Workspace, select the uploaded document, and ask a specific factual question (e.g., "What was the main architecture proposed in this paper?").',
                highlight: 'Activates hybrid retrieval (dense semantic + BM25) and reciprocal rank fusion.',
                badge: 'CO4',
              },
              {
                step: 5,
                title: 'Inspect the Grounded Answer and Verified Citations',
                action: 'Show the generated answer in the chat panel. Hover over or click on the inline citations [Doc: ..., Page: ...] to inspect the exact source chunk snippet.',
                highlight: 'Proves zero hallucination and verifiable grounding through citationVerifier.ts.',
                badge: 'CO4',
              },
              {
                step: 6,
                title: 'Upload a Second Complementary Research Paper',
                action: 'Upload a second paper on a related subject (e.g., comparing BERT vs RoBERTa or ResNet vs EfficientNet). Wait for it to show "Ready".',
                highlight: 'Demonstrates scalability and multi-document repository indexing.',
                badge: 'CO1',
              },
              {
                step: 7,
                title: 'Ask a Multi-Document Cross-Synthesis Question',
                action: 'Select BOTH uploaded documents in the Research Workspace. Ask: "Compare the datasets, hardware, and benchmark results between both papers."',
                highlight: 'Demonstrates cross-document synthesis, MMR diversity re-ranking, and multi-source citations in a single response.',
                badge: 'CO4',
              },
              {
                step: 8,
                title: 'Demonstrate 10-Dimension Document Comparison',
                action: 'Click on the "Compare Documents" tab in the sidebar. Select two or more documents and click "Generate Comparison".',
                highlight: 'Show the structured 10-dimension comparative matrix covering Objectives, Architecture, Findings, Datasets, Advantages, Gaps, Innovations, and Verdict.',
                badge: 'CO2 & CO4',
              },
              {
                step: 9,
                title: 'Demonstrate Automated Executive Summarization',
                action: 'View the Document Summary section. Show the high-level executive briefing, methodology breakdown, and key takeaways generated for the paper.',
                highlight: 'Demonstrates Cloud AI summarization via Google Gemini 2.5 Flash / OpenAI without hallucination.',
                badge: 'CO3 & CO4',
              },
              {
                step: 10,
                title: 'Demonstrate Conversational History & Query Rewriting',
                action: 'In the Research Workspace, ask a follow-up question containing ambiguous pronouns (e.g. "What were their limitations?" or "How did they evaluate it?").',
                highlight: 'Show how query rewriting references the last 6 turns in MongoDB ResearchSessionModel to resolve context accurately.',
                badge: 'CO4',
              },
            ].map((item) => (
              <div key={item.step} className="p-5 flex flex-col md:flex-row md:items-start gap-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-200 text-brand-700 flex items-center justify-center font-bold text-xs">
                    {item.step}
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {item.badge}
                  </span>
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Action:</strong> {item.action}
                  </p>
                  <p className="text-xs text-brand-700 font-medium leading-relaxed">
                    <strong>What to Highlight to Evaluator:</strong> {item.highlight}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Back to Workspace Callout */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-lg font-bold">Ready to test the live system?</h3>
            <p className="text-xs text-slate-300 max-w-xl">
              Switch back to the Research Workspace to upload papers, run multi-document RAG queries, or generate 10-dimension comparison matrices.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/compare"
              className="px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors"
            >
              Compare Papers
            </Link>
            <Link
              to="/research"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-lg shadow-sm shadow-brand-500/30 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Open Research Workspace</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
