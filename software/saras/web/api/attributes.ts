// Attributes: what an organisation wants to know of each email. One function per operation of doc/2-operations.md.
import type { Attribute, AttributeGiven, RuleProblem, RuleTried, SortedAgain, ValueGiven } from '../../shared/attribute.ts';
import { api } from '../api.ts';

export const readAttributes = (): Promise<Attribute[]> => api<Attribute[]>('GET', '/attributes');
export const createAttribute = (attribute: AttributeGiven): Promise<Attribute> => api<Attribute>('POST', '/attributes', attribute);
export const editAttribute = (key: string, attribute: AttributeGiven): Promise<Attribute> => api<Attribute>('PUT', `/attributes/${key}`, attribute);
export const deleteAttribute = (key: string): Promise<unknown> => api('DELETE', `/attributes/${key}`);
/** What a rule would say of recent emails, without changing any. `key` names the attribute being changed, `values` those typed for a new one. */
export const tryRule = (elo: string, key: string | null, values: ValueGiven[]): Promise<RuleTried[]> => api<RuleTried[]>('POST', '/attributes/try', { elo, key, values });
/** What is wrong in a rule as it stands, each problem with its place; nothing is kept. */
export const checkRule = (elo: string): Promise<RuleProblem[]> => api<RuleProblem[]>('POST', '/attributes/check', { elo });
/** SortAgainByRule: the rule of an attribute, as it is kept, applied to the emails already kept. */
export const sortAgainByRule = (key: string): Promise<SortedAgain> => api<SortedAgain>('POST', `/attributes/${key}/sort-again`);
/** SetEmailAttribute: a value by hand, or null to take it away. */
export const setEmailAttribute = (emailId: number, key: string, value: string | null): Promise<unknown> => api('PUT', `/emails/${emailId}/attributes/${key}`, { value });
