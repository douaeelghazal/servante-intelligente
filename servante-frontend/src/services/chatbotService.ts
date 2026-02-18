import axios from 'axios';

const API_BASE = 'http://localhost:5000/api/chatbot';

const chatbotApi = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

chatbotApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ============================================
// TYPES
// ============================================

export interface Source {
  id: string;
  content: string;
  metadata: {
    title?: string;
    category?: string;
    filename?: string;
    [key: string]: unknown;
  };
  relevanceScore: number;
}

export interface ChatMetadata {
  model: string;
  processingTime: number;
  chunksUsed: number;
  query?: string;
}

export interface ChatResponse {
  success: boolean;
  answer: string;
  sources: Source[];
  metadata: ChatMetadata;
  error?: string;
}

export interface HealthStatus {
  success: boolean;
  chromadb: { status: string; collection: string; mode?: string };
  ollama: { status: string; models: string[]; error?: string };
  rag: { status: string };
}

export interface DocumentItem {
  id: string;
  content?: string;
  metadata: {
    title?: string;
    category?: string;
    filename?: string;
    size?: number;
    [key: string]: unknown;
  };
}

export interface StatsResponse {
  success: boolean;
  stats: {
    totalDocuments: number;
    collectionName: string;
  };
}

// ============================================
// API CALLS
// ============================================

export const chatbotService = {
  chat: async (query: string): Promise<ChatResponse> => {
    const response = await chatbotApi.post('/chat', { query });
    return response.data;
  },

  healthCheck: async (): Promise<HealthStatus> => {
    const response = await chatbotApi.get('/health');
    return response.data;
  },

  uploadDocument: async (
    file: File,
    title?: string,
    category?: string,
    tags?: string
  ) => {
    const formData = new FormData();
    formData.append('document', file);
    if (title) formData.append('title', title);
    if (category) formData.append('category', category);
    if (tags) formData.append('tags', tags);

    const response = await chatbotApi.post('/admin/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  listDocuments: async (): Promise<{ success: boolean; count: number; documents: DocumentItem[] }> => {
    const response = await chatbotApi.get('/admin/documents');
    return response.data;
  },

  deleteDocument: async (id: string) => {
    const response = await chatbotApi.delete(`/admin/documents/${id}`);
    return response.data;
  },

  getStats: async (): Promise<StatsResponse> => {
    const response = await chatbotApi.get('/admin/stats');
    return response.data;
  },
};
