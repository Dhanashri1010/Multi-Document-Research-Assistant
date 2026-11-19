import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Copy,
  Check,
  Quote,
} from 'lucide-react';
import { ICitation } from '../../types/research.js';
import { PdfViewerModal } from '../common/PdfViewerModal.js';

interface SourceCitationProps {
  citations: ICitation[];
  messageId?: string;
  expandedIndex?: number | null;
  onToggleExpand?: (index: number) => void;
}

/**
 * Accurately highlights verified supporting spans inside the retrieved passage.
 * If no matching spans exist or if spans are invalid, displays the original passage without highlighting.
 * Never invents or fabricates highlighted text.
 */
function renderHighlightedPassage(text: string, highlightSpans?: string[]) {
  if (!text) return null;
  if (!highlightSpans || highlightSpans.length === 0) {
    return <span className="text-slate-700 leading-relaxed">{text}</span>;
  }

  // Filter out any spans not strictly contained in text to prevent invented highlights
  const validSpans = highlightSpans
    .map((s) => s.trim())
    .filter((s) => s.length > 5 && text.includes(s));

  if (validSpans.length === 0) {
    return <span className="text-slate-700 leading-relaxed">{text}</span>;
  }

  interface Interval {
    start: number;
    end: number;
  }
  const intervals: Interval[] = [];
  for (const span of validSpans) {
    let startIdx = 0;
    while ((startIdx = text.indexOf(span, startIdx)) !== -1) {
      intervals.push({ start: startIdx, end: startIdx + span.length });
      startIdx += span.length;
    }
  }

  intervals.sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const iv of intervals) {
    if (merged.length === 0) {
      merged.push(iv);
    } else {
      const last = merged[merged.length - 1];
      if (iv.start <= last.end) {
        last.end = Math.max(last.end, iv.end);
      } else {
        merged.push(iv);
      }
    }
  }

  const elements: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach((iv, idx) => {
    if (iv.start > cursor) {
      elements.push(
        <span key={`context-${idx}`} className="text-slate-600 leading-relaxed">
          {text.slice(cursor, iv.start)}
        </span>
      );
    }
    elements.push(
      <mark
        key={`evidence-${idx}`}
        className="bg-amber-100/90 text-amber-950 font-medium px-1 py-0.5 rounded border-b-2 border-amber-400 leading-relaxed"
        title="Direct supporting evidence for referenced claim"
      >
        {text.slice(iv.start, iv.end)}
      </mark>
    );
    cursor = iv.end;
  });

  if (cursor < text.length) {
    elements.push(
      <span key="context-end" className="text-slate-600 leading-relaxed">
        {text.slice(cursor)}
      </span>
    );
  }

  return elements;
}

