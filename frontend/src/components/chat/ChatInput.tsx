import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Button } from '../common/Button.js';

interface ChatInputProps {
  onSendMessage: (question: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  selectedCount: number;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  disabled = false,
  selectedCount,
}) => {
  const [question, setQuestion] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const starterQuestions = [
    'Summarize the main findings across these papers.',
    'Compare the methodologies used in these documents.',
    'What limitations are reported by the authors?',
    'What differences exist between the conclusions of these papers?',
  ];

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [question]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim() || isLoading || disabled) return;
    onSendMessage(question.trim());
    setQuestion('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSelectStarter = (starter: string) => {
    if (disabled || isLoading) return;
    onSendMessage(starter);
  };

  return (
    <div className="space-y-3">
      {/* Starter prompts (shown when input is empty) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
          <Sparkles className="w-3 h-3 text-brand-500" />
          Suggested:
        </span>
        {starterQuestions.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            disabled={disabled || isLoading}
            onClick={() => handleSelectStarter(prompt)}
            className="text-xs px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors border border-slate-200/60 disabled:opacity-40 disabled:cursor-not-allowed text-left truncate max-w-xs"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input container */}
      <form
        onSubmit={handleSubmit}
        className="relative flex items-end gap-2 p-2 bg-white rounded-xl border border-slate-300 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 transition-all"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedCount === 0
              ? 'Select at least one document on the left to ask questions...'
              : `Ask a question across ${selectedCount} selected document${selectedCount > 1 ? 's' : ''}...`
          }
          disabled={disabled || isLoading}
          className="flex-1 max-h-40 py-1.5 px-3 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none resize-none disabled:opacity-50"
        />

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!question.trim() || disabled || isLoading}
          isLoading={isLoading}
          icon={<Send className="w-3.5 h-3.5" />}
          className="shrink-0"
        >
          Ask
        </Button>
      </form>
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span>Press <kbd className="font-mono bg-slate-100 px-1 rounded border">Enter</kbd> to submit, <kbd className="font-mono bg-slate-100 px-1 rounded border">Shift + Enter</kbd> for new line</span>
        <span>Answers grounded in vector retrieval</span>
      </div>
    </div>
  );
};
