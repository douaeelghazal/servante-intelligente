import ReactMarkdown from "react-markdown";
import { ChatMessage as ChatMessageType } from "../../services/chatbotService";

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";
  const time = message.timestamp.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex gap-3 mb-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gradient-to-br from-purple-500 to-indigo-600 text-white"
        }`}
      >
        {isUser ? "U" : "🤖"}
      </div>

      {/* Contenu */}
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
          }`}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.sources.map((source, index) => (
              <span
                key={index}
                className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100"
                title={source.metadata.filename}
              >
                📄 {source.metadata.title}
              </span>
            ))}
          </div>
        )}

        <span className="text-xs text-gray-400">{time}</span>
      </div>
    </div>
  );
}
