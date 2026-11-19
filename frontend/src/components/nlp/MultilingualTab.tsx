import React, { useState } from 'react';
import { Globe, Languages, Send, Sparkles, Check, Copy, Loader2, ArrowRight, BookOpen } from 'lucide-react';
import { NlpService, LanguageDetectionResult, TranslationResult, CrossLingualAnswerResult } from '../../services/nlpService.js';
import { IDocument } from '../../types/document.js';

interface MultilingualTabProps {
  documents: IDocument[];
}

const SAMPLE_TEXTS = [
  {
    lang: 'Marathi',
    code: 'mr',
    sample: 'माहिती तंत्रज्ञान आणि कृत्रिम बुद्धिमत्ता क्षेत्रातील संशोधन खूप वेगाने प्रगती करत आहे.',
  },
  {
    lang: 'Hindi',
    code: 'hi',
    sample: 'सूचना प्रौद्योगिकी और कृत्रिम बुद्धिमत्ता के क्षेत्र में अनुसंधान बहुत तेजी से प्रगति कर रहा है।',
  },
  {
    lang: 'Spanish',
    code: 'es',
    sample: 'El procesamiento del lenguaje natural permite a las computadoras comprender el texto humano.',
  },
  {
    lang: 'French',
    code: 'fr',
    sample: 'Le traitement automatique du langage naturel permet aux ordinateurs de comprendre les documents.',
  },
  {
    lang: 'German',
    code: 'de',
    sample: 'Die Verarbeitung natürlicher Sprache ermöglicht es Computern, menschliche Sprache zu verstehen.',
  },
];

