import { chromaService } from './chromaService';

// ============================================
// TYPES ET INTERFACES
// ============================================

interface SearchResult {
  id: string;
  content: string;
  metadata: {
    title: string;
    filename: string;
    category?: string;
    chunkIndex?: number;
    totalChunks?: number;
    mimetype?: string;
    uploadedAt?: string;
    size?: number;
    tags?: string[];
    [key: string]: any;
  };
  distance?: number;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaHealthStatus {
  available: boolean;
  models: string[];
  error?: string;
}

interface GenerateAnswerResult {
  success: boolean;
  answer: string;
  sources: Array<{
    title: string;
    filename: string;
    category?: string;
    chunkIndex?: number;
    relevance: number;
  }>;
  metadata: {
    query: string;
    chunksUsed: number;
    model: string;
    processingTime: number;
  };
  error?: string;
}

// ============================================
// CONFIGURATION
// ============================================

const OLLAMA_CONFIG = {
  baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.2:latest',
  timeout: 60000,
};

const RAG_CONFIG = {
  topK: 5,
  maxContextLength: 4000,
  temperature: 0.7,
  systemPrompt: `Tu es un assistant virtuel expert qui aide les utilisateurs à trouver des informations dans la base de connaissances.

INSTRUCTIONS IMPORTANTES:
1. Réponds UNIQUEMENT en te basant sur les informations fournies dans le CONTEXTE ci-dessous
2. Si l'information n'est pas dans le contexte, dis clairement "Je n'ai pas cette information dans ma base de connaissances"
3. Sois précis, concis et professionnel
4. Cite les sources quand c'est pertinent (ex: "Selon le guide utilisateur...")
5. Structure ta réponse avec des listes à puces si nécessaire
6. Réponds en français`,
};

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Vérifie la santé du service Ollama
 */
export async function checkOllamaHealth(): Promise<OllamaHealthStatus> {
  try {
    console.log('🔍 Vérification de la santé d\'Ollama...');
    
    const response = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Ollama API retourné le statut ${response.status}`);
    }

    const data = await response.json();
    const models = data.models?.map((m: any) => m.name) || [];

    console.log(`✅ Ollama disponible avec ${models.length} modèle(s):`, models);

    return {
      available: true,
      models,
    };
  } catch (error) {
    console.error('❌ Ollama non disponible:', error);
    return {
      available: false,
      models: [],
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

/**
 * Construit le prompt enrichi avec le contexte RAG
 */
function buildPrompt(query: string, contexts: SearchResult[]): string {
  const contextText = contexts
    .map((ctx: SearchResult, idx: number) => {
      const source = `[Source ${idx + 1}: ${ctx.metadata.title || ctx.metadata.filename}]`;
      return `${source}\n${ctx.content}\n`;
    })
    .join('\n---\n\n');

  return `${RAG_CONFIG.systemPrompt}

CONTEXTE:
${contextText}

QUESTION DE L'UTILISATEUR:
${query}

RÉPONSE:`;
}

/**
 * Appelle Ollama pour générer une réponse
 */
async function callOllama(prompt: string): Promise<string> {
  console.log('🤖 Appel à Ollama pour génération...');
  
  const requestBody = {
    model: OLLAMA_CONFIG.model,
    prompt: prompt,
    stream: false,
    options: {
      temperature: RAG_CONFIG.temperature,
      num_predict: 1000,
    },
  };

  console.log(`📤 Modèle: ${OLLAMA_CONFIG.model}`);
  console.log(`📤 Prompt length: ${prompt.length} caractères`);

  const response = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(OLLAMA_CONFIG.timeout),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API erreur (${response.status}): ${errorText}`);
  }

  const data: OllamaResponse = await response.json();
  
  console.log('✅ Réponse générée par Ollama');
  console.log(`📊 Tokens générés: ${data.eval_count || 'N/A'}`);
  
  return data.response.trim();
}

/**
 * Calcule un score de pertinence (0-100)
 */
function calculateRelevance(distance?: number): number {
  if (distance === undefined) return 80;
  const relevance = Math.max(0, Math.min(100, (1 - distance / 2) * 100));
  return Math.round(relevance);
}

