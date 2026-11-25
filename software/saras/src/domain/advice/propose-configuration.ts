// ProposeConfiguration — an administrator has the assistant propose how the organisation's
// emails are sorted: from what they say of its work, a few attributes with their rules and a
// few boards, or first the questions it needs answered. Nothing is applied: what is proposed
// is read, then given to ApplyConfiguration, whole or in part.
//
//   DomPre   (none)
//   DomPost  the same: nothing is kept, nothing is changed
//   ReqPre   the member is an administrator
//            something is said of the organisation
//            a key is in force (the LLM refuses otherwise)
//   ReqPost  the LLM is sent what the administrator wrote and the configuration as it is: no email, and nothing else of the organisation
//            a proposal is one ApplyConfiguration takes as it is; it holds only what is new or would change
//            it is small: a few attributes, a few boards
//            questions are asked once: answered, even by nothing, a proposal follows
//            the model is told what is wrong in its answer and asked again, a few times at most
import type { ConfigurationAdvice } from '../../../shared/advice.ts';
import type { Configuration } from '../../../shared/configuration.ts';
import { Unusable, perform } from '../../assistant/perform.ts';
import type { Ask } from '../../assistant/skill.ts';
import { CONFIGURE_ORGANISATION } from '../../assistant/skills/configure-organisation.ts';
import type { ConfigurationAnswer, ConfigurationAsked, ProposalWritten } from '../../assistant/skills/configure-organisation.ts';
import { isAdministrator } from '../computations/access.ts';
import { objectionOf, wantedGiven } from '../computations/advice.ts';
import { configurationGiven } from '../computations/configuration.ts';
import type { Known } from '../computations/configuration.ts';
import { whatChanges } from '../computations/configuration-changes.ts';
import { llmSettings } from '../computations/key-in-force.ts';
import { languageName } from '../computations/llm-prompts.ts';
import { configurationRead } from '../configuration/configuration-read.ts';
import type { ConfigurationRead } from '../configuration/configuration-read.ts';
import { configurationOf, knownTo } from '../observations/configuration.ts';
import { Refusal, accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';

/** A proposal as ApplyConfiguration would read it. */
const readAs = ({ configuration }: ProposalWritten, known: Known): ConfigurationRead => configurationRead(configurationGiven(configuration), known);

/** The means the assistant is given: the organisation's key and model in force, and what ApplyConfiguration would refuse. */
function meansOf(world: World, { organization }: Actor, known: Known): { ask: Ask; check: (answer: ConfigurationAnswer) => string[] } {
  const settings = llmSettings(organization, world);
  return {
    ask: async (messages) => (await world.llm.chat({ ...settings, messages, temperature: 0.2, maxTokens: 4000 })).text,
    check: (answer) => (answer.kind === 'proposal' ? readAs(answer, known).problems.map(objectionOf) : []),
  };
}

/** What the assistant answers; refused as the LLM's failure when nothing it gave could be used. */
async function advised(world: World, actor: Actor, asked: ConfigurationAsked, known: Known): Promise<ConfigurationAnswer> {
  try {
    return await perform(CONFIGURE_ORGANISATION, asked, meansOf(world, actor, known));
  } catch (e) {
    if (!(e instanceof Unusable)) throw e;
    throw new Refusal('upstream', 'assistant.noUsableAnswer');
  }
}

const told = (answer: ConfigurationAnswer, current: Configuration, known: Known): ConfigurationAdvice =>
  answer.kind === 'questions' ? answer : { kind: 'proposal', summary: answer.summary, configuration: whatChanges(current, readAs(answer, known).configuration) };

export async function proposeConfiguration(world: World, actor: Actor, given: unknown): Promise<ConfigurationAdvice> {
  accepted(isAdministrator(actor));
  const wanted = accepted(wantedGiven(given));
  const known = await knownTo(world.db, actor);
  const current = await configurationOf(world.db, actor, known);
  const answer = await advised(world, actor, { ...wanted, current, language: languageName(actor.member.language) }, known);
  return told(answer, current, known);
}
