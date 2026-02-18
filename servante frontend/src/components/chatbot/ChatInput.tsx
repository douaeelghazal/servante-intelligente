import { useState, KeyboardEvent, useRef } from "react";

interface Props {
  onSend: (message: string) => void;
  isLoading: boolean;
  suggestedQuestions: string[];
}

export function ChatInput({ onSend, isLoading, suggestedQuestions }: Props) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput("");
      setShowSuggestions(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (question: string) => {
    onSend(question);
    setShowSuggestions(false);
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="border-t border-gray-100 bg-white p-4">
      {/* Questions suggérées */}
      {showSuggestions && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-2">💡 Questions suggérées :</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.slice(0, 3).map((q, i) => (
              <button
                key={i}
                onClick={() => handleSuggestion(q)}
                className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-200 transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Zone de saisie */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Posez votre question... (Entrée pour envoyer)"
            disabled={isLoading}
            rows={1}
            className="w-full resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 transition-all"
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="w-11 h-11 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2 text-center">
        Maj+Entrée pour un saut de ligne
      </p>
    </div>
  );
}