export const MultilingualTab: React.FC<MultilingualTabProps> = ({ documents }) => {
  // 1. Language Detection State
  const [detectInput, setDetectInput] = useState(SAMPLE_TEXTS[0].sample);
  const [detectResult, setDetectResult] = useState<LanguageDetectionResult | null>(null);
  const [detecting, setDetecting] = useState(false);

  // 2. Translation State
  const [translateInput, setTranslateInput] = useState('This research presents a novel retrieval-augmented generation framework.');
  const [targetLang, setTargetLang] = useState('mr'); // Default to Marathi
  const [provider, setProvider] = useState<'auto' | 'google_cloud' | 'gemini' | 'local'>('auto');
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [translating, setTranslating] = useState(false);
  const [copied, setCopied] = useState(false);

  // 3. Cross-Lingual QA State
  const [crossLingualQuestion, setCrossLingualQuestion] = useState('पुनर्प्राप्ती संवर्धित निर्मिती (RAG) कार्यपद्धती कशी कार्य करते?');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [crossLingualResult, setCrossLingualResult] = useState<CrossLingualAnswerResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  const readyDocs = documents.filter((d) => d.status === 'ready');

  // Trigger language detection
  const handleDetect = async (textToDetect = detectInput) => {
    if (!textToDetect.trim()) return;
    setDetecting(true);
    try {
      const res = await NlpService.detectLanguage(textToDetect);
      setDetectResult(res);
    } catch {
      // fallback
    } finally {
      setDetecting(false);
    }
  };

  // Trigger translation
  const handleTranslate = async () => {
    if (!translateInput.trim()) return;
    setTranslating(true);
    try {
      const res = await NlpService.translateText({
        text: translateInput,
        targetLanguage: targetLang,
        provider,
      });
      setTranslationResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setTranslating(false);
    }
  };

  // Trigger cross-lingual QA
  const handleAskCrossLingual = async () => {
    if (!crossLingualQuestion.trim()) return;
    setAsking(true);
    setQaError(null);
    try {
      const res = await NlpService.askCrossLingual({
        question: crossLingualQuestion,
        documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
      });
      setCrossLingualResult(res);
    } catch (err: any) {
      setQaError(err?.response?.data?.error || err?.message || 'Cross-lingual QA failed.');
    } finally {
      setAsking(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Overview Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-5 h-5 text-brand-600" />
          <h3 className="text-base font-bold text-slate-800">
            Multilingual NLP & Cross-Lingual Synthesis (CO3)
          </h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Cloud + Local Services
          </span>
        </div>
        <p className="text-xs text-slate-500 max-w-3xl">
          Demonstrates franc n-gram language detection (distinguishing Indic languages like Marathi and Hindi), multi-cloud REST translation (Google Cloud Translation API with Gemini fallback), and grounded cross-lingual inquiry on English research documents.
        </p>
      </div>

      {/* Grid: Part 1 Language Detection & Part 2 Cloud Translation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Language Detection */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Languages className="w-4 h-4 text-brand-600" />
                <span>1. Language Identification (franc)</span>
              </h4>
              <span className="text-[11px] font-semibold text-slate-500">ISO 639-3 / 639-1</span>
            </div>

            {/* Quick Sample Buttons */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {SAMPLE_TEXTS.map((st) => (
                <button
                  key={st.lang}
                  type="button"
                  onClick={() => {
                    setDetectInput(st.sample);
                    handleDetect(st.sample);
                  }}
                  className="text-[11px] px-2 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium transition-colors cursor-pointer"
                >
                  {st.lang}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={detectInput}
              onChange={(e) => setDetectInput(e.target.value)}
              placeholder="Paste text in Marathi, Hindi, Spanish, French, German, or English..."
              className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 resize-none"
            />
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => handleDetect()}
              disabled={detecting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
            >
              {detecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Identify Language</span>
            </button>

            {detectResult && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 px-2.5 py-1 rounded-lg bg-brand-50 border border-brand-200 text-brand-700">
                  {detectResult.name} ({detectResult.code})
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {(detectResult.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Multi-Provider Cloud Translation */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Globe className="w-4 h-4 text-brand-600" />
                <span>2. Multi-Provider Translation</span>
              </h4>
              <div className="flex items-center gap-2">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="text-xs py-1 px-2 rounded-md border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="mr">Marathi (मराठी)</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="es">Spanish (Español)</option>
                  <option value="fr">French (Français)</option>
                  <option value="de">German (Deutsch)</option>
                  <option value="en">English</option>
                </select>

                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as any)}
                  className="text-xs py-1 px-2 rounded-md border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="auto">Auto (Google Cloud + Fallback)</option>
                  <option value="google_cloud">Google Cloud Translation REST</option>
                  <option value="gemini">Gemini Flash Lite</option>
                  <option value="local">Local Lexicon</option>
                </select>
              </div>
            </div>

            <textarea
              rows={3}
              value={translateInput}
              onChange={(e) => setTranslateInput(e.target.value)}
              placeholder="Enter text to translate..."
              className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 resize-none"
            />
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleTranslate}
              disabled={translating}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
            >
              {translating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Translate Text</span>
            </button>

            {translationResult && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                  {translationResult.provider === 'google_cloud'
                    ? 'Google Cloud REST'
                    : translationResult.provider === 'gemini'
                    ? 'Gemini 3.1 Flash Lite'
                    : 'Local Fallback'}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {translationResult.latencyMs}ms
                </span>
              </div>
            )}
          </div>

          {translationResult && (
            <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 relative group">
              <div className="font-semibold text-slate-900 pr-6">
                {translationResult.translatedText}
              </div>
              <button
                onClick={() => handleCopy(translationResult.translatedText)}
                className="absolute top-2.5 right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                title="Copy translation"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Cross-Lingual Grounded Research QA */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-brand-600" />
              <span>3. Cross-Lingual Grounded Research QA</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Ask in non-English (Marathi, Hindi, etc.) about English research papers. Retrieves English evidence passages, then formulates the answer in your inquiry language with page citations.
            </p>
          </div>
        </div>

        {/* Question Input & Document Scope */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center text-xs text-slate-600">
            <span className="font-bold">Suggested questions:</span>
            <button
              type="button"
              onClick={() => setCrossLingualQuestion('पुनर्प्राप्ती संवर्धित निर्मिती (RAG) कार्यपद्धती कशी कार्य करते?')}
              className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              Marathi: RAG कार्यपद्धती?
            </button>
            <button
              type="button"
              onClick={() => setCrossLingualQuestion('पुनर्प्राप्ति संवर्धित उत्पादन (RAG) प्रणाली के मुख्य लाभ क्या हैं?')}
              className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              Hindi: RAG के लाभ?
            </button>
            <button
              type="button"
              onClick={() => setCrossLingualQuestion('¿Cuáles son las principales conclusiones de este artículo?')}
              className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              Spanish: Conclusiones?
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={crossLingualQuestion}
              onChange={(e) => setCrossLingualQuestion(e.target.value)}
              placeholder="Ask a question in any language (e.g. Marathi or Hindi)..."
              className="flex-1 text-xs px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800"
            />
            <button
              onClick={handleAskCrossLingual}
              disabled={asking}
              className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
            >
              {asking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Ask in Language</span>
            </button>
          </div>
        </div>

        {qaError && (
          <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {qaError}
          </div>
        )}

        {/* Results: Side-by-side Evidence & Answer */}
        {crossLingualResult && (
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Retrieved English Passages (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Retrieved English Context ({crossLingualResult.retrievedPassages.length} Chunks)
                </span>
                {crossLingualResult.translatedQuestionToEnglish && (
                  <span className="text-[11px] text-slate-500 italic">
                    Query translated to EN for retrieval
                  </span>
                )}
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {crossLingualResult.retrievedPassages.map((chunk, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-brand-700">
                      <span>Source {idx + 1} · {chunk.documentTitle}</span>
                      <span className="font-mono text-slate-400">Page {chunk.pageNumber || 1}</span>
                    </div>
                    <p className="text-slate-600 line-clamp-3 italic">
                      "{chunk.text}"
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Grounded Answer in Target Language (7 cols) */}
            <div className="lg:col-span-7 bg-brand-50/50 rounded-xl border border-brand-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-600" />
                  <span className="text-xs font-bold text-brand-900">
                    Grounded Answer in {crossLingualResult.detectedQuestionLanguage.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white border border-brand-200 text-brand-700">
                    {crossLingualResult.provider}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {crossLingualResult.latencyMs}ms
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line bg-white p-4 rounded-lg border border-brand-100 shadow-3xs">
                {crossLingualResult.answer}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

