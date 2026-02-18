import { useRef, useEffect, useState } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

export function ChatbotWidget() {
  const { messages, isLoading, error, sendMessage, clearMessages, suggestedQuestions } = useChatbot();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    if (!isOpen && messages.length > 1) {
      setHasUnread(true);
    }
  }, [messages, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasUnread(false);
  };

  return (
    <>
      {/* Bouton flottant */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center z-50 cursor-pointer"
        >
          <span className="text-2xl">🤖</span>
          {hasUnread && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center">
              !
            </span>
          )}
        </button>
      )}

      {/* Fenêtre du chatbot */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-100">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-lg">
                🤖
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Assistant Servante</h3>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-white/80 text-xs">En ligne</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearMessages}
                title="Nouvelle conversation"
                className="w-8 h-8 text-white/70 hover:text-white hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 text-white/70 hover:text-white hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 border-b border-red-100 px-4 py-2">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {/* Indicateur de chargement */}
            {isLoading && (
              <div className="flex gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-sm">
                  🤖
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <ChatInput
            onSend={sendMessage}
            isLoading={isLoading}
            suggestedQuestions={suggestedQuestions}
          />
        </div>
      )}
    </>
  );
}
