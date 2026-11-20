import type { Config } from '../config.ts';
import type { Vault } from '../crypto.ts';
import type { UserRow } from '../types.ts';

/** Which key and model does this user's LLM traffic use? */
export function llmSettings(
  user: Pick<UserRow, 'openrouter_key_enc' | 'model'>,
  { config, vault }: { config: Config; vault: Vault },
): { apiKey: string; model: string } {
  return {
    apiKey: user.openrouter_key_enc ? vault.open<string>(user.openrouter_key_enc) : config.openrouter.apiKey,
    model: user.model || config.openrouter.model,
  };
}
