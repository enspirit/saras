// What saras asks of a language model, and what it gets back.
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatAnswer {
  text: string;
  /** The model that actually answered. */
  model: string;
  /** The provider OpenRouter routed to, when it says so. */
  provider: string | null;
}

export interface Llm {
  chat(request: ChatRequest): Promise<ChatAnswer>;
}
