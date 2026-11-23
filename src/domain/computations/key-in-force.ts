import type { Config } from '../../tooling/config.ts';
import type { Vault } from '../../tooling/crypto.ts';
import type { OrganizationRow } from '../model/organization.ts';

/**
 * Which key and model does the LLM traffic of an organisation use? Its own, else the server's:
 * the same for every one of its members. An operator hosting several organisations leaves the
 * server key empty, so that each one pays for its own usage.
 */
export function llmSettings(org: Pick<OrganizationRow, 'openrouter_key_enc' | 'model'>, { config, vault }: { config: Config; vault: Vault }): { apiKey: string; model: string } {
  return {
    apiKey: org.openrouter_key_enc ? vault.open<string>(org.openrouter_key_enc) : config.openrouter.apiKey,
    model: org.model || config.openrouter.model,
  };
}
