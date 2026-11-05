import { apiClient } from './api.js';
import { IChatMessage, IResearchSession, ComparisonResult, ICitation } from '../types/research.js';

export const researchService = {
  async ask(params: {
    question: string;
    documentIds: string[];
    sessionId?: string;
  }): Promise<{
    sessionId: string;
    answer: string;
    citations: ICitation[];
    hasInsufficientEvidence: boolean;
  }> {
    const response = await apiClient.post<{
      success: boolean;
      sessionId: string;
      answer: string;
      citations: ICitation[];
      hasInsufficientEvidence: boolean;
    }>('/chat/ask', params);
    return response.data;
  },

  async askStream(
    params: {
      question: string;
      documentIds: string[];
      sessionId?: string;
    },
    callbacks: {
      onStart?: (data: { sessionId: string; citations: ICitation[] }) => void;
      onToken?: (token: string) => void;
      onDone?: (data: {
        sessionId: string;
        answer: string;
        citations: ICitation[];
        hasInsufficientEvidence: boolean;
        degraded?: boolean;
        degradedReason?: string;
      }) => void;
      onError?: (err: any) => void;
    }
  ): Promise<void> {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

    try {
      const response = await fetch(`${API_BASE_URL}/chat/ask/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Streaming failed with status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'start') {
              callbacks.onStart?.(event.data);
            } else if (event.type === 'token') {
              callbacks.onToken?.(event.data.token);
            } else if (event.type === 'done') {
              callbacks.onDone?.(event.data);
            } else if (event.type === 'error') {
              callbacks.onError?.(new Error(event.data.error || 'Stream error'));
            }
          } catch {
            // Ignore unparsed lines
          }
        }
      }
    } catch (err: any) {
      if (callbacks.onError) {
        callbacks.onError(err);
      } else {
        throw err;
      }
    }
  },

  async getSessions(): Promise<IResearchSession[]> {
    const response = await apiClient.get<{ success: boolean; sessions: IResearchSession[] }>(
      '/chat/sessions'
    );
    return response.data.sessions;
  },

  async getSessionMessages(sessionId: string): Promise<IChatMessage[]> {
    const response = await apiClient.get<{ success: boolean; messages: IChatMessage[] }>(
      `/chat/sessions/${sessionId}`
    );
    return response.data.messages;
  },

  async clearSession(sessionId: string): Promise<void> {
    await apiClient.delete(`/chat/sessions/${sessionId}`);
  },

  async compareDocuments(params: {
    documentIds: string[];
    focusTopic?: string;
  }): Promise<ComparisonResult> {
    const response = await apiClient.post<ComparisonResult & { success: boolean }>(
      '/research/compare',
      params
    );
    return response.data;
  },
};
