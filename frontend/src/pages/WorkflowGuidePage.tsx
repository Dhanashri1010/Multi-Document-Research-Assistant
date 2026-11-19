import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowLeft,
  Layers,
  Cpu,
  Binary,
  FileText,
  Database,
  Search,
  Bot,
  Quote,
  GitCompare,
  History,
  ShieldCheck,
  Zap,
  BookOpen,
  HelpCircle,
  Globe,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Lock,
  Clock,
  LayoutDashboard,
  FlaskConical,
  Tags,
  Smile,
  Languages,
  BookMarked,
  Terminal,
} from 'lucide-react';
import { fetchSystemConfig, SystemConfig, DEFAULT_SYSTEM_CONFIG } from '../services/systemService.js';

export const WorkflowGuidePage: React.FC = () => {
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);

  useEffect(() => {
    fetchSystemConfig().then(setSystemConfig);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navLinks = [
    { id: 'what-it-does', label: '1. What this does' },
    { id: 'quick-start', label: '2. Quick start' },
    { id: 'end-to-end', label: '3. End-to-end workflow' },
    { id: 'pages-guide', label: '4. Pages & features' },
    { id: 'techniques', label: '5. Technologies & techniques' },
    { id: 'trustworthy-citations', label: '6. Trustworthy citations' },
    { id: 'languages', label: '7. Languages & translation' },
    { id: 'limits', label: '8. Limits & good to know' },
    { id: 'architecture', label: '9. Architecture' },
    { id: 'faq', label: '10. FAQ' },
  ];

  return (
    <div className="min-h-full bg-slate-50 text-slate-800 pb-24">
      {/* Top Banner / Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/research"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-brand-50 hover:text-brand-600 rounded-lg border border-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Workspace</span>
            </Link>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-brand-50 text-brand-700 border border-brand-200">
                  User Guide & Architecture
                </span>
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">Production</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                How It Works: System Guide & Architecture
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/compare"
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-xs hover:bg-slate-50 transition-colors"
            >
              Compare Papers
            </Link>
            <Link
              to="/research"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm shadow-brand-500/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Open Research Workspace</span>
            </Link>
          </div>
        </div>

        {/* Mobile Horizontal Quick Jump Bar */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-2 block lg:hidden">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] shrink-0">
              Jump:
            </span>
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="px-2.5 py-1 rounded text-slate-600 hover:text-brand-600 hover:bg-white border border-transparent hover:border-slate-200 font-medium whitespace-nowrap transition-all"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Layout Container with Sticky Sidebar on Desktop */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 flex gap-8">
        {/* Sticky Desktop Table of Contents */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-28 bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-1">
            <div className="px-2 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              Table of Contents
            </div>
            <nav className="space-y-0.5 pt-2">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-slate-600 hover:text-brand-600 hover:bg-brand-50/60 transition-colors font-medium flex items-center justify-between"
                >
                  <span className="truncate">{link.label}</span>
                </button>
              ))}
            </nav>
            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              Model: <span className="font-mono text-slate-600">{systemConfig.primaryModel}</span>
            </div>
          </div>
        </aside>

        {/* Main Content Column */}
        <div className="flex-1 min-w-0 space-y-16">
          {/* ========================================== */}
          {/* SECTION 1: WHAT THIS PRODUCT DOES */}
          {/* ========================================== */}
          <section id="what-it-does" className="scroll-mt-28">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">1. What This Product Does</h2>
              <div className="h-1 w-12 bg-brand-600 rounded mt-1.5" />
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                The <strong>Multi-Document Research Assistant</strong> is an intelligent knowledge platform built for researchers, students, and professionals who need to analyze and cross-examine long academic papers, technical documentation, or institutional reports.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                Instead of reading through dozens of multi-page PDFs or relying on generic chatbots that hallucinate citations, you can upload your source documents, ask detailed questions across multiple papers simultaneously, and receive answers where every factual assertion is linked directly to an exact source page number.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                The platform also generates automated 10-dimension comparison matrices across papers, produces multi-document literature syntheses, uncovers thematic topic clusters, and translates findings across languages—all with strict multi-user privacy and automated rate throttling.
              </p>
            </div>
          </section>

          {/* ========================================== */}
          {/* SECTION 2: QUICK START */}
          {/* ========================================== */}
          <section id="quick-start" className="scroll-mt-28">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">2. Quick Start</h2>
              <div className="h-1 w-12 bg-brand-600 rounded mt-1.5" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-sm mb-3 border border-blue-200">
                    1
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Upload Documents</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Drop your PDF, Word (.docx, .doc), or TXT documents (up to {systemConfig.maxFileSizeMB} MB) into the Documents page.
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 text-[11px] font-medium text-slate-400">
                  Step 1 · Ingestion
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 font-bold flex items-center justify-center text-sm mb-3 border border-amber-200">
                    2
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Wait for Ready</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The background engine extracts text, chunks paragraphs, and vectorizes passages in throttled batches without rate errors.
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 text-[11px] font-medium text-slate-400">
                  Step 2 · Indexing
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-sm mb-3 border border-emerald-200">
                    3
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Ask in Workspace</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Select your active documents, type any research question, and review grounded answers with verified citation badges.
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 text-[11px] font-medium text-slate-400">
                  Step 3 · Synthesis
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 font-bold flex items-center justify-center text-sm mb-3 border border-purple-200">
                    4
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Explore Insights</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Visit the Insights page to analyze topic clusters, extract named entities, assess sentiment, or run prompt experiments.
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 text-[11px] font-medium text-slate-400">
                  Step 4 · Analytics
                </div>
              </div>
            </div>
          </section>

          {/* ========================================== */}
          {/* SECTION 3: HOW IT WORKS END-TO-END */}
          {/* ========================================== */}
          <section id="end-to-end" className="scroll-mt-28">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">3. How It Works, End to End</h2>
              <div className="h-1 w-12 bg-brand-600 rounded mt-1.5" />
              <p className="text-sm text-slate-600 mt-2">
                Follow the complete lifecycle from initial file upload to cited, verified answers and persistent analytical caching.
              </p>
            </div>

            {/* End-to-End Pipeline Diagram (SVG) */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs mb-8 overflow-x-auto">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-brand-600" />
                <span>Primary Document & Research Question Flow</span>
              </div>
              <svg
                viewBox="0 0 960 260"
                className="w-full min-w-[760px] h-auto text-xs font-sans select-none"
              >
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#64748b" />
                  </marker>
                </defs>

                {/* Row 1: Ingestion */}
                <g transform="translate(10, 20)">
                  <rect x="0" y="0" width="130" height="70" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
                  <text x="65" y="28" textAnchor="middle" fontWeight="bold" fill="#0f172a">1. Upload</text>
                  <text x="65" y="46" textAnchor="middle" fill="#64748b" fontSize="10">PDF, DOCX, TXT</text>
                  <text x="65" y="58" textAnchor="middle" fill="#94a3b8" fontSize="9">Max {systemConfig.maxFileSizeMB} MB</text>
                </g>

                <path d="M 145 55 L 175 55" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <g transform="translate(180, 20)">
                  <rect x="0" y="0" width="130" height="70" rx="8" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1.5" />
                  <text x="65" y="28" textAnchor="middle" fontWeight="bold" fill="#1e3a8a">2. Storage</text>
                  <text x="65" y="46" textAnchor="middle" fill="#3b82f6" fontSize="10">Supabase Bucket</text>
                  <text x="65" y="58" textAnchor="middle" fill="#60a5fa" fontSize="9">GridFS fallback</text>
                </g>

                <path d="M 315 55 L 345 55" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <g transform="translate(350, 20)">
                  <rect x="0" y="0" width="130" height="70" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
                  <text x="65" y="28" textAnchor="middle" fontWeight="bold" fill="#0f172a">3. Extraction</text>
                  <text x="65" y="46" textAnchor="middle" fill="#64748b" fontSize="10">pdf-parse / mammoth</text>
                  <text x="65" y="58" textAnchor="middle" fill="#94a3b8" fontSize="9">Scanned check</text>
                </g>

                <path d="M 485 55 L 515 55" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <g transform="translate(520, 20)">
                  <rect x="0" y="0" width="130" height="70" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
                  <text x="65" y="28" textAnchor="middle" fontWeight="bold" fill="#0f172a">4. Cleaning</text>
                  <text x="65" y="46" textAnchor="middle" fill="#64748b" fontSize="10">Hyphens & Unicode</text>
                  <text x="65" y="58" textAnchor="middle" fill="#94a3b8" fontSize="9">Noise removal</text>
                </g>

                <path d="M 655 55 L 685 55" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <g transform="translate(690, 20)">
                  <rect x="0" y="0" width="130" height="70" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
                  <text x="65" y="28" textAnchor="middle" fontWeight="bold" fill="#0f172a">5. Chunking</text>
                  <text x="65" y="46" textAnchor="middle" fill="#64748b" fontSize="10">380 tokens window</text>
                  <text x="65" y="58" textAnchor="middle" fill="#94a3b8" fontSize="9">60 overlap tokens</text>
                </g>

                <path d="M 825 55 L 855 55" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <g transform="translate(860, 20)">
                  <rect x="0" y="0" width="90" height="70" rx="8" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.5" />
                  <text x="45" y="28" textAnchor="middle" fontWeight="bold" fill="#065f46">6. Embed</text>
                  <text x="45" y="46" textAnchor="middle" fill="#059669" fontSize="10">10-batch cap</text>
                  <text x="45" y="58" textAnchor="middle" fill="#10b981" fontSize="9">768-d vectors</text>
                </g>

                {/* Transition Arrow down to retrieval */}
                <path d="M 905 95 L 905 135 L 890 135" stroke="#94a3b8" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)" />

                {/* Row 2: Inquiry & Verification */}
                <g transform="translate(10, 150)">
                  <rect x="0" y="0" width="130" height="70" rx="8" fill="#fdf4ff" stroke="#f0abfc" strokeWidth="1.5" />
                  <text x="65" y="28" textAnchor="middle" fontWeight="bold" fill="#701a75">12. Cited Answer</text>
                  <text x="65" y="46" textAnchor="middle" fill="#a21caf" fontSize="10">Grounded brackets</text>
                  <text x="65" y="58" textAnchor="middle" fill="#c026d3" fontSize="9">Markdown & PDF</text>
                </g>

                <path d="M 175 185 L 145 185" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <g transform="translate(180, 150)">
                  <rect x="0" y="0" width="130" height="70" rx="8" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.5" />
                  <text x="65" y="28" textAnchor="middle" fontWeight="bold" fill="#065f46">11. Verification</text>
                  <text x="65" y="46" textAnchor="middle" fill="#059669" fontSize="10">Hybrid 4-Score</text>
                  <text x="65" y="58" textAnchor="middle" fill="#10b981" fontSize="9">3-State badges</text>
                </g>

                <path d="M 345 185 L 315 185" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <g transform="translate(350, 150)">
                  <rect x="0" y="0" width="130" height="70" rx="8" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1.5" />
                  <text x="65" y="28" textAnchor="middle" fontWeight="bold" fill="#1e3a8a">10. AI Synthesis</text>
                  <text x="65" y="46" textAnchor="middle" fill="#3b82f6" fontSize="10">Grounded prompts</text>
                  <text x="65" y="58" textAnchor="middle" fill="#60a5fa" fontSize="9">10 RPM throttle</text>
                </g>

                <path d="M 515 185 L 485 185" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <g transform="translate(520, 150)">
                  <rect x="0" y="0" width="130" height="70" rx="8" fill="#fffbeb" stroke="#fde68a" strokeWidth="1.5" />
                  <text x="65" y="28" textAnchor="middle" fontWeight="bold" fill="#78350f">9. Hybrid Search</text>
                  <text x="65" y="46" textAnchor="middle" fill="#d97706" fontSize="10">Vector + BM25</text>
                  <text x="65" y="58" textAnchor="middle" fill="#b45309" fontSize="9">RRF + MMR diversity</text>
                </g>

                <path d="M 685 185 L 655 185" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <g transform="translate(690, 150)">
                  <rect x="0" y="0" width="130" height="70" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
                  <text x="65" y="28" textAnchor="middle" fontWeight="bold" fill="#0f172a">8. User Inquiry</text>
                  <text x="65" y="46" textAnchor="middle" fill="#64748b" fontSize="10">Language detected</text>
                  <text x="65" y="58" textAnchor="middle" fill="#94a3b8" fontSize="9">Query translated</text>
                </g>

                <path d="M 855 185 L 825 185" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <g transform="translate(860, 150)">
                  <rect x="0" y="0" width="90" height="70" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
                  <text x="45" y="28" textAnchor="middle" fontWeight="bold" fill="#0f172a">7. Database</text>
                  <text x="45" y="46" textAnchor="middle" fill="#64748b" fontSize="10">MongoDB</text>
                  <text x="45" y="58" textAnchor="middle" fill="#94a3b8" fontSize="9">Chunks & Index</text>
                </g>
              </svg>
            </div>

            {/* Numbered Step Explanations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  step: 1,
                  title: 'Upload Documents',
                  happens: `You drop or browse PDF, Word (.docx, .doc), or plain text documents up to ${systemConfig.maxFileSizeMB} MB into the browser interface.`,
                  technique: 'Multer streaming disk storage with MIME and magic-byte validation filters.',
                  see: 'Documents page: dropzone, upload progress bar, and document queue table.',
                },
                {
                  step: 2,
                  title: 'Secure File Storage',
                  happens: 'The physical file is saved into persistent cloud storage so you can download or view it anytime.',
                  technique: 'Supabase Storage bucket with transparent fallback to MongoDB GridFS chunks.',
                  see: 'PDF Viewer modal and document download actions on the Documents page.',
                },
                {
                  step: 3,
                  title: 'Text Extraction & Scanned Detection',
                  happens: 'The parser extracts continuous text streams, page boundaries, and section headings while flagging image-only PDFs.',
                  technique: 'pdf-parse, mammoth for Word XML, and word-extractor for legacy binary formats.',
                  see: 'Document detail modal: total pages, raw text characters, and low-density notices.',
                },
                {
                  step: 4,
                  title: 'Cleaning & Normalization',
                  happens: 'Strips unprintable control characters, rejoins hyphenated line breaks, and standardizes Unicode characters.',
                  technique: 'Regex sanitation, hyphenation repair, and Unicode NFKC normalization.',
                  see: 'Insights → Corpus & Clean Text tab with live character reduction statistics.',
                },
                {
                  step: 5,
                  title: 'Semantic Chunking with Overlap',
                  happens: 'Breaks long papers into bite-sized segments (target 380 tokens) with a 60-token overlap to maintain sentence context.',
                  technique: 'Sliding-window token segmentation with heading and page metadata preservation.',
                  see: 'Document card metric badges showing the exact number of indexed chunks.',
                },
                {
                  step: 6,
                  title: 'Throttled Embedding Generation',
                  happens: 'Passages are converted into 768-dimensional mathematical vectors in safe batches of 10 without exceeding API limits.',
                  technique: 'Google Gemini Embedding Model (gemini-embedding-001) governed by global EmbeddingThrottleQueue.',
                  see: 'Real-time embedding progress badge: "Embedding 10/40" with friendly rate countdowns.',
                },
                {
                  step: 7,
                  title: 'Database Persistence',
                  happens: 'Chunks, embedding vectors, extracted RAKE keyphrases, and detected languages are committed to the database.',
                  technique: 'MongoDB Atlas collections with user-isolated queries and transactional replacement.',
                  see: 'Documents page table displaying language badges and keyphrase tags.',
                },
                {
                  step: 8,
                  title: 'User Question & Language Detection',
                  happens: 'You ask a question in any language; the system detects the language and translates it to English for retrieval.',
                  technique: 'Statistical n-gram analysis via franc and Google Cloud Translation API v2.',
                  see: 'Chat input bar with the optional "Answer language" dropdown selector.',
                },
                {
                  step: 9,
                  title: 'Dual-Channel Hybrid Retrieval',
                  happens: 'Runs dense vector search for conceptual matches alongside BM25 for exact terms, fused by Reciprocal Rank Fusion.',
                  technique: 'Cosine similarity on 768-d vectors + Okapi BM25 + MMR diversity filtering (λ = 0.7).',
                  see: 'Retrieved Evidence drawer below assistant answers with relevance percentages.',
                },
                {
                  step: 10,
                  title: 'Grounded Answer Synthesis',
                  happens: 'Candidate passages are wrapped in strict delimiters and sent to the LLM with instructions to answer only using context.',
                  technique: 'Strict prompt framing on primary model (gemini-3.1-flash-lite) throttled at 10 RPM.',
                  see: 'Assistant message stream with inline bracket citations like [1] and [2].',
                },
                {
                  step: 11,
                  title: 'Hybrid Claim Verification',
                  happens: 'Every factual sentence is verified against its cited passage using lexical overlap, TF-IDF, numbers, and vectors.',
                  technique: 'Hybrid verification formula with 3-state confidence (Verified, Partially supported, Unsupported).',
                  see: 'Direct summary badge: "X of Y claims verified" and interactive card highlight spans.',
                },
                {
                  step: 12,
                  title: 'Interactive Cited Response & Export',
                  happens: 'You read the grounded answer, click citation badges to highlight source excerpts, or export to Markdown or PDF.',
                  technique: 'Client-side PDF generation via jsPDF and markdown export blobs.',
                  see: 'Export .md button and Export PDF buttons in Summary and Compare views.',
                },
              ].map((item) => (
                <div key={item.step} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 font-bold text-xs flex items-center justify-center border border-brand-200 shrink-0">
                      {item.step}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>What happens:</strong> {item.happens}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Technique:</strong> <span className="font-mono text-slate-700">{item.technique}</span>
                  </p>
                  <p className="text-xs text-brand-700 bg-brand-50/50 p-2 rounded border border-brand-100">
                    <strong>Where to see it:</strong> {item.see}
                  </p>
                </div>
              ))}
            </div>

            {/* Insights Flow Diagram (SVG) */}
            <div className="mt-8 bg-white rounded-xl border border-slate-200 p-5 shadow-xs overflow-x-auto">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-purple-600" />
                <span>Analytical Insights & Persistent Caching Flow</span>
              </div>
              <svg viewBox="0 0 760 120" className="w-full min-w-[620px] h-auto text-xs font-sans select-none">
                <g transform="translate(10, 25)">
                  <rect x="0" y="0" width="160" height="70" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
                  <text x="80" y="30" textAnchor="middle" fontWeight="bold" fill="#0f172a">Select Documents</text>
                  <text x="80" y="48" textAnchor="middle" fill="#64748b" fontSize="10">Choose 1 to 10 papers</text>
                </g>
                <path d="M 175 60 L 215 60" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <g transform="translate(220, 25)">
                  <rect x="0" y="0" width="160" height="70" rx="8" fill="#fdf4ff" stroke="#f0abfc" strokeWidth="1.5" />
                  <text x="80" y="30" textAnchor="middle" fontWeight="bold" fill="#701a75">NLP Analysis Engine</text>
                  <text x="80" y="48" textAnchor="middle" fill="#a21caf" fontSize="10">Topics, NER, Sentiment</text>
                </g>
                <path d="M 385 60 L 425 60" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <g transform="translate(430, 25)">
                  <rect x="0" y="0" width="140" height="70" rx="8" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.5" />
                  <text x="70" y="30" textAnchor="middle" fontWeight="bold" fill="#065f46">MongoDB Cache</text>
                  <text x="70" y="48" textAnchor="middle" fill="#059669" fontSize="10">Hash-keyed storage</text>
                </g>
                <path d="M 575 60 L 615 60" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <g transform="translate(620, 25)">
                  <rect x="0" y="0" width="130" height="70" rx="8" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1.5" />
                  <text x="65" y="30" textAnchor="middle" fontWeight="bold" fill="#1e3a8a">Interactive Views</text>
                  <text x="65" y="48" textAnchor="middle" fill="#3b82f6" fontSize="10">Zero-latency reload</text>
                </g>
              </svg>
            </div>
          </section>

          {/* ========================================== */}
          {/* SECTION 4: GUIDE TO EACH PAGE */}
          {/* ========================================== */}
          <section id="pages-guide" className="scroll-mt-28">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">4. Guide to Each Page</h2>
              <div className="h-1 w-12 bg-brand-600 rounded mt-1.5" />
              <p className="text-sm text-slate-600 mt-2">
                What each page does, when you should use it, and what tangible results you receive.
              </p>
            </div>

            <div className="space-y-6">
              {/* Dashboard */}
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-brand-600">
                  <LayoutDashboard className="w-5 h-5" />
                  <h3 className="text-base font-bold text-slate-900">Dashboard (/dashboard)</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>What it does:</strong> Provides a high-level overview of your entire research corpus, showing total indexed documents, recent uploads, cross-document topic connection summaries, and quick navigation shortcuts.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>When to use it:</strong> Start here when opening the application to check system status, recent research activity, and high-frequency thematic connections across your papers.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>What you get:</strong> Document count statistics, recent document cards with one-click workspace openers, and a global corpus summary.
                </p>
              </div>

              {/* Documents */}
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-blue-600">
                  <FileText className="w-5 h-5" />
                  <h3 className="text-base font-bold text-slate-900">Documents (/documents)</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>What it does:</strong> Manages your uploaded files. Supports uploading PDF, Word (.docx, .doc), and TXT files, inspecting indexed chunk counts, viewing detected languages, and exploring extracted RAKE keyphrase tags.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>When to use it:</strong> Use when adding new papers to your research collection, deleting obsolete drafts, or inspecting detailed metadata via the document detail modal.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>What you get:</strong> Interactive document cards with language badges, page counts, chunk metrics, and a detail modal displaying character counts and sentiment polarity.
                </p>
              </div>

              {/* Research Workspace */}
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Sparkles className="w-5 h-5" />
                  <h3 className="text-base font-bold text-slate-900">Research Workspace (/research)</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>What it does:</strong> The core conversational synthesis hub. Check one or more documents from your active collection and ask complex research inquiries across them.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>When to use it:</strong> When exploring research questions, looking up specific benchmark results, finding contradictions between papers, or drafting literature notes.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>What you get:</strong> Markdown-formatted answers with inline bracket citations [n], a verification badge showing claim confidence, an interactive source drawer with highlighted passages, a PDF previewer modal, and single-click markdown export.
                </p>
              </div>

              {/* Compare */}
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-indigo-600">
                  <GitCompare className="w-5 h-5" />
                  <h3 className="text-base font-bold text-slate-900">Compare (/compare)</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>What it does:</strong> Automatically generates a side-by-side comparison matrix across up to 5 papers evaluated across 10 structured dimensions: Objectives, Methodology, Dataset/Benchmarks, Results, Advantages, Research Gaps, Technical Innovations, Practical Implications, Future Work, and Verdict.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>When to use it:</strong> When reviewing multiple competing models, evaluating alternative algorithmic approaches, or preparing literature review comparison tables.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>What you get:</strong> A responsive side-by-side table with cell-level bracket citations, optional translation to other languages, and instant PDF report export.
                </p>
              </div>

              {/* Insights and its 7 tabs */}
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-purple-600">
                  <FlaskConical className="w-5 h-5" />
                  <h3 className="text-base font-bold text-slate-900">Insights (/insights)</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The analytical workbench offering deep computational linguistic exploration into your document corpus. Divided into 7 focused tabs:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-blue-600" />
                      Corpus & Clean Text
                    </h4>
                    <p className="text-xs text-slate-600">
                      <strong>What it does:</strong> An interactive 8-step preprocessing pipeline (lowercasing, punctuation stripping, tokenization, stopword removal, Porter stemming).
                    </p>
                    <p className="text-xs text-slate-500">
                      <strong>What you get:</strong> Character and token reduction metrics, Bag-of-Words vocabulary tables, and pairwise TF-IDF cosine similarity heatmaps between papers.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-600" />
                      Topic Explorer
                    </h4>
                    <p className="text-xs text-slate-600">
                      <strong>What it does:</strong> Discovers latent themes across your documents using unsupervised K-Means clustering on existing 768-d chunk embeddings.
                    </p>
                    <p className="text-xs text-slate-500">
                      <strong>What you get:</strong> Automatic optimal-k selection via Silhouette Coefficient, class-based TF-IDF (c-TF-IDF) keywords, and a 2D PCA scatterplot.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Tags className="w-3.5 h-3.5 text-amber-600" />
                      Named Entities
                    </h4>
                    <p className="text-xs text-slate-600">
                      <strong>What it does:</strong> Extracts domain-specific entities across 7 validated types: PERSON, ORG, DATASET, METRIC, MODEL, DATE, and LOCATION.
                    </p>
                    <p className="text-xs text-slate-500">
                      <strong>What you get:</strong> Categorized entity chips, RAKE keyphrase tags, and gold-standard evaluation reporting Accuracy, Recall, and a 3x3 Confusion Matrix.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Smile className="w-3.5 h-3.5 text-emerald-600" />
                      Sentiment & Tone
                    </h4>
                    <p className="text-xs text-slate-600">
                      <strong>What it does:</strong> Compares offline rule-based lexicon scoring (AFINN-165) against contextual AI zero-shot classification.
                    </p>
                    <p className="text-xs text-slate-500">
                      <strong>What you get:</strong> Normalized valence scores (-5 to +5), sentence-level tone distributions (Positive, Neutral, Negative), and agreement metrics.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Languages className="w-3.5 h-3.5 text-cyan-600" />
                      Cross-Lingual
                    </h4>
                    <p className="text-xs text-slate-600">
                      <strong>What it does:</strong> Demonstrates statistical language identification (franc) and tiered multi-provider translation.
                    </p>
                    <p className="text-xs text-slate-500">
                      <strong>What you get:</strong> Detected language ISO codes with confidence scores, translation across English, Marathi, Hindi, etc., and provider badges.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <BookMarked className="w-3.5 h-3.5 text-rose-600" />
                      Literature Synthesis
                    </h4>
                    <p className="text-xs text-slate-600">
                      <strong>What it does:</strong> Synthesizes multiple papers into an executive academic review highlighting consensus, contradictions, and methodological gaps.
                    </p>
                    <p className="text-xs text-slate-500">
                      <strong>What you get:</strong> Structured sections with page citations, one-click PDF export, and markdown copy capabilities.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 md:col-span-2">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-indigo-600" />
                      Prompt Studio
                    </h4>
                    <p className="text-xs text-slate-600">
                      <strong>What it does:</strong> Versioned library of 8 production prompt templates with engineering rationales, alongside an interactive testing sandbox.
                    </p>
                    <p className="text-xs text-slate-500">
                      <strong>What you get:</strong> Side-by-side strategy comparisons (Zero-Shot vs. Few-Shot vs. Chain-of-Thought) tracking token usage and execution latency.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================== */}
          {/* SECTION 5: TECHNOLOGIES & TECHNIQUES USED */}
          {/* ========================================== */}
          <section id="techniques" className="scroll-mt-28">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">5. Technologies & Techniques Used</h2>
              <div className="h-1 w-12 bg-brand-600 rounded mt-1.5" />
              <p className="text-sm text-slate-600 mt-2">
                A verified inventory of all 36 computational techniques and algorithms implemented in our source codebase.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="p-3">Technique</th>
                      <th className="p-3">What It Is</th>
                      <th className="p-3">Why We Use It</th>
                      <th className="p-3">Where You See It</th>
                      <th className="p-3 font-mono text-[11px]">Implementation (Route / File)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* HEADING 1: READING DOCUMENTS */}
                    <tr className="bg-slate-50/80 font-bold text-slate-800 text-[11px]">
                      <td colSpan={5} className="p-2.5 px-3 uppercase tracking-wider text-brand-700">
                        1. Reading Documents
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Text Extraction</td>
                      <td className="p-3 text-slate-600">Extracts raw text streams from PDF, Word (.docx, .doc), and TXT formats.</td>
                      <td className="p-3 text-slate-600">Unifies multi-format files into standard text streams for processing.</td>
                      <td className="p-3 text-slate-600">Documents Page & Detail Modal</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">backend/src/services/documents/extractor.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Scanned-PDF Detection</td>
                      <td className="p-3 text-slate-600">Calculates character density per page (&lt;20 chars/page flags as scanned).</td>
                      <td className="p-3 text-slate-600">Prevents silent failures when users upload image-only scans without OCR.</td>
                      <td className="p-3 text-slate-600">Document Card Warning Pill</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">extractor.ts (detectScannedDocument)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Semantic Chunking</td>
                      <td className="p-3 text-slate-600">Splits document text into 380-token segments with a 60-token sliding overlap.</td>
                      <td className="p-3 text-slate-600">Fits within vector embedding windows while preserving cross-boundary context.</td>
                      <td className="p-3 text-slate-600">Document Chunk Badges</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">backend/src/services/documents/chunker.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Multi-Tier Storage</td>
                      <td className="p-3 text-slate-600">Saves raw uploads into Supabase Storage, MongoDB GridFS, or local disk.</td>
                      <td className="p-3 text-slate-600">Guarantees persistent free storage across container redeployments.</td>
                      <td className="p-3 text-slate-600">PDF Viewer Modal / Download</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">backend/src/services/storage/storageService.ts</td>
                    </tr>

                    {/* HEADING 2: CLEANING & REPRESENTING TEXT */}
                    <tr className="bg-slate-50/80 font-bold text-slate-800 text-[11px]">
                      <td colSpan={5} className="p-2.5 px-3 uppercase tracking-wider text-brand-700">
                        2. Cleaning & Representing Text
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Text Sanitization</td>
                      <td className="p-3 text-slate-600">Strips non-printable control characters, repaired line-break hyphens, and standardizes whitespace.</td>
                      <td className="p-3 text-slate-600">Removes extraction noise that pollutes embedding vectors.</td>
                      <td className="p-3 text-slate-600">Insights → Corpus & Clean Text</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">POST /api/nlp/preprocess (nlpPreprocessingService.ts)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Tokenization</td>
                      <td className="p-3 text-slate-600">Partitions text strings into linguistic words and sub-tokens.</td>
                      <td className="p-3 text-slate-600">Provides fundamental units for frequency analysis and indexing.</td>
                      <td className="p-3 text-slate-600">Insights → Corpus & Clean Text</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">nlpPreprocessingService.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Stopword Removal</td>
                      <td className="p-3 text-slate-600">Filters non-informative high-frequency syntactic function words (150+ words).</td>
                      <td className="p-3 text-slate-600">Highlights substantive domain nouns and verbs for lexical comparison.</td>
                      <td className="p-3 text-slate-600">Insights → Corpus & Clean Text</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">nlpPreprocessingService.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Porter Stemming</td>
                      <td className="p-3 text-slate-600">Iteratively strips suffixes to reduce grammatical word variants to root stems.</td>
                      <td className="p-3 text-slate-600">Conflates terms like "connecting", "connection", and "connects".</td>
                      <td className="p-3 text-slate-600">Insights → Corpus & Clean Text</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">natural.PorterStemmer in nlpPreprocessingService.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Bag-of-Words (BoW)</td>
                      <td className="p-3 text-slate-600">Generates dictionary counts of term occurrences across documents.</td>
                      <td className="p-3 text-slate-600">Establishes term frequency baselines for vocabulary distribution.</td>
                      <td className="p-3 text-slate-600">Insights → Corpus & Clean Text</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">nlpVectorizationService.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">TF-IDF Weighting</td>
                      <td className="p-3 text-slate-600">Weighs terms by frequency within a chunk offset by rarity across the corpus.</td>
                      <td className="p-3 text-slate-600">Discovers distinctive terms that define specific papers.</td>
                      <td className="p-3 text-slate-600">Insights → Corpus & Clean Text</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">nlpVectorizationService.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Cosine Similarity</td>
                      <td className="p-3 text-slate-600">Calculates geometric angular similarity between unit-normalized vector representations.</td>
                      <td className="p-3 text-slate-600">Measures conceptual alignment independent of passage length.</td>
                      <td className="p-3 text-slate-600">Similarity Heatmap Grid</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">POST /api/nlp/vectorize (nlpVectorizationService.ts)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Dense Embeddings</td>
                      <td className="p-3 text-slate-600">Generates 768-dimensional float vectors via Gemini (gemini-embedding-001). Local 384-d ONNX is reserved exclusively for offline local development, never mixed into production.</td>
                      <td className="p-3 text-slate-600">Enables semantic search that matches synonyms and conceptual intent.</td>
                      <td className="p-3 text-slate-600">System Activity / Ready Badge</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">backend/src/services/ai/geminiEmbeddingProvider.ts</td>
                    </tr>

                    {/* HEADING 3: SEARCH & ANSWERS */}
                    <tr className="bg-slate-50/80 font-bold text-slate-800 text-[11px]">
                      <td colSpan={5} className="p-2.5 px-3 uppercase tracking-wider text-brand-700">
                        3. Search & Answers
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Okapi BM25</td>
                      <td className="p-3 text-slate-600">Probabilistic lexical search scoring exact term matches with length normalization.</td>
                      <td className="p-3 text-slate-600">Catches rare model acronyms, formula names, and specific identifiers.</td>
                      <td className="p-3 text-slate-600">Retrieved Evidence Drawer</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">backend/src/services/ai/bm25.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Reciprocal Rank Fusion (RRF)</td>
                      <td className="p-3 text-slate-600">Merges vector cosine ranks and BM25 ranks via formula 1 / (60 + rank).</td>
                      <td className="p-3 text-slate-600">Combines semantic and lexical scores without fragile scale calibration.</td>
                      <td className="p-3 text-slate-600">Ranked Search Candidates</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">backend/src/services/ai/vectorStore.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">MMR Diversity Re-ranking</td>
                      <td className="p-3 text-slate-600">Maximal Marginal Relevance balances relevance with diversity (λ = 0.7).</td>
                      <td className="p-3 text-slate-600">Eliminates repetitive candidate chunks from the same paper section.</td>
                      <td className="p-3 text-slate-600">Top-K Context Passages</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">vectorStore.ts (computeMMR)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">RAG Architecture</td>
                      <td className="p-3 text-slate-600">Retrieval-Augmented Generation conditioning LLM output on dynamic context.</td>
                      <td className="p-3 text-slate-600">Eliminates hallucinations by grounding responses strictly in verified text.</td>
                      <td className="p-3 text-slate-600">Research Workspace Chat</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">POST /api/research/chat (ragService.ts)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Prompt Strategies</td>
                      <td className="p-3 text-slate-600">Zero-Shot, Few-Shot exemplars, Chain-of-Thought, and structured JSON schemas.</td>
                      <td className="p-3 text-slate-600">Enforces deterministic claim extraction and citation bracket markers.</td>
                      <td className="p-3 text-slate-600">Insights → Prompt Studio</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">GET /api/nlp/prompts (prompts/index.ts)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Hybrid Claim Verification</td>
                      <td className="p-3 text-slate-600">Multi-factor scoring validating generated claims against source excerpts.</td>
                      <td className="p-3 text-slate-600">Ensures assertions are genuinely supported by cited text.</td>
                      <td className="p-3 text-slate-600">Claim Badges (Verified/Partial/Unsupported)</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">backend/src/services/ai/citationVerifier.ts</td>
                    </tr>

                    {/* HEADING 4: INSIGHTS */}
                    <tr className="bg-slate-50/80 font-bold text-slate-800 text-[11px]">
                      <td colSpan={5} className="p-2.5 px-3 uppercase tracking-wider text-brand-700">
                        4. Analytical Insights
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">K-Means Topic Clustering</td>
                      <td className="p-3 text-slate-600">Unsupervised clustering partitioning passage embeddings into K semantic groups.</td>
                      <td className="p-3 text-slate-600">Discovers recurring research topics across papers without manual labels.</td>
                      <td className="p-3 text-slate-600">Insights → Topic Explorer</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">GET /api/nlp/topics (nlpTopicService.ts)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Silhouette Coefficient</td>
                      <td className="p-3 text-slate-600">Measures cluster tightness vs separation across k values from 2 to 6.</td>
                      <td className="p-3 text-slate-600">Automatically determines the mathematically optimal cluster count K.</td>
                      <td className="p-3 text-slate-600">Topic Quality Score</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">nlpTopicService.ts (computeSilhouette)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">class-based TF-IDF (c-TF-IDF)</td>
                      <td className="p-3 text-slate-600">Treats all chunks in a cluster as one document to extract distinctive cluster keywords.</td>
                      <td className="p-3 text-slate-600">Generates readable, descriptive labels for unsupervised topics.</td>
                      <td className="p-3 text-slate-600">Topic Cluster Keyword Chips</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">nlpTopicService.ts (extractTopKeywords)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Principal Component Analysis (PCA)</td>
                      <td className="p-3 text-slate-600">Reduces 768-dimensional embedding vectors down to 2 principal components.</td>
                      <td className="p-3 text-slate-600">Plots multi-dimensional document clusters on an interactive 2D plane.</td>
                      <td className="p-3 text-slate-600">Interactive 2D Topic Scatterplot</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">nlpTopicService.ts (computePCA2D)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Topic Coherence</td>
                      <td className="p-3 text-slate-600">Evaluates pairwise word co-occurrence similarity among top topic keywords.</td>
                      <td className="p-3 text-slate-600">Provides a quantitative validation metric for cluster interpretability.</td>
                      <td className="p-3 text-slate-600">Topic Explorer Coherence Card</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">nlpTopicService.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Lexicon Sentiment (AFINN)</td>
                      <td className="p-3 text-slate-600">Rule-based scoring mapping 3,300+ English words to integer valence scores (-5 to +5).</td>
                      <td className="p-3 text-slate-600">Provides fast, deterministic sentiment analysis without API calls.</td>
                      <td className="p-3 text-slate-600">Insights → Sentiment & Tone</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">GET /api/nlp/sentiment (nlpSentimentService.ts)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">LLM Tone & Subjectivity</td>
                      <td className="p-3 text-slate-600">Contextual evaluation of tone, objectivity, and sentiment distribution using Gemini.</td>
                      <td className="p-3 text-slate-600">Detects subtle academic hedges, framing, and rhetorical nuances.</td>
                      <td className="p-3 text-slate-600">Sentiment Comparison View</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">nlpSentimentService.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Named Entity Recognition (NER)</td>
                      <td className="p-3 text-slate-600">Identifies academic entities: PERSON, ORG, DATASET, METRIC, MODEL, DATE, LOCATION.</td>
                      <td className="p-3 text-slate-600">Structures unstructured text into typed academic metadata cards.</td>
                      <td className="p-3 text-slate-600">Insights → Named Entities</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">GET /api/nlp/entities (nlpExtractionService.ts)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">RAKE Keyphrase Extraction</td>
                      <td className="p-3 text-slate-600">Rapid Automatic Keyword Extraction using word degree to frequency ratios.</td>
                      <td className="p-3 text-slate-600">Extracts multi-word technical concepts without requiring pre-trained models.</td>
                      <td className="p-3 text-slate-600">Document Card #Keyphrase Chips</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">nlpExtractionService.ts (extractKeyphrases)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">10-Dimension Comparison</td>
                      <td className="p-3 text-slate-600">Parallel structured synthesis across 10 academic dimensions.</td>
                      <td className="p-3 text-slate-600">Creates comparative research matrices across multiple papers instantly.</td>
                      <td className="p-3 text-slate-600">Compare Page Matrix</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">POST /api/research/compare (comparisonService.ts)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Literature Review Synthesis</td>
                      <td className="p-3 text-slate-600">Generates comprehensive synthesis highlighting consensus and contradictions.</td>
                      <td className="p-3 text-slate-600">Accelerates literature review drafting with page citations.</td>
                      <td className="p-3 text-slate-600">Insights → Literature Synthesis</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">POST /api/nlp/literature-review</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Evaluation Metrics</td>
                      <td className="p-3 text-slate-600">Calculates Accuracy, Precision, Recall, Macro F1, and a custom 3x3 Confusion Matrix.</td>
                      <td className="p-3 text-slate-600">Empirically validates extraction models against curated gold-standard test sets.</td>
                      <td className="p-3 text-slate-600">Insights → Named Entities (Evaluation)</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">POST /api/nlp/evaluation (nlpEvaluationService.ts)</td>
                    </tr>

                    {/* HEADING 5: LANGUAGES */}
                    <tr className="bg-slate-50/80 font-bold text-slate-800 text-[11px]">
                      <td colSpan={5} className="p-2.5 px-3 uppercase tracking-wider text-brand-700">
                        5. Languages & Translation
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Language Detection</td>
                      <td className="p-3 text-slate-600">Statistical trigram analysis identifying language ISO codes via franc.</td>
                      <td className="p-3 text-slate-600">Detects document language upon upload and determines query language.</td>
                      <td className="p-3 text-slate-600">Document Card Language Badges</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">ingestionService.ts & nlpMultilingualService.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Tiered Translation</td>
                      <td className="p-3 text-slate-600">Google Cloud Translation API v2 $\to$ Gemini LLM $\to$ local dictionary fallback.</td>
                      <td className="p-3 text-slate-600">Translates summaries and comparisons with clear provider attribution.</td>
                      <td className="p-3 text-slate-600">Summary & Compare Translation Drops</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">POST /api/nlp/translate (nlpMultilingualService.ts)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Cross-Lingual QA</td>
                      <td className="p-3 text-slate-600">Translates non-English queries to English for retrieval, then synthesizes in user language.</td>
                      <td className="p-3 text-slate-600">Allows asking questions in Marathi, Hindi, etc., against English papers.</td>
                      <td className="p-3 text-slate-600">Research Workspace Language Drop</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">ragService.ts & nlpMultilingualService.ts</td>
                    </tr>

                    {/* HEADING 6: RELIABILITY & SAFETY */}
                    <tr className="bg-slate-50/80 font-bold text-slate-800 text-[11px]">
                      <td colSpan={5} className="p-2.5 px-3 uppercase tracking-wider text-brand-700">
                        6. Reliability & Safety
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Embedding Batching & Throttle</td>
                      <td className="p-3 text-slate-600">Global queue enforcing 10-chunk batches and 60 RPM cap with jittered exponential backoff.</td>
                      <td className="p-3 text-slate-600">Prevents 429 Resource Exhausted rate limit crashes during multi-page uploads.</td>
                      <td className="p-3 text-slate-600">Live Embedding Counter & Retry Badges</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">backend/src/services/ai/embeddingThrottleQueue.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">LLM Generation Throttle</td>
                      <td className="p-3 text-slate-600">Limits text generation calls to 10 RPM with 4,500ms spacing and 500/day global limits.</td>
                      <td className="p-3 text-slate-600">Guarantees stability within the Google AI Studio free tier quotas.</td>
                      <td className="p-3 text-slate-600">Non-blocking Busy Notice</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">backend/src/services/ai/llmThrottleQueue.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Per-User Daily AI Cap</td>
                      <td className="p-3 text-slate-600">Limits each registered user account to {systemConfig.userDailyAiCap} AI queries per UTC day.</td>
                      <td className="p-3 text-slate-600">Prevents a single user from depleting the shared daily AI quota.</td>
                      <td className="p-3 text-slate-600">Header Quota Badge: "Requests: X / {systemConfig.userDailyAiCap}"</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">llmThrottleQueue.ts (acquireUserQuota)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">MongoDB Persistent Caching</td>
                      <td className="p-3 text-slate-600">Caches analytical results using documentId, contentHash, task, and parameters.</td>
                      <td className="p-3 text-slate-600">Delivers instantaneous reload on repeat visits with zero quota consumption.</td>
                      <td className="p-3 text-slate-600">Sub-second Reload Speeds</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">backend/src/models/NlpCache.ts</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">User Data Isolation</td>
                      <td className="p-3 text-slate-600">Scoped MongoDB queries filtering by authenticated user ObjectId.</td>
                      <td className="p-3 text-slate-600">Ensures users can never access, query, or delete another user's documents.</td>
                      <td className="p-3 text-slate-600">Private Document Library</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">backend/src/middleware/auth.ts</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ========================================== */}
          {/* SECTION 6: HOW ANSWERS STAY TRUSTWORTHY */}
          {/* ========================================== */}
          <section id="trustworthy-citations" className="scroll-mt-28">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">6. How Answers Stay Trustworthy</h2>
              <div className="h-1 w-12 bg-brand-600 rounded mt-1.5" />
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-6">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900">Strict Sentence & Cell Citations</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Every factual claim in an answer and every cell in a comparison matrix is anchored with bracketed citation markers like <span className="font-semibold text-brand-700 bg-brand-50 px-1 py-0.5 rounded border border-brand-200">[1]</span> or <span className="font-semibold text-brand-700 bg-brand-50 px-1 py-0.5 rounded border border-brand-200">[Paper A, Page 4]</span>. Clicking any marker expands the exact source excerpt and opens the PDF viewer modal at that exact page number.
                </p>
              </div>

              {/* The 3 States */}
              <div className="space-y-3">
                <h3 className="text-base font-bold text-slate-900">The Three Verification Statuses</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verified (High Confidence)</span>
                    </div>
                    <p className="text-slate-600">
                      Score $\ge 0.70$. High lexical containment, strong TF-IDF match, and identical numbers or benchmark percentages.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                      <AlertCircle className="w-4 h-4" />
                      <span>Partially Supported (Medium)</span>
                    </div>
                    <p className="text-slate-600">
                      Score $0.40 - 0.70$. The source excerpt discusses the topic conceptually but lacks complete number or exact term alignment.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-rose-700 font-bold">
                      <AlertCircle className="w-4 h-4" />
                      <span>Unsupported (Low)</span>
                    </div>
                    <p className="text-slate-600">
                      Score $&lt; 0.40$. The cited passage does not provide adequate textual evidence for the statement.
                    </p>
                  </div>
                </div>
              </div>

              {/* Hybrid Formula */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
                <h4 className="font-bold text-slate-900">How the Hybrid Check Works</h4>
                <p className="text-slate-600 leading-relaxed">
                  Verification uses a 4-part hybrid scoring formula comparing the generated assertion against the retrieved source excerpt:
                </p>
                <div className="font-mono bg-white p-2.5 rounded border border-slate-200 text-slate-800 text-[11px] overflow-x-auto">
                  Score = 0.35 × Containment + 0.35 × TF-IDF_span + 0.15 × Number_Match + 0.15 × Vector_Cosine
                </div>
                <ul className="space-y-1 text-slate-600 list-disc list-inside">
                  <li><strong>Containment (35%):</strong> Measures exact n-gram token overlap between assertion and source.</li>
                  <li><strong>TF-IDF Span (35%):</strong> Evaluates keyword importance to prevent paragraph length from diluting short claims.</li>
                  <li><strong>Number & Metric Match (15%):</strong> Verifies that all percentages, decimals, and quantities match exactly.</li>
                  <li><strong>Dense Semantic Cosine (15%):</strong> Confirms overall conceptual similarity in vector space.</li>
                </ul>
              </div>

              {/* What happens to unsupported claims and limits */}
              <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <h4 className="font-bold text-slate-900">What Happens to Unsupported Claims?</h4>
                <p>
                  If an assertion scores below 0.40, the system triggers a one-shot grounding regeneration. If the statement remains unsupported, it is flagged in the answer header summary (e.g. <em>"1 unverified claim"</em>), and uncited background passages are stored in a separate collapsible drawer.
                </p>
                <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200 text-amber-900 space-y-1">
                  <span className="font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Honest Note on Verification Limits
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    The verification engine measures factual alignment between the generated answer and the text contained within your uploaded papers. While it successfully catches hallucinations and false citations, it cannot determine whether the source research paper itself contains scientific errors, flawed experimental data, or peer-review issues.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================== */}
          {/* SECTION 7: LANGUAGES & TRANSLATION */}
          {/* ========================================== */}
          <section id="languages" className="scroll-mt-28">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">7. Languages & Translation</h2>
              <div className="h-1 w-12 bg-brand-600 rounded mt-1.5" />
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                The platform includes built-in multilingual intelligence designed to break down language barriers in international scientific literature.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-blue-600" />
                    Language Detection
                  </h4>
                  <p className="text-slate-600 leading-relaxed">
                    The system runs statistical trigram frequency profiling using <code>franc</code> to identify over 50 languages upon file upload and during question submission.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Languages className="w-4 h-4 text-purple-600" />
                    Tiered Translation
                  </h4>
                  <p className="text-slate-600 leading-relaxed">
                    Uses Google Cloud Translation API v2 when configured, falling back smoothly to Gemini LLM translation and offline dictionary mappings.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Cross-Lingual QA
                  </h4>
                  <p className="text-slate-600 leading-relaxed">
                    Ask questions in Marathi, Hindi, Spanish, or French; the assistant retrieves relevant English passages and translates the cited response back to your language.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">Transparent Provider Attribution:</span>
                  <span className="ml-1">Every translated synthesis displays a provider badge:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[10px] border border-blue-200">
                    Google Cloud Translation
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold text-[10px] border border-purple-200">
                    Gemini AI
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================== */}
          {/* SECTION 8: LIMITS & GOOD TO KNOW */}
          {/* ========================================== */}
          <section id="limits" className="scroll-mt-28">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">8. Limits & Good to Know</h2>
              <div className="h-1 w-12 bg-brand-600 rounded mt-1.5" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Supported Files & Size</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Supports <strong>{systemConfig.supportedFileTypes.join(', ')}</strong> files up to <strong>{systemConfig.maxFileSizeMB} MB</strong> per document. Scanned PDFs with no embedded text stream are detected and flagged so you can use text-searchable PDFs.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Free-Tier AI Limits & Daily Caps</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Operating on Google Gemini free tier with an RPM cap of {systemConfig.llmRpmLimit} requests/min and {systemConfig.llmDailyLimit} requests/day global. Individual registered accounts have a generous daily limit of <strong>{systemConfig.userDailyAiCap} queries/day</strong> reset at UTC midnight.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span>Server Spin-Up (Render Free Tier)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The backend server is hosted on Render's free tier. If no requests have arrived recently, the server sleeps and may take approximately <strong>50 seconds to spin up</strong> on your first query. Subsequent queries respond promptly.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Lock className="w-4 h-4 text-purple-600" />
                  <span>User Data Privacy & Isolation</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Multi-user security uses bcryptjs password hashing and JWT authentication. Your documents, chat sessions, chunks, and cached insights are strictly isolated to your user ID—other accounts cannot search or view your uploads.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2 md:col-span-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Binary className="w-4 h-4 text-emerald-600" />
                  <span>Strict Vector Consistency (768-d Only)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Production strictly enforces <strong>768-dimensional Gemini embeddings</strong> (<code>gemini-embedding-001</code>). The system will never silently fall back to 384-dimensional local embeddings in production to prevent mixing vector dimensions. Local 384-d ONNX embeddings are reserved exclusively for offline local development and unit tests.
                </p>
              </div>
            </div>
          </section>

          {/* ========================================== */}
          {/* SECTION 9: ARCHITECTURE AT A GLANCE */}
          {/* ========================================== */}
          <section id="architecture" className="scroll-mt-28">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">9. Architecture at a Glance</h2>
              <div className="h-1 w-12 bg-brand-600 rounded mt-1.5" />
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-6">
              {/* Architecture SVG */}
              <div className="overflow-x-auto">
                <svg viewBox="0 0 760 160" className="w-full min-w-[620px] h-auto text-xs font-sans select-none">
                  <rect x="10" y="20" width="130" height="110" rx="8" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1.5" />
                  <text x="75" y="45" textAnchor="middle" fontWeight="bold" fill="#1e3a8a">Client Web App</text>
                  <text x="75" y="65" textAnchor="middle" fill="#3b82f6" fontSize="10">React 19 + TypeScript</text>
                  <text x="75" y="80" textAnchor="middle" fill="#3b82f6" fontSize="10">Vite 8 + Tailwind CSS</text>
                  <text x="75" y="100" textAnchor="middle" fill="#60a5fa" fontSize="9">Hosted on Vercel</text>

                  <path d="M 145 75 L 185 75" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                  <rect x="190" y="20" width="150" height="110" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
                  <text x="265" y="45" textAnchor="middle" fontWeight="bold" fill="#0f172a">API Server</text>
                  <text x="265" y="65" textAnchor="middle" fill="#64748b" fontSize="10">Node.js + Express</text>
                  <text x="265" y="80" textAnchor="middle" fill="#64748b" fontSize="10">Rate Limiter & Queues</text>
                  <text x="265" y="100" textAnchor="middle" fill="#94a3b8" fontSize="9">Hosted on Render</text>

                  <path d="M 345 75 L 385 75" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                  <rect x="390" y="15" width="160" height="60" rx="8" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.5" />
                  <text x="470" y="38" textAnchor="middle" fontWeight="bold" fill="#065f46">Database & Vectors</text>
                  <text x="470" y="55" textAnchor="middle" fill="#059669" fontSize="10">MongoDB Atlas (Mongoose)</text>

                  <rect x="390" y="85" width="160" height="60" rx="8" fill="#fffbeb" stroke="#fde68a" strokeWidth="1.5" />
                  <text x="470" y="108" textAnchor="middle" fontWeight="bold" fill="#78350f">File Storage</text>
                  <text x="470" y="125" textAnchor="middle" fill="#d97706" fontSize="10">Supabase Bucket / GridFS</text>

                  <path d="M 345 50 L 385 45" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />
                  <path d="M 345 95 L 385 110" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                  <path d="M 555 75 L 595 75" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />

                  <rect x="600" y="20" width="150" height="110" rx="8" fill="#fdf4ff" stroke="#f0abfc" strokeWidth="1.5" />
                  <text x="675" y="45" textAnchor="middle" fontWeight="bold" fill="#701a75">Cloud AI Services</text>
                  <text x="675" y="65" textAnchor="middle" fill="#a21caf" fontSize="10">Google Gemini LLM</text>
                  <text x="675" y="80" textAnchor="middle" fill="#a21caf" fontSize="10">768-d Embeddings</text>
                  <text x="675" y="100" textAnchor="middle" fill="#c026d3" fontSize="9">Google Cloud Translation</text>
                </svg>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Frontend Layer</h4>
                  <p>React 19 single-page application built with Vite and Tailwind CSS. Hosted globally on Vercel edge networks for instant asset delivery.</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Backend Server</h4>
                  <p>Express and TypeScript API server on Render. Handles stream processing, rate-limit queues, authentication, and hybrid vector search.</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Data & AI Providers</h4>
                  <p>MongoDB Atlas stores metadata and chunk vectors; Supabase stores original files; Google Gemini powers generative synthesis and embeddings.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================== */}
          {/* SECTION 10: FAQ */}
          {/* ========================================== */}
          <section id="faq" className="scroll-mt-28">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">10. Frequently Asked Questions</h2>
              <div className="h-1 w-12 bg-brand-600 rounded mt-1.5" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-brand-600" />
                  Can I upload scanned PDFs or photos of paper pages?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The system requires text-searchable documents. If you upload a scanned image PDF with no embedded digital text layer, the extractor will flag it with a low-density warning (&lt;20 characters per page). Please use documents processed with OCR for best results.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-brand-600" />
                  How many documents can I research simultaneously?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  In the Research Workspace, you can select between 1 and 10 documents simultaneously. In the Compare Matrix, you can compare up to 5 papers side-by-side across all 10 evaluation dimensions.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-brand-600" />
                  Does the assistant answer questions outside my uploaded documents?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  No. The prompt engineering is strictly grounded using untrusted context delimiters. If your uploaded papers do not contain sufficient evidence to answer your inquiry, the model explicitly flags that evidence is insufficient rather than inventing answers.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-brand-600" />
                  Why does the server sometimes take ~50 seconds on the first request?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The backend API is deployed on Render's free tier, which spins down idle instances after 15 minutes of inactivity. The first incoming request wakes up the container, taking roughly 50 seconds. Once awake, requests execute with normal responsiveness.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-brand-600" />
                  What should I do if I see "Waiting for Gemini rate limit"?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You do not need to refresh or cancel your upload. The global throttle queue automatically calculates the required backoff delay from the API server, pauses requests smoothly, and resumes as soon as the quota window reopens.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-brand-600" />
                  Can other users see or search through my uploaded research papers?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  No. All documents, vector embeddings, chunks, chat histories, and cached insights are strictly tagged and filtered by your authenticated user ID. Multi-user security prevents cross-account data leakage.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-brand-600" />
                  How does citation verification determine if a claim is Verified?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  It applies our 4-part hybrid score combining exact n-gram containment (35%), span TF-IDF similarity (35%), number/metric alignment (15%), and dense vector cosine similarity (15%). A score of 70% or higher earns the green Verified checkmark.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-brand-600" />
                  Can I ask questions in another language even if my papers are in English?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Yes. Using cross-lingual retrieval, the system translates your non-English inquiry to English for vector similarity search, extracts relevant passages, and synthesizes the cited answer in your selected language.
                </p>
              </div>
            </div>
          </section>

          {/* Bottom Callout */}
          <div className="p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-base sm:text-lg font-bold">Ready to start researching?</h3>
              <p className="text-xs text-slate-300 max-w-xl">
                Switch to the Research Workspace to upload documents, ask grounded questions, or generate multi-paper comparison matrices.
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
                <span>Open Workspace</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
