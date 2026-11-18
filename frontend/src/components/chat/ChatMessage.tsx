import React, { useState } from 'react';
import { User, Sparkles, AlertCircle, Download, RotateCcw } from 'lucide-react';
import { IChatMessage } from '../../types/research.js';
import { SourceCitation } from './SourceCitation.js';

export function sanitizeDegradedReason(reason?: string): string {
  if (!reason) {
    return 'Displaying the most relevant passages retrieved directly from your documents.';
  }
  if (
    /json|syntaxerror|position \d+|unterminated|unexpected token|failed to parse|econnrefused|at line \d+/i.test(
      reason
    )
  ) {
    return 'The AI model response was interrupted during generation. Document excerpts and verified passages have been retrieved directly from your indexed papers.';
  }
  return reason;
}

interface ChatMessageProps {
  message: IChatMessage;
  onRetry?: () => void;
}

/**
 * Resiliently cleans and extracts human-readable text from raw messages,
 * ensuring internal JSON fields (hasInsufficientEvidence, claims, sourceIndices)
 * are NEVER displayed to the user or exported to Markdown.
 */
export function cleanUserFacingText(content: string): string {
  if (!content) return '';
  const trimmed = content.trim();

  // If content is wrapped in markdown code blocks or raw JSON object
  if (
    (trimmed.startsWith('{') && (trimmed.endsWith('}') || trimmed.includes('"answer"'))) ||
    trimmed.startsWith('```json') ||
    trimmed.startsWith('```')
  ) {
    try {
      const unquoted = trimmed
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      const parsed = JSON.parse(unquoted);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.answer === 'string' && parsed.answer.trim().length > 0) {
          return cleanUserFacingText(parsed.answer);
        }
        if (parsed.hasInsufficientEvidence && parsed.insufficientReason) {
          return parsed.insufficientReason;
        }
      }
    } catch {
      // Resilient regex extraction for answer field if JSON.parse failed
      const answerMatch = trimmed.match(
        /"answer"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"(?:claims|hasInsufficientEvidence|insufficientReason)"|\s*\})/i
      );
      if (answerMatch && answerMatch[1]) {
        const extracted = answerMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\t/g, '\t');
        return cleanUserFacingText(extracted);
      }
    }
  }

  // Strip any accidental envelope strings
  let cleaned = content
    .replace(/^\{[\s\S]*?"answer"\s*:\s*"/i, '')
    .replace(/"\s*,\s*"(?:claims|hasInsufficientEvidence|insufficientReason)"[\s\S]*$/i, '')
    .trim();

  // Strip duplicate trailing reference lists (since the UI already renders citation cards below)
  cleaned = cleaned
    .replace(
      /\n{2,}(?:#{1,4}\s*(?:References|Citations|Sources|Works Cited)|(?:\*{2}|_{2})(?:References|Citations|Sources):?(?:\*{2}|_{2}))[\s\S]*$/i,
      ''
    )
    .trim();

  return cleaned;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRetry }) => {
  const isUser = message.role === 'user';
  const displayContent = cleanUserFacingText(message.content);
  const [expandedCitationIndex, setExpandedCitationIndex] = useState<number | null>(null);
  const messageId = message._id || (message as any).id || 'msg';

  const handleCitationClick = (idx: number) => {
    setExpandedCitationIndex(idx);
    const cardId = `citation-card-${messageId}-${idx}`;
    setTimeout(() => {
      const el = document.getElementById(cardId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  };

  const exportMarkdown = () => {
    let md = `# Multi-Document Research Answer\n\n`;
    md += `**Date**: ${new Date(message.createdAt).toLocaleString()}\n\n`;
    if (message.degraded) {
      md += `> **Notice**: AI-generated summary temporarily unavailable (${message.degradedReason || 'Direct document excerpts'})\n\n`;
    }
    if (message.hasInsufficientEvidence) {
      md += `> **Notice**: Flagged as having insufficient document evidence.\n\n`;
    }
    md += `## Answer\n\n${displayContent}\n\n`;
    if (message.citations && message.citations.length > 0) {
      md += `## Retrieved Evidence & Citations\n\n`;
      message.citations.forEach((c, idx) => {
        const loc = c.pageNumber ? `Page ${c.pageNumber}` : `Section: ${c.heading || c.section || 'Body'}`;
        md += `${idx + 1}. **${c.documentName}** (${loc}) ${c.verified !== false ? '*(Verified)*' : '*(Unverified)*'}\n`;
        md += `   > "${c.excerpt}"\n\n`;
      });
    }
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research_answer_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderBoldAndCitations = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('[') && part.endsWith(']')) {
        const rawInner = part.slice(1, -1).trim();
        // Determine target citation index if possible
        let targetIdx: number | null = null;
        if (/^\d+$/.test(rawInner)) {
          const num = parseInt(rawInner, 10);
          if (message.citations && num >= 1 && num <= message.citations.length) {
            targetIdx = num - 1;
          }
        } else if (message.citations && message.citations.length > 0) {
          // Check if it mentions filename or page
          const matchIdx = message.citations.findIndex((c) => {
            const cleanDoc = c.documentName
              ? c.documentName.toLowerCase().replace(/\.(?:pdf|docx|doc)$/i, '')
              : '';
            const docMatch = cleanDoc && rawInner.toLowerCase().includes(cleanDoc);
            const pageMatch =
              c.pageNumber &&
              (rawInner.includes(`p. ${c.pageNumber}`) ||
                rawInner.includes(`page ${c.pageNumber}`) ||
                rawInner.includes(`p.${c.pageNumber}`));
            return Boolean(docMatch || pageMatch);
          });
          if (matchIdx !== -1) {
            targetIdx = matchIdx;
          }
        }

        if (targetIdx !== null) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleCitationClick(targetIdx!)}
              className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 hover:text-brand-800 font-semibold text-xs border border-brand-200 hover:border-brand-300 transition-colors cursor-pointer select-none"
              title={`Click to view verified evidence citation #${targetIdx + 1}`}
            >
              {part}
            </button>
          );
        }

        return (
          <span
            key={i}
            className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-brand-50 text-brand-700 font-semibold text-xs border border-brand-200 select-all"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Advanced formatted content renderer supporting Markdown tables, blockquotes, lists, and headers
  const renderFormattedContent = (content: string) => {
    const rawLines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < rawLines.length) {
      const line = rawLines[i];
      const trimmed = line.trim();

      // Check if this line begins a Markdown table (| col1 | col2 |)
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
        const tableLines: string[] = [];
        while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
          tableLines.push(rawLines[i].trim());
          i++;
        }

        // Parse table rows
        if (tableLines.length >= 2) {
          const parseRow = (rowStr: string) =>
            rowStr
              .split('|')
              .map((c) => c.trim())
              .slice(1, -1);

          const headers = parseRow(tableLines[0]);
          const separator = parseRow(tableLines[1]);
          const isSeparatorValid = separator.every((cell) => /^:?-+:?$/.test(cell));

          const bodyRows = (isSeparatorValid ? tableLines.slice(2) : tableLines.slice(1)).map(parseRow);

          elements.push(
            <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-800 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="py-2.5 px-3">
                        {renderBoldAndCitations(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {bodyRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/60 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="py-2 px-3 align-top leading-relaxed">
                          {renderBoldAndCitations(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Empty line
      if (!trimmed) {
        elements.push(<div key={`empty-${i}`} className="h-2" />);
        i++;
        continue;
      }

      // Blockquotes
      if (trimmed.startsWith('> ')) {
        const text = trimmed.replace(/^>\s*/, '');
        elements.push(
          <blockquote key={`quote-${i}`} className="border-l-4 border-brand-400 bg-brand-50/40 pl-3 py-1.5 my-2 text-xs italic text-slate-700 rounded-r">
            {renderBoldAndCitations(text)}
          </blockquote>
        );
        i++;
        continue;
      }

      // Headers (### or ##)
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={`h4-${i}`} className="text-sm font-bold text-slate-900 mt-4 mb-1">
            {renderBoldAndCitations(trimmed.replace('### ', ''))}
          </h4>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3 key={`h3-${i}`} className="text-base font-bold text-slate-900 mt-5 mb-2">
            {renderBoldAndCitations(trimmed.replace('## ', ''))}
          </h3>
        );
        i++;
        continue;
      }

      // Bullet items
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const text = trimmed.replace(/^[-*]\s+/, '');
        elements.push(
          <li key={`bullet-${i}`} className="text-slate-700 ml-4 list-disc text-sm leading-relaxed my-1">
            {renderBoldAndCitations(text)}
          </li>
        );
        i++;
        continue;
      }

      // Numbered list
      if (/^\d+\.\s+/.test(trimmed)) {
        const text = trimmed.replace(/^\d+\.\s+/, '');
        elements.push(
          <li key={`num-${i}`} className="text-slate-700 ml-4 list-decimal text-sm leading-relaxed my-1">
            {renderBoldAndCitations(text)}
          </li>
        );
        i++;
        continue;
      }

      // Standard paragraph
      elements.push(
        <p key={`p-${i}`} className="text-slate-700 text-sm leading-relaxed my-1.5">
          {renderBoldAndCitations(trimmed)}
        </p>
      );
      i++;
    }

    return elements;
  };

  return (
    <div className={`flex gap-3.5 p-4 rounded-xl ${isUser ? 'bg-slate-100/80 ml-8' : 'bg-white border border-slate-200 shadow-2xs mr-4'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isUser
            ? 'bg-slate-800 text-white'
            : 'bg-brand-600 text-white shadow-sm shadow-brand-500/20'
          }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">
              {isUser ? 'You' : 'Research Assistant'}
            </span>
            <span className="text-[11px] text-slate-400">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {!isUser && (
            <button
              type="button"
              onClick={exportMarkdown}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-600 hover:text-brand-600 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
              title="Export response to Markdown (.md)"
            >
              <Download className="w-3 h-3" />
              <span>Export .md</span>
            </button>
          )}
        </div>

        {/* Insufficient Evidence Notice */}
        {message.hasInsufficientEvidence && (
          <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Not Enough Information Found</p>
              <p className="mt-0.5 text-amber-700">
                The selected documents do not contain enough information to answer this question. Try selecting more documents or rephrasing your question.
              </p>
            </div>
          </div>
        )}

        {/* Degraded Mode Notice */}
        {message.degraded && (
          <div className="mb-3 p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">AI-generated summary is temporarily unavailable.</p>
                <p className="mt-0.5 text-amber-700">
                  {sanitizeDegradedReason(message.degradedReason)}
                </p>
              </div>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold text-xs transition-colors shrink-0 border border-amber-300 shadow-2xs"
                title="Retry asking question"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        {/* Message body */}
        <div className="space-y-1">{renderFormattedContent(displayContent)}</div>

        {/* Citations Card */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <SourceCitation
            citations={message.citations}
            messageId={messageId}
            expandedIndex={expandedCitationIndex}
            onToggleExpand={(idx) =>
              setExpandedCitationIndex((prev) => (prev === idx ? null : idx))
            }
          />
        )}
      </div>
    </div>
  );
};
