import { problem } from '../messages.ts';
import type { Problem } from '../messages.ts';
import type { ChatAnswer, ChatMessage, ChatRequest, Fetch, Llm } from '../types.ts';

/**
 * OpenRouter client. The single place where email content leaves the application.
 *
 * Privacy is enforced per request and cannot be turned off by configuration:
 *  - zdr: true               -> only endpoints with a Zero Data Retention policy
 *  - data_collection: "deny" -> only providers that neither store nor train on prompts
 * When no provider of the chosen model satisfies both, OpenRouter refuses the request
 * instead of falling back to a non-compliant provider, and we surface that error.
 */
export const PRIVACY = Object.freeze({ zdr: true, data_collection: 'deny' } as const);

export class LlmError extends Error {
  status: number;
  problem: Problem;

  constructor(described: Problem, status: number) {
    super(described.message);
    this.name = 'LlmError';
    this.status = status;
    this.problem = described;
  }
}

/** The part of an OpenRouter response body we read. Errors may come with any HTTP status. */
interface OpenRouterBody {
  model?: string;
  provider?: string;
  choices?: { message?: { content?: unknown } }[];
  error?: { code?: number; message?: string };
}

/** Pure: the exact JSON body sent to /chat/completions. */
export function buildChatRequest({ model, messages, temperature = 0.3, maxTokens = 1500 }: Omit<ChatRequest, 'apiKey'>) {
  return {
    model,
    messages: messages satisfies ChatMessage[],
    temperature,
    max_tokens: maxTokens,
    provider: { ...PRIVACY },
  };
}

/** Pure: turn an OpenRouter error into a message the user can act on. */
export function explainError(status: number, body: OpenRouterBody | null, model: string): Problem {
  const detail = body?.error?.message || '';
  if (status === 401) return problem('llm.keyRefused');
  if (status === 402) return problem('llm.noCredit');
  if (status === 404 || /data policy|no endpoints|no allowed providers/i.test(detail)) {
    return problem('llm.noZdrProvider', { model, detail });
  }
  if (status === 429) return problem('llm.rateLimited');
  return problem('llm.failed', { status, detail });
}

export function createOpenRouter({ baseUrl, fetchImpl = fetch }: { baseUrl: string; fetchImpl?: Fetch }): Llm {
  return {
    async chat({ apiKey, model, messages, temperature, maxTokens }: ChatRequest): Promise<ChatAnswer> {
      if (!apiKey) throw new LlmError(problem('llm.noKey'), 400);
      let res: Response;
      try {
        res = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify(buildChatRequest({ model, messages, temperature, maxTokens })),
          signal: AbortSignal.timeout(90_000),
        });
      } catch (e) {
        const error = e as Error & { cause?: { code?: string } };
        throw new LlmError(problem('llm.unreachable', { detail: error.cause?.code || error.name }), 502);
      }
      const body = (await res.json().catch(() => null)) as OpenRouterBody | null;
      // OpenRouter may also report provider failures inside a 200 response.
      if (!res.ok || body?.error) throw new LlmError(explainError(body?.error?.code || res.status, body, model), 502);
      const text = body?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new LlmError(problem('llm.emptyAnswer'), 502);
      return { text: text.trim(), model: body?.model || model, provider: body?.provider || null };
    },
  };
}
