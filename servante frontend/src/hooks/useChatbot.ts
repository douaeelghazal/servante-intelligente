import { useState, useCallback } from "react";
import { chatbotService, ChatMessage, SearchResult } from "../services/chatbotService";

const SUGGESTED_QUESTIONS = [
  "Comment emprunter un outil ?",
  "Quels outils sont disponibles ?",
  "Comment prolonger un emprunt ?",
  "Quels sont les horaires d'ouverture ?",
  "Comment signaler un problème avec un outil ?",
];

export function useChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Bonjour ! Je suis l'assistant de la Servante Intelligente 🤖\n\nJe peux vous aider à :\n- Trouver des outils disponibles\n- Expliquer comment emprunter du matériel\n- Répondre à vos questions sur le système\n\nQue puis-je faire pour vous ?",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (userInput: string) => {
    if (!userInput.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: userInput.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const results: SearchResult[] = await chatbotService.search(userInput, 5);
      const answer = chatbotService.buildAnswer(userInput, results);

      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: answer,
        timestamp: new Date(),
        sources: results.slice(0, 3),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError("Erreur de connexion au serveur. Vérifiez que le backend est démarré.");
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: "❌ Je ne peux pas répondre pour le moment. Vérifiez que le serveur est démarré.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Conversation réinitialisée. Comment puis-je vous aider ?",
        timestamp: new Date(),
      },
    ]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    suggestedQuestions: SUGGESTED_QUESTIONS,
  };
}
