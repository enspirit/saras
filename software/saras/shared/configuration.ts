// The configuration of an organisation as pure data: what it wants to know of each email, and
// the boards its members share. It names things as an administrator does, by their name and
// their label, never by a number of this installation: so that it can be read, written by
// hand or by an AI, checked before anything changes, and given to any organisation.
import { saidInRule } from './attribute.ts';
import type { Attribute, AttributeGiven, AttributeValue } from './attribute.ts';
import type { Problem } from './problem.ts';

/**
 * An attribute as a configuration tells it. One of the organisation's own is named by its
 * name; the pre-configured one by its key, `status`, and its values by theirs: of that one, a
 * configuration says how it is decided and the colours of its values, nothing else.
 */
export type AttributeConfigured = AttributeGiven;

/**
 * The conditions of a board that can be said both ways, as a configuration tells them.
 *   attributes  the values an email has, by attribute: each named as the configuration names it
 *   mailbox     the addresses of the mailboxes it arrived in
 */
export interface ConditionsConfigured {
  attributes?: Record<string, string[]>;
  mailbox?: string[];
  from?: string;
  keywords?: string;
}

/** The filter of a board as a configuration tells it: what `BoardFilter` says, by names. */
export interface FilterConfigured extends ConditionsConfigured {
  received?: number;
  attachment?: boolean;
  except?: ConditionsConfigured;
}

/** A board of the organisation: one every member sees. A member's own boards are not its configuration. */
export interface BoardConfigured {
  name: string;
  filter: FilterConfigured;
}

/**
 * What an organisation is configured with. Given to an organisation, each attribute and each
 * board named is made, or changed when the organisation has one of that name; what is not
 * named is left as it is.
 */
export interface Configuration {
  attributes: AttributeConfigured[];
  boards: BoardConfigured[];
}

/** What is wrong in a configuration, and where: `attributes.0`, `boards.2.filter`. */
export interface ConfigurationProblem extends Problem {
  at: string;
}

/** What a configuration names an attribute by. */
export const attributeConfiguredAs = ({ system, key, name }: Pick<Attribute, 'system' | 'key' | 'name'>): string => (system ? key : name);

/** What a configuration names a value by: what a rule writes to give it. */
export const valueConfiguredAs = (attribute: Pick<Attribute, 'system'>, value: AttributeValue): string => saidInRule(attribute, value);

/** Whether two names name the same thing: case and surrounding spaces aside. */
export const sameName = (one: string, other: string): boolean => one.trim().toLowerCase() === other.trim().toLowerCase();
