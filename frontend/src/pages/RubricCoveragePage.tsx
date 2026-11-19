import React from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  Layers,
  Smile,
  Network,
  Globe,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Code2,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

export const RubricCoveragePage: React.FC = () => {
  const rubricItems = [
    {
      co: 'CO1',
      marks: '7 Marks',
      title: 'Text Extraction, Preprocessing, Cleaning and Vectorization of Unstructured Data',
      status: 'Fully Implemented & Verified',
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description:
        'End-to-end unstructured document extraction (PDF, DOCX, TXT) with scanned document detection, an 8-step selectable preprocessing pipeline, and bag-of-words / TF-IDF vectorization with pairwise cosine similarity matrices.',
      features: [
        'Multi-format text extraction: PDF (pdf-parse), Word DOCX (mammoth/adm-zip), plain TXT with low-density scanned PDF detection (<20 chars/page warning).',
        '8-Step Selectable Preprocessing: Unicode normalization (NFKC), lowercase, regex noise removal, header/footer stripping, hyphenation repair, tokenization, stopword removal, and Porter Stemmer.',
        'Preprocessing Telemetry: Real-time before/after metrics showing character, word, sentence, token, and vocabulary reduction percentage.',
        'Vectorization: Term Frequency (TF), Inverse Document Frequency (IDF), Top-K TF-IDF keywords per document, and pairwise TF-IDF cosine similarity matrix.',
      ],
      backendFiles: [
        'backend/src/services/documents/extractor.ts',
        'backend/src/services/nlp/nlpPreprocessingService.ts',
        'backend/src/services/nlp/nlpVectorizationService.ts',
        'backend/src/controllers/nlpController.ts',
      ],
      uiLocation: 'NLP Lab → Tab 1: CO1: Preprocessing & Vectorization',
      testSuite: 'backend/src/tests/nlp_stage1.test.ts',
      navLink: '/nlp-lab',
    },
    {
      co: 'CO2',
      marks: '8 Marks',
      title: 'Implementation AND Evaluation of Sentiment Analysis and Information Extraction',
      status: 'Fully Implemented & Verified',
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description:
        'Dual-method sentiment analysis (AFINN Lexicon vs Gemini LLM) and information extraction (Rule-based Regex/RAKE vs Gemini Few-Shot NER) with empirical benchmark evaluation on gold-standard datasets producing Accuracy, Precision, Recall, F1, and a 3x3 Confusion Matrix.',
      features: [
        'Dual-Method Sentiment Analysis: AFINN-165 rule-based lexicon vs Gemini 3.1 Flash Lite structured output, with sentence-level distribution and top cited quotes.',
        'Information Extraction: 7-entity scientific NER (METHOD, DATASET, METRIC, TASK, TOOL, RESEARCHER, HARDWARE), RAKE keyphrase extraction, and Zod schema structured paper extraction.',
        'Empirical Benchmark Evaluation: Run on curated gold datasets (eval/sentiment_gold.json with 52 items, eval/entities_gold.json with 21 items).',
        'Evaluation Metrics: Reports Accuracy, Macro Precision, Macro Recall, Macro F1, custom 3x3 Confusion Matrix (Positive, Neutral, Negative), and exact + partial match NER metrics.',
      ],
      backendFiles: [
        'backend/src/services/nlp/nlpSentimentService.ts',
        'backend/src/services/nlp/nlpExtractionService.ts',
        'backend/src/services/nlp/nlpEvaluationService.ts',
        'backend/eval/sentiment_gold.json',
        'backend/eval/entities_gold.json',
      ],
      uiLocation: 'NLP Lab → Tab 2: CO2: Sentiment & Extraction & Tab 6: Evaluation Benchmark',
      testSuite: 'backend/src/tests/nlp_stage1.test.ts',
      navLink: '/nlp-lab',
    },
    {
      co: 'CO3',
      marks: '7 Marks',
      title: 'Topic Modeling OR Multilingual NLP Using NLP Techniques & Cloud-Based AI Services',
      status: 'Fully Implemented & Verified (BOTH Built)',
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description:
        'Covers BOTH Topic Modeling and Multilingual NLP. Clusters existing document embeddings via K-Means with Silhouette auto-k and c-TF-IDF keywords, alongside franc language identification (Hindi vs Marathi), Google Cloud Translation API REST integration, and cross-lingual grounded QA.',
      features: [
        'K-Means Clustering on Embeddings: Clusters existing 768d vectors across 1 to N papers (k=2..6) without re-embedding.',
        'Silhouette Optimal k: Evaluates intra-cluster vs nearest-cluster distances across k ∈ [2,6] to select optimal cluster count automatically.',
        'c-TF-IDF Topic Keywords & Coherence: Computes class-based TF-IDF terms per cluster and intra-topic word co-occurrence coherence scores.',
        'Interactive 2D PCA Scatter: SVD covariance projection displaying interactive SVG coordinate scatter of chunks colored by topic.',
        'Language Identification (franc): Local n-gram language detection rigorously distinguishing Indic languages (Marathi vs Hindi), English, Spanish, and French.',
        'Multi-Cloud Translation: Google Cloud Translation REST API integration with Gemini Flash Lite fallback and local dictionary.',
        'Cross-Lingual Grounded QA: Allows asking in Marathi, Hindi, or Spanish about English documents; returns side-by-side English evidence chunks + translated answer with citations.',
      ],
      backendFiles: [
        'backend/src/services/nlp/nlpTopicService.ts',
        'backend/src/services/nlp/nlpMultilingualService.ts',
        'backend/src/tests/nlp_stage2_co3.test.ts',
      ],
      uiLocation: 'NLP Lab → Tab 3: CO3: Topic Modeling & Tab 4: CO3: Multilingual NLP',
      testSuite: 'backend/src/tests/nlp_stage2_co3.test.ts',
      navLink: '/nlp-lab',
    },
    {
      co: 'CO4',
      marks: '8 Marks',
      title: 'Generative AI / LLM Application, Prompt Engineering, Integration and Working Demonstration',
      status: 'Fully Implemented & Verified',
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description:
        'Versioned Prompt Engineering Library with 8 documented templates, interactive Prompt Playground comparing Zero-Shot vs Few-Shot vs Chain-of-Thought, and multi-document literature review synthesis contrasting findings across papers with page citations.',
      features: [
        'Versioned Prompt Engineering Library: 8 documented templates (rag_qa.v1, rag_qa.v2, document_summary.v2, comparison_matrix.v2, entity_extraction.v1, topic_naming.v1, cross_lingual_qa.v1, literature_review.v1) with written design rationales.',
        'Strategy Comparison: Interactive experimentation with Zero-Shot, Few-Shot, and Chain-of-Thought (CoT) prompting with adjustable temperature and token limits.',
        'Local Citation & Claim Verification: Local TF-IDF and strict entity/number checking computing Grounding Scores (>=0.7 Supported, 0.4-0.7 Partial, <0.4 Unverified) with single regeneration gate.',
        'Multi-Document Literature Review: Synthesizes 2 to 5 papers into 5 publication-grade sections (Background, Common Methods, Diverging Findings/Contradictions, Open Gaps, Future Hypotheses) with markdown download.',
      ],
      backendFiles: [
        'backend/src/prompts/index.ts (8 templates)',
        'backend/src/services/nlp/nlpLiteratureReviewService.ts',
        'backend/src/services/ai/citationVerifier.ts',
        'backend/src/tests/nlp_stage3_co4.test.ts',
      ],
      uiLocation: 'NLP Lab → Tab 5: CO4: Prompt Playground & Synthesis & Research Workspace',
      testSuite: 'backend/src/tests/nlp_stage3_co4.test.ts',
      navLink: '/nlp-lab',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                NLP Course Demonstration Rubric Coverage
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Comprehensive compliance matrix mapping all 4 Course Outcomes (CO1 to CO4) totaling 30 Marks.
              </p>
            </div>
          </div>
        </div>

        {/* Total Score Badge */}
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl shadow-2xs">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <div>
            <div className="text-xs font-semibold text-emerald-800">Total Rubric Score</div>
            <div className="text-lg font-bold text-emerald-900">30 / 30 Marks Covered</div>
          </div>
        </div>
      </div>

      {/* High-Level Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {rubricItems.map((item) => (
          <div key={item.co} className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800">{item.co}</span>
              <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">
                {item.marks}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium line-clamp-2">{item.title}</p>
            <div className="pt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{item.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Deep-Dive Compliance Sections */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-brand-600" />
          <span>Detailed Rubric Breakdown & Architectural Mapping</span>
        </h2>

        <div className="space-y-6">
          {rubricItems.map((item) => (
            <div
              key={item.co}
              className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4 transition-all hover:border-slate-300"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-base font-extrabold text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">
                    {item.co} ({item.marks})
                  </span>
                  <h3 className="text-base font-bold text-slate-800">{item.title}</h3>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${item.statusColor}`}>
                  {item.status}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>

              {/* Implemented Features List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">Demonstrated Functionality:</span>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
                  {item.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Source Files, UI Location & Link */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center text-xs">
                <div className="lg:col-span-8 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <Code2 className="w-3.5 h-3.5 text-brand-600" />
                    <span>Implementation Files:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 font-mono text-[11px] text-slate-500">
                    {item.backendFiles.map((file, fIdx) => (
                      <span key={fIdx} className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {file}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-4 flex justify-start lg:justify-end">
                  <Link
                    to={item.navLink}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors shadow-2xs"
                  >
                    <span>Inspect in NLP Lab</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
