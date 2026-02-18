import { useState, useCallback, useRef } from 'react';
import { chatbotService, Source, ChatMetadata } from '../services/chatbotService';

// ============================================
// TYPES
// ============================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  metadata?: ChatMetadata;
  timestamp: Date;
  isError?: boolean;
}

export type OnlineStatus = 'checking' | 'online' | 'offline';

// ============================================
// HOOK
// ============================================

export function useChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>('checking');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  }, []);

  const checkHealth = useCallback(async () => {
    setOnlineStatus('checking');
    try {
      const health = await chatbotService.healthCheck();
      setOnlineStatus(health.rag?.status === 'ready' ? 'online' : 'offline');
    } catch {
      setOnlineStatus('offline');
    }
  }, []);

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: query.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      scrollToBottom();

      try {
        const response = await chatbotService.chat(query.trim());

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.answer || 'No response received.',
          sources: response.sources?.length ? response.sources : undefined,
          metadata: response.metadata,
          timestamp: new Date(),
          isError: !response.success,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content:
            'The assistant is currently unavailable. Please make sure ChromaDB and Ollama are running, then try again.',
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        scrollToBottom();
      }
    },
    [isLoading, scrollToBottom]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    onlineStatus,
    messagesEndRef,
    sendMessage,
    clearMessages,
    checkHealth,
  };
}
