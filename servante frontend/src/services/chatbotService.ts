import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export interface SearchResult {
  id: string;
  content: string;
  metadata: {
    title: string;
    filename: string;
    category: string;
    chunkIndex?: number;
    totalChunks?: number;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: SearchResult[];
}

export const chatbotService = {
  async search(query: string, nResults: number = 5): Promise<SearchResult[]> {
    const response = await axios.post(`${API_BASE}/api/chatbot/search`, {
      query,
      nResults,
    });
    return response.data.results || [];
  },

  async getStats() {
    const response = await axios.get(`${API_BASE}/api/chatbot/admin/stats`);
    return response.data.stats;
  },

  async healthCheck() {
    const response = await axios.get(`${API_BASE}/api/chatbot/health`);
    return response.data;
  },

  buildAnswer(query: string, results: SearchResult[]): string {
    if (results.length === 0) {
      return "Je n'ai pas trouvé d'information correspondant à votre question dans la documentation disponible. Pouvez-vous reformuler ou contacter un administrateur ?";
    }

    const topResult = results[0];
    const otherResults = results.slice(1, 3);

    let answer = topResult.content;

    if (otherResults.length > 0) {
      answer += "\n\n**Informations complémentaires :**\n";
      otherResults.forEach((result) => {
        answer += `\n- ${result.content.substring(0, 150)}...`;
      });
    }

    return answer;
  },
};
