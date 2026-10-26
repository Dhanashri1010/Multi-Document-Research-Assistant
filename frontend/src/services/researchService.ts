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
