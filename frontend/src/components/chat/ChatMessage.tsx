import React from 'react';
import { User, Sparkles, AlertCircle, Download } from 'lucide-react';
import { IChatMessage } from '../../types/research.js';
import { SourceCitation } from './SourceCitation.js';

interface ChatMessageProps {
  message: IChatMessage;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  const exportMarkdown = () => {
    let md = `# Multi-Document Research Answer\n\n`;
    md += `**Date**: ${new Date(message.createdAt).toLocaleString()}\n\n`;
    if (message.degraded) {
      md += `> **Notice**: Synthesized in degraded fallback mode (${message.degradedReason || 'Direct excerpt fallback'})\n\n`;
    }
    if (message.hasInsufficientEvidence) {
      md += `> **Notice**: Flagged as having insufficient evidence.\n\n`;
    }
    md += `## Answer\n\n${message.content}\n\n`;
    if (message.citations && message.citations.length > 0) {
      md += `## Retrieved Evidence & Citations\n\n`;
      message.citations.forEach((c, idx) => {
        md += `${idx + 1}. **${c.documentName}** (Page ${c.pageNumber}) ${c.verified !== false ? '*(Verified)*' : '*(Unverified)*'}\n`;
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

  // Basic formatted text renderer (paragraphs, bold, bullet points, headers)
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }
      // Header lines (### or ##)
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="text-sm font-bold text-slate-900 mt-3 mb-1">
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h3 key={idx} className="text-base font-bold text-slate-900 mt-4 mb-2">
            {line.replace('## ', '')}
          </h3>
        );
      }
      // Bullet items
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const text = line.trim().replace(/^[-*]\s+/, '');
        return (
          <li key={idx} className="text-slate-700 ml-4 list-disc text-sm leading-relaxed my-1">
            {renderBoldAndCitations(text)}
          </li>
        );
      }
      // Numbered list
      if (/^\d+\.\s+/.test(line.trim())) {
        const text = line.trim().replace(/^\d+\.\s+/, '');
        return (
          <li key={idx} className="text-slate-700 ml-4 list-decimal text-sm leading-relaxed my-1">
            {renderBoldAndCitations(text)}
          </li>
        );
      }
      // Standard paragraph
      return (
        <p key={idx} className="text-slate-700 text-sm leading-relaxed my-1.5">
          {renderBoldAndCitations(line)}
        </p>
      );
    });
  };

  const renderBoldAndCitations = (text: string) => {
    // Splits **bold** segments
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
        // Citation tag e.g. [Document Name, p. 3]
        return (
          <span
            key={i}
            className="inline-block px-1.5 py-0.2 mx-0.5 rounded bg-brand-50 text-brand-700 font-medium text-xs border border-brand-200"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={`flex gap-3.5 p-4 rounded-xl ${isUser ? 'bg-slate-100/80 ml-8' : 'bg-white border border-slate-200 shadow-2xs mr-4'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isUser
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
              <p className="font-semibold">Insufficient Document Evidence</p>
              <p className="mt-0.5 text-amber-700">
                The retrieved excerpts did not contain enough conclusive evidence to confidently answer this question without speculation.
              </p>
            </div>
          </div>
        )}

        {/* Degraded Synthesis Notice */}
        {message.degraded && (
          <div className="mb-3 p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-900 flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Synthesis Degraded Mode</p>
              <p className="mt-0.5 text-orange-700">
                {message.degradedReason || 'LLM generative synthesis was unavailable. Relevant source excerpts were retrieved directly.'}
              </p>
            </div>
          </div>
        )}

        {/* Message body */}
        <div className="space-y-1">{renderFormattedContent(message.content)}</div>

        {/* Citations Card */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <SourceCitation citations={message.citations} />
        )}
      </div>
    </div>
  );
};
