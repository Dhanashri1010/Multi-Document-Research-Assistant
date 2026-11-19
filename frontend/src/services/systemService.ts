import { apiClient } from './api.js';

export interface SystemConfig {
  maxFileSizeMB: number;
  supportedFileTypes: string[];
  userDailyAiCap: number;
  llmRpmLimit: number;
  llmDailyLimit: number;
  primaryModel: string;
  fallbackModel: string;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  maxFileSizeMB: 25,
  supportedFileTypes: ['.pdf', '.docx', '.doc', '.txt'],
  userDailyAiCap: 30,
  llmRpmLimit: 10,
  llmDailyLimit: 500,
  primaryModel: 'gemini-3.1-flash-lite',
  fallbackModel: 'gemini-3.5-flash-lite',
};

export async function fetchSystemConfig(): Promise<SystemConfig> {
  try {
    const res = await apiClient.get('/health');
    const sys = res.data?.system;
    return {
      maxFileSizeMB: typeof sys?.maxFileSizeMB === 'number' ? sys.maxFileSizeMB : DEFAULT_SYSTEM_CONFIG.maxFileSizeMB,
      supportedFileTypes: Array.isArray(sys?.supportedFileTypes) ? sys.supportedFileTypes : DEFAULT_SYSTEM_CONFIG.supportedFileTypes,
      userDailyAiCap: typeof sys?.userDailyAiCap === 'number' ? sys.userDailyAiCap : DEFAULT_SYSTEM_CONFIG.userDailyAiCap,
      llmRpmLimit: typeof sys?.llmRpmLimit === 'number' ? sys.llmRpmLimit : DEFAULT_SYSTEM_CONFIG.llmRpmLimit,
      llmDailyLimit: typeof sys?.llmDailyLimit === 'number' ? sys.llmDailyLimit : DEFAULT_SYSTEM_CONFIG.llmDailyLimit,
      primaryModel: typeof sys?.llmModel === 'string' ? sys.llmModel : DEFAULT_SYSTEM_CONFIG.primaryModel,
      fallbackModel: typeof sys?.llmFallbackModel === 'string' ? sys.llmFallbackModel : DEFAULT_SYSTEM_CONFIG.fallbackModel,
    };
  } catch (_e) {
    return DEFAULT_SYSTEM_CONFIG;
  }
}
