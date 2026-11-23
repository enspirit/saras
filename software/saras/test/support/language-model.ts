// A stand-in for the language model: it speaks just enough of the OpenRouter chat-completions
// protocol, answers as a model would for each kind of request, and records what it was sent.
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ChatMessage } from '../../src/domain/model/llm.ts';

/** A request received by the stand-in. */
export interface RecordedLlmRequest {
  authorization: string | undefined;
  body: { model: string; messages: ChatMessage[]; provider?: unknown };
}

/** One decision per email of the batch, as the AI sorting asks: thank-you notes need no reply, quotes are urgent. */
function sorted(system: string, user: string): string {
  const promptId = Number(system.match(/id (\d+): (?:Appointment scheduling|Prise de rendez-vous)/)?.[1]) || null;
  const decisions = [...user.matchAll(/<email id="(\d+)">([\s\S]*?)<\/email>/g)].map(([, id, mail = '']) => {
    const needs = !/Merci pour la reunion/.test(mail);
    return {
      id: Number(id),
      needs_reply: needs,
      reason: needs ? 'Une réponse est attendue.' : 'Simple remerciement.',
      prompt_id: /rendez-vous/.test(mail) ? promptId : null,
      priority: /devis/.test(mail) ? 'high' : 'normal',
    };
  });
  return JSON.stringify(decisions);
}

/** A proposal: what was written, proofread or reworded, or else a reply with a passage to complete. */
function written(system: string, user: string): string {
  const draft = user.match(/<draft>\n([\s\S]*)\n<\/draft>/)?.[1] ?? '';
  // Corrects one known mistake and, like a careless model, wraps its answer in a code fence.
  if (system.startsWith('You are a proofreader')) return '```html\n' + draft.replace('reponse', 'réponse') + '\n```';
  // Rewords, and like a hostile one, adds markup no reply may contain.
  if (system.startsWith('You are an editor')) return draft.replace('<p>', '<p>Bien cordialement, ') + '<script>alert(1)</script><img src=x onerror=alert(2)>';
  return '<p>Bonjour,</p><p>Merci pour votre message. Voici notre proposition : [À COMPLÉTER : montant].</p><p>Cordialement</p>';
}

/** What the model answers, with its status. One model has no provider that keeps nothing. */
function answerTo(body: RecordedLlmRequest['body']): { status: number; json: unknown } {
  if (body.model === 'nozdr/model') return { status: 404, json: { error: { code: 404, message: 'No endpoints found matching your data policy.' } } };
  const [system, user] = body.messages as [ChatMessage, ChatMessage];
  const content = system.content.includes('You triage the inbox') ? sorted(system.content, user.content) : written(system.content, user.content);
  return { status: 200, json: { model: body.model, provider: 'FakeZDR', choices: [{ message: { role: 'assistant', content } }] } };
}

const received = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => resolve(raw));
  });

export function fakeOpenRouter() {
  const requests: RecordedLlmRequest[] = [];
  const answer = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = JSON.parse(await received(req)) as RecordedLlmRequest['body'];
    requests.push({ authorization: req.headers.authorization, body });
    const { status, json } = answerTo(body);
    res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(json));
  };
  return { server: createServer((req, res) => void answer(req, res)), requests };
}
