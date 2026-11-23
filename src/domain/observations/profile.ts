// Observation: what a signed-in member is told about themselves, their organisation and this server.
import type { Profile, WhatVisitorsAreTold } from '../../../shared/member.ts';
import type { Organization } from '../../../shared/organization.ts';
import { PRIVACY } from '../../tooling/llm/openrouter.ts';
import { isConfigured } from '../../tooling/mail/oauth.ts';
import { signUpIsOpen } from '../computations/access.ts';
import { llmSettings } from '../computations/key-in-force.ts';
import { installationIsEmpty } from '../state/members.ts';
import type { Actor, Reach, World } from '../world.ts';

/** The organisation as a member sees it; its model and whether it has a key are the administrators' business. */
function organizationSeenBy({ member, organization }: Actor): Organization {
  const admin = member.role === 'admin';
  return {
    name: organization.name,
    sorting: organization.triage_strategy === 'ai' ? 'ai' : 'none',
    writing: organization.automation,
    skipAutomated: organization.skip_automated,
    model: admin ? organization.model || '' : undefined,
    hasKey: admin ? Boolean(organization.openrouter_key_enc) : undefined,
  };
}

/** The member's own settings, with the model and key in force for them. */
function settingsOf({ config, vault }: Pick<Reach, 'config' | 'vault'>, { member, organization }: Actor) {
  const { apiKey, model } = llmSettings(member, organization, { config, vault });
  return {
    language: member.language,
    signature: member.signature,
    model,
    defaultModel: organization.model || config.openrouter.model,
    hasOwnKey: Boolean(member.openrouter_key_enc),
    hasKey: Boolean(apiKey),
  };
}

export const profileOf = (reach: Pick<Reach, 'config' | 'vault'>, actor: Actor): Profile => ({
  email: actor.member.email,
  name: actor.member.name,
  organization: organizationSeenBy(actor),
  role: actor.member.role,
  ...settingsOf(reach, actor),
  oauth: { google: isConfigured(reach.config, 'google'), microsoft: isConfigured(reach.config, 'microsoft') },
  privacy: PRIVACY,
  retentionDays: reach.config.retentionDays,
});

/**
 * What anyone may know before signing in. Signing up creates an organisation; whether
 * strangers may do so is the operator's choice, and an empty installation always accepts its
 * first account. How long content is kept is public: the sign-in screen says so.
 */
export async function whatVisitorsAreTold({ db, config, postman }: Pick<World, 'db' | 'config' | 'postman'>): Promise<WhatVisitorsAreTold> {
  const empty = await installationIsEmpty(db);
  return { allowSignup: signUpIsOpen(config.allowSignup, empty), passwordResetByEmail: postman.configured, firstAccount: empty, retentionDays: config.retentionDays };
}