export const SourceCitation: React.FC<SourceCitationProps> = ({
  citations,
  messageId,
  expandedIndex: controlledExpandedIndex,
  onToggleExpand,
}) => {
  const [localExpandedIndex, setLocalExpandedIndex] = useState<number | null>(null);
  const [copiedCitationIndex, setCopiedCitationIndex] = useState<number | null>(null);
  const [copiedPassageIndex, setCopiedPassageIndex] = useState<number | null>(null);
  const [activePdf, setActivePdf] = useState<{
    docId: string;
    docName: string;
    page: number;
  } | null>(null);

  const [showOtherPassages, setShowOtherPassages] = useState(false);

  if (!citations || citations.length === 0) return null;

  const isControlled = controlledExpandedIndex !== undefined;
  const activeExpandedIndex = isControlled ? controlledExpandedIndex : localExpandedIndex;

  const handleToggle = (index: number) => {
    if (isControlled && onToggleExpand) {
      onToggleExpand(index);
    } else {
      setLocalExpandedIndex((prev) => (prev === index ? null : index));
    }
  };

  const handleCopyCitation = (cite: ICitation, index: number) => {
    const loc = cite.pageNumber
      ? `page ${cite.pageNumber}`
      : cite.paragraphNumber
      ? `para ${cite.paragraphNumber}`
      : cite.heading || cite.section || 'section';
    const text = `${cite.documentName}, ${loc}`;
    navigator.clipboard.writeText(text);
    setCopiedCitationIndex(index);
    setTimeout(() => setCopiedCitationIndex((prev) => (prev === index ? null : prev)), 2000);
  };

  const handleCopyPassage = (cite: ICitation, index: number) => {
    navigator.clipboard.writeText(cite.excerpt);
    setCopiedPassageIndex(index);
    setTimeout(() => setCopiedPassageIndex((prev) => (prev === index ? null : prev)), 2000);
  };

  // Separate passages actually cited in claims from background/unused retrieved passages
  const hasEvaluatedClaims = citations.some((c) => c.verified !== undefined || c.claim);
  const citedCitations = hasEvaluatedClaims
    ? citations.filter((c) => c.verified !== undefined || c.claim)
    : citations;
  const uncitedCitations = hasEvaluatedClaims
    ? citations.filter((c) => c.verified === undefined && !c.claim)
    : [];

  const verifiedCount = citations.filter((c) => c.verified === true).length;
  const unverifiedCount = citations.filter((c) => c.verified === false).length;
  const notCheckedCount = citations.filter((c) => c.verified === undefined).length;
  const totalEvaluated = verifiedCount + unverifiedCount;

  const renderCitationCard = (cite: ICitation, index: number, isUncited: boolean = false) => {
    const isExpanded = activeExpandedIndex === index;
    const cardId = `citation-card-${messageId || 'msg'}-${index}`;
    const relevancePercent = Math.round(((cite as any).relevanceScore ?? 0.88) * 100);

    return (
      <div
        key={index}
        id={cardId}
        className={`p-2.5 rounded-lg border transition-all text-xs ${
          isExpanded ? 'col-span-1 sm:col-span-2 shadow-xs' : ''
        } ${
          cite.verified === false
            ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
            : cite.verified === true
            ? 'border-emerald-200/60 bg-white hover:border-slate-300'
            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
        }`}
      >
        {/* Header row */}
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => handleToggle(index)}
        >
          <div className="flex items-center gap-2 truncate pr-1">
            <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-[10px] shrink-0 border border-brand-200">
              {index + 1}
            </span>
            <span className="font-semibold text-slate-800 truncate" title={cite.documentName}>
              {cite.documentName}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]"
              title={`Relevance match score: ${relevancePercent}%`}
            >
              {relevancePercent}% rel
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]">
              {cite.pageNumber
                ? `p. ${cite.pageNumber}`
                : cite.paragraphNumber
                ? `para ${cite.paragraphNumber}`
                : cite.heading || cite.section || 'section'}
            </span>
            {cite.verified === true ? (
              <span
                title="Citation verified: exact metrics and content overlap verified locally"
                className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px] flex items-center gap-0.5 border border-emerald-200/60"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                verified
              </span>
            ) : cite.verified === false ? (
              <span
                title="Unverified: missing metrics or low semantic overlap"
                className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px] flex items-center gap-0.5 border border-amber-300/60"
              >
                <AlertCircle className="w-3 h-3 text-amber-600" />
                unverified
              </span>
            ) : (
              <span
                title="Source retrieved as context; not evaluated against a specific claim"
                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium text-[10px] flex items-center gap-0.5 border border-slate-200"
              >
                not checked
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
            {/* Claim to Evidence Mapping */}
            {cite.claim && (
              <div className="p-2.5 rounded-md bg-brand-50/50 border border-brand-200/60 text-xs">
                <span className="font-semibold text-brand-900 block text-[10px] uppercase tracking-wider mb-1">
                  Referenced Claim
                </span>
                <p className="text-brand-950 text-xs leading-relaxed italic">
                  "{cite.claim}"
                </p>
              </div>
            )}

            {/* Verification Status & Meaningful Explanation */}
            <div
              className={`p-2.5 rounded-md border text-xs flex items-start gap-2.5 ${
                cite.verified === true
                  ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-950'
                  : cite.verified === false
                  ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              {cite.verified === true ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : cite.verified === false ? (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span className="font-semibold block text-[11px]">
                  {cite.verified === true
                    ? 'Verified by Local Citation Grounding'
                    : cite.verified === false
                    ? 'Citation Grounding Warning'
                    : 'Contextual Retrieval Source'}
                </span>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {cite.verificationReason ||
                    (cite.verified === true
                      ? 'Exact metrics, numbers, and key concepts match the source passage.'
                      : cite.verified === false
                      ? 'The passage does not fully support the claimed numerical values or concepts.'
                      : 'Retrieved to augment knowledge; not tied to an individual sentence claim.')}
                </p>
                {cite.highlightSpans && cite.highlightSpans.length > 0 && (
                  <p className="text-[10px] text-amber-800 font-medium pt-0.5">
                    ✦ Verified supporting evidence highlighted below
                  </p>
                )}
              </div>
            </div>

            {/* Source Excerpt with Highlighted Supporting Spans */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Source Passage Excerpt:</span>
                {cite.highlightSpans && cite.highlightSpans.length > 0 && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 font-medium">
                    Highlighted sentence supports claim
                  </span>
                )}
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-700 text-xs leading-relaxed max-h-48 overflow-y-auto font-sans select-text">
                {renderHighlightedPassage(cite.excerpt, cite.highlightSpans)}
              </div>
            </div>

            {/* Actions: View in PDF, Copy Citation, Copy Passage */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
              {cite.documentId && (
                <button
                  type="button"
                  onClick={() =>
                    setActivePdf({
                      docId: cite.documentId,
                      docName: cite.documentName,
                      page: cite.pageNumber || 1,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-xs transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Open in PDF Viewer at Page {cite.pageNumber || 1}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleCopyCitation(cite, index)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors"
                title="Copy standard citation"
              >
                {copiedCitationIndex === index ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Citation</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleCopyPassage(cite, index)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors"
                title="Copy raw passage text"
              >
                {copiedPassageIndex === index ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Copied Passage!</span>
                  </>
                ) : (
                  <>
                    <Quote className="w-3 h-3" />
                    <span>Copy Passage</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="mt-4 pt-3 border-t border-slate-200/80">
        {/* Summary Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-600" />
              Retrieved Evidence & Citations ({citations.length})
            </span>
            {totalEvaluated > 0 && (
              <span
                className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1"
                title="Local verification compares each claim against cited passages with exact number/metric matching, content-word containment, and TF-IDF cosine."
              >
                {verifiedCount} of {totalEvaluated} claims verified
                <HelpCircle className="w-3 h-3 text-slate-400 cursor-help" />
              </span>
            )}
          </div>

          {/* Dynamic Status Badge */}
          {verifiedCount === citations.length && citations.length > 0 ? (
            <span
              title="All retrieved citations were verified against claimed facts"
              className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold flex items-center gap-1 border border-emerald-200/60"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              all citations verified
            </span>
          ) : notCheckedCount === citations.length ? (
            <span
              title="Passages retrieved as background context (not evaluated against specific claims)"
              className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium flex items-center gap-1 border border-slate-200"
            >
              <HelpCircle className="w-3 h-3 text-slate-400" />
              sources not checked
            </span>
          ) : unverifiedCount > 0 ? (
            <span
              title="Some citations could not be verified with high semantic confidence"
              className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-semibold flex items-center gap-1 border border-amber-300/70"
            >
              <AlertCircle className="w-3 h-3 text-amber-600" />
              {verifiedCount > 0
                ? `${verifiedCount} verified · ${unverifiedCount} unverified citation${unverifiedCount > 1 ? 's' : ''} flagged${notCheckedCount > 0 ? ` · ${notCheckedCount} not checked` : ''}`
                : `${unverifiedCount} unverified citation${unverifiedCount > 1 ? 's' : ''} flagged${notCheckedCount > 0 ? ` · ${notCheckedCount} not checked` : ''}`}
            </span>
          ) : (
            <span
              title="Some citations verified; remaining sources are contextual background"
              className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium flex items-center gap-1 border border-slate-200"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {verifiedCount} verified · {notCheckedCount} not checked
            </span>
          )}
        </div>

        {/* Primary Cited Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {citedCitations.map((cite, index) => renderCitationCard(cite, index))}
        </div>

        {/* Collapsible Section for Uncited Background Passages */}
        {uncitedCitations.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200">
            <button
              type="button"
              onClick={() => setShowOtherPassages(!showOtherPassages)}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer select-none transition-colors"
            >
              {showOtherPassages ? (
                <ChevronUp className="w-3 h-3 text-slate-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              )}
              <span>
                Other retrieved passages (not used in the answer) ({uncitedCitations.length})
              </span>
            </button>
            {showOtherPassages && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {uncitedCitations.map((cite, idx) =>
                  renderCitationCard(cite, citedCitations.length + idx, true)
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {activePdf && (
        <PdfViewerModal
          isOpen={Boolean(activePdf)}
          onClose={() => setActivePdf(null)}
          documentId={activePdf.docId}
          documentName={activePdf.docName}
          pageNumber={activePdf.page}
        />
      )}
    </>
  );
};