// ============================================
// FONCTION PRINCIPALE RAG
// ============================================

/**
 * Génère une réponse à partir d'une question en utilisant RAG
 */
export async function generateAnswer(
  query: string,
  topK: number = RAG_CONFIG.topK
): Promise<GenerateAnswerResult> {
  const startTime = Date.now();

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 GÉNÉRATION DE RÉPONSE RAG`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📝 Question: "${query}"`);
    console.log(`🔢 Top-K: ${topK}`);

    // 1. Vérifier qu'Ollama est disponible
    const health = await checkOllamaHealth();
    if (!health.available) {
      return {
        success: false,
        answer: 'Le service de génération de réponses (Ollama) n\'est pas disponible. Veuillez vérifier qu\'Ollama est démarré.',
        sources: [],
        metadata: {
          query,
          chunksUsed: 0,
          model: OLLAMA_CONFIG.model,
          processingTime: Date.now() - startTime,
        },
        error: health.error,
      };
    }

    // 2. Recherche sémantique dans ChromaDB
    console.log(`\n📚 Recherche de chunks pertinents...`);
    const searchResults = await chromaService.searchDocuments(query, topK);

    if (!searchResults || searchResults.length === 0) {
      console.log('⚠️ Aucun chunk pertinent trouvé');
      return {
        success: true,
        answer: 'Je n\'ai trouvé aucune information pertinente dans ma base de connaissances pour répondre à votre question. Pourriez-vous reformuler ou préciser votre demande ?',
        sources: [],
        metadata: {
          query,
          chunksUsed: 0,
          model: OLLAMA_CONFIG.model,
          processingTime: Date.now() - startTime,
        },
      };
    }

    console.log(`✅ ${searchResults.length} chunk(s) trouvé(s)`);
    
    // Convertir les résultats de votre chromaService vers SearchResult
    const typedResults: SearchResult[] = searchResults.map((result: any) => ({
      id: result.id,
      content: result.content,
      metadata: result.metadata,
      distance: result.distance,
    }));

    typedResults.forEach((result: SearchResult, idx: number) => {
      const relevance = calculateRelevance(result.distance);
      console.log(`   ${idx + 1}. ${result.metadata.title} (pertinence: ${relevance}%)`);
    });

    // 3. Construire le prompt avec contexte
    console.log(`\n📝 Construction du prompt RAG...`);
    const prompt = buildPrompt(query, typedResults);

    // 4. Générer la réponse avec Ollama
    const answer = await callOllama(prompt);

    // 5. Préparer les sources
    const sources = typedResults.map((result: SearchResult) => ({
      title: result.metadata.title || 'Sans titre',
      filename: result.metadata.filename || 'Inconnu',
      category: result.metadata.category || 'general',
      chunkIndex: result.metadata.chunkIndex,
      relevance: calculateRelevance(result.distance),
    }));

    const processingTime = Date.now() - startTime;

    console.log(`\n✅ Réponse générée avec succès`);
    console.log(`⏱️  Temps de traitement: ${processingTime}ms`);
    console.log(`📊 Longueur réponse: ${answer.length} caractères`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      success: true,
      answer,
      sources,
      metadata: {
        query,
        chunksUsed: typedResults.length,
        model: OLLAMA_CONFIG.model,
        processingTime,
      },
    };
  } catch (error) {
    console.error('❌ Erreur lors de la génération:', error);
    
    return {
      success: false,
      answer: 'Désolé, une erreur est survenue lors de la génération de la réponse. Veuillez réessayer.',
      sources: [],
      metadata: {
        query,
        chunksUsed: 0,
        model: OLLAMA_CONFIG.model,
        processingTime: Date.now() - startTime,
      },
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

/**
 * Génère une réponse en streaming
 */
export async function generateAnswerStream(
  query: string,
  topK: number = RAG_CONFIG.topK,
  onChunk: (chunk: string) => void
): Promise<GenerateAnswerResult> {
  return generateAnswer(query, topK);
}