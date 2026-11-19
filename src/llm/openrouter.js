/**
 * OpenRouter client. The single place where email content leaves the application.
 *
 * Privacy is enforced per request and cannot be turned off by configuration:
 *  - zdr: true               -> only endpoints with a Zero Data Retention policy
 *  - data_collection: "deny" -> only providers that neither store nor train on prompts
 * When no provider of the chosen model satisfies both, OpenRouter refuses the request
 * instead of falling back to a non-compliant provider, and we surface that error.
 */
export const PRIVACY = Object.freeze({ zdr: true, data_collection: 'deny' });

export class LlmError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
  }
}

/** Pure: the exact JSON body sent to /chat/completions. */
export function buildChatRequest({ model, messages, temperature = 0.3, maxTokens = 1500 }) {
  return {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    provider: { ...PRIVACY },
  };
}

/** Pure: turn an OpenRouter error into a message the user can act on. */
export function explainError(status, body, model) {
  const detail = body?.error?.message || '';
  if (status === 401) return 'Clé OpenRouter refusée. Vérifiez-la dans Réglages.';
  if (status === 402) return 'Crédit OpenRouter insuffisant.';
  if (status === 404 || /data policy|no endpoints|no allowed providers/i.test(detail)) {
    return `Aucun fournisseur du modèle « ${model} » ne garantit la non-conservation des données (ZDR). Choisissez un autre modèle dans Réglages. ${detail}`.trim();
  }
  if (status === 429) return 'Limite de débit OpenRouter atteinte, réessayez dans un instant.';
  return `Erreur OpenRouter (${status}). ${detail}`.trim();
}

export function createOpenRouter({ baseUrl, fetchImpl = fetch }) {
  return {
    async chat({ apiKey, model, messages, temperature, maxTokens }) {
      if (!apiKey) throw new LlmError('Aucune clé OpenRouter configurée. Ajoutez-la dans Réglages.', 400);
      let res;
      try {
        res = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify(buildChatRequest({ model, messages, temperature, maxTokens })),
          signal: AbortSignal.timeout(90_000),
        });
      } catch (e) {
        throw new LlmError(`OpenRouter injoignable (${e.cause?.code || e.name}).`, 502);
      }
      const body = await res.json().catch(() => null);
      // OpenRouter may also report provider failures inside a 200 response.
      if (!res.ok || body?.error) throw new LlmError(explainError(body?.error?.code || res.status, body, model), 502);
      const text = body?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new LlmError('Réponse vide du modèle.', 502);
      return { text: text.trim(), model: body.model || model, provider: body.provider || null };
    },
  };
}
