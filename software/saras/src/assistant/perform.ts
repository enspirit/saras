// Performing a skill: ask, read, and when the answer will not do, say what is wrong and ask
// again — a few times, never more.
import type { Means, Read, Skill, Turn } from './skill.ts';

/** How many times a model is asked before the assistant gives up. */
export const ATTEMPTS = 3;

/** No answer of the model could be used, however it was told what was wrong. */
export class Unusable extends Error {
  skill: string;
  objections: string[];

  constructor(skill: string, objections: string[]) {
    super(`${skill}: no usable answer`);
    this.skill = skill;
    this.objections = objections;
  }
}

/** What a model is told of an answer that will not do. */
const objection = (objections: string[]): Turn => ({
  role: 'user',
  content: `Your answer cannot be used:\n${objections.map((one) => `- ${one}`).join('\n')}\n\nAnswer again, whole, in the same format, with this put right and the rest as it was.`,
});

/** An answer as the skill reads it, then as whoever asked judges it. */
async function judged<Asked, Answer>(skill: Skill<Asked, Answer>, asked: Asked, text: string, check: Means<Answer>['check']): Promise<Read<Answer>> {
  const outcome = skill.read(text, asked);
  if (!outcome.ok || !check) return outcome;
  const objections = await check(outcome.answer);
  return objections.length ? { ok: false, objections } : outcome;
}

/** Has a model do what the skill is for. Throws `Unusable` when it gave nothing that could be used; what `ask` throws is left to who gave it. */
export async function perform<Asked, Answer>(skill: Skill<Asked, Answer>, asked: Asked, { ask, check }: Means<Answer>): Promise<Answer> {
  const said = skill.brief(asked);
  for (let attempt = 1; ; attempt++) {
    const text = await ask(said);
    const outcome = await judged(skill, asked, text, check);
    if (outcome.ok) return outcome.answer;
    if (attempt >= ATTEMPTS) throw new Unusable(skill.name, outcome.objections);
    said.push({ role: 'assistant', content: text }, objection(outcome.objections));
  }
}
