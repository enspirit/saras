import type { Config } from '../config.ts';
import type { Vault } from '../crypto.ts';
import type { OrganizationRow, UserRow } from '../types.ts';

/**
 * Which key and model does this user's LLM traffic use? Their own, else their organisation's,
 * else the server's. An operator hosting several organisations leaves the server key empty, so
 * that each one pays for its own usage.
 */
export function llmSettings(
  user: Pick<UserRow, 'openrouter_key_enc' | 'model'>,
  org: Pick<OrganizationRow, 'openrouter_key_enc' | 'model'>,
  { config, vault }: { config: Config; vault: Vault },
): { apiKey: string; model: string } {
  const sealed = user.openrouter_key_enc || org.openrouter_key_enc;
  return {
    apiKey: sealed ? vault.open<string>(sealed) : config.openrouter.apiKey,
    model: user.model || org.model || config.openrouter.model,
  };
}
