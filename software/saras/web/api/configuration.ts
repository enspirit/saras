// The configuration of the organisation as data, and what the assistant proposes for it. One function per operation of doc/2-operations.md.
import type { ConfigurationAdvice, ConfigurationWanted } from '../../shared/advice.ts';
import type { Configuration } from '../../shared/configuration.ts';
import { api } from '../api.ts';

/** ApplyConfiguration: each attribute and each board named is made, or changed; all of it or none. */
export const applyConfiguration = (configuration: Configuration): Promise<Configuration> => api<Configuration>('PUT', '/configuration', configuration);
/** ProposeConfiguration: the assistant's questions, or what it proposes; nothing is applied. */
export const proposeConfiguration = (wanted: ConfigurationWanted): Promise<ConfigurationAdvice> => api<ConfigurationAdvice>('POST', '/assistant/configuration', wanted);
