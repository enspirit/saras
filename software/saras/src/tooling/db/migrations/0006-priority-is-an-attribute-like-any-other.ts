// The priority is one of the organisation's own attributes (decision 0014). It was the second
// pre-configured one: a row with the key 'priority' where the organisation had given it a rule
// or colours, a column of its own on each email, and the name 'priority' in the filters of
// boards and in what prompts suit.
//
// Each organisation gets it as an attribute it may rename, give other values, or delete:
//   - its row loses its key, and is named: "Priority", with "High", "Normal" and "Low" as its
//     values 1, 2 and 3, in the colours they had. Its rule stays as it is, and still reads: a
//     rule names a value by its label, whatever its case, and those rules answer 'high'. An
//     organisation that had no row gets one, decided by nobody;
//   - where no rule was ever written for it and the organisation's first administrator reads
//     French, it is named in French, as the interface named it until now: no rule names its values;
//   - what each email had for it is kept under the number of the attribute, with who decided
//     it. A priority nobody decided (the AI's, when it sorted) is kept as nobody's; "normal"
//     that nobody decided was only where an email started, and is no value;
//   - boards and prompts that named it name the attribute by its number, and its values by theirs.
//
// `emails.priority` remains, for the version before: it writes it, and reads it. That version
// also shows a priority of its own beside this one, with no rule, until it is gone. This
// version neither reads nor writes the column.
import type { Migration } from '../migrations.ts';

/** The value 1, 2 or 3 that a text holding 'high', 'normal' or 'low' becomes. */
const numbered = (text: string): string => `CASE ${text} WHEN 'high' THEN '1' WHEN 'normal' THEN '2' WHEN 'low' THEN '3' ELSE ${text} END`;

/** A list of the values as they were named, as a list of their numbers. */
const numberedList = (list: string): string => `(SELECT COALESCE(jsonb_agg(${numbered('v')}), '[]'::jsonb) FROM jsonb_array_elements_text(${list}) AS t(v))`;

/** The colour kept for a value, or the one it started with. */
const colorOf = (key: string, first: string): string => `COALESCE((SELECT c ->> 'color' FROM jsonb_array_elements(a.values_json::jsonb) AS c WHERE c ->> 'key' = '${key}'), '${first}')`;

/** A name in English or, on a row the statement before marked as read in French, in French. */
const named = (english: string, french: string): string => `CASE a.name WHEN 'Priorité' THEN '${french}' ELSE '${english}' END`;

const value = (key: string, label: string, was: string, first: string): string => `jsonb_build_object('key', '${key}', 'label', ${label}, 'color', ${colorOf(was, first)})`;

/** A board's conditions on the priority, under `path`: named by the number of the attribute. */
const boards = (path: string[]): string => `
UPDATE boards b SET filter_json = jsonb_set(b.filter_json::jsonb #- '{${[...path, 'priority'].join(',')}}', ARRAY[${path.map((step) => `'${step}'`).join(', ')}, a.id::text], ${numberedList(`b.filter_json::jsonb #> '{${[...path, 'priority'].join(',')}}'`)})::text
  FROM attributes a WHERE a.org_id = b.org_id AND a.key = 'priority' AND jsonb_typeof(b.filter_json::jsonb #> '{${[...path, 'priority'].join(',')}}') = 'array'`;

const sql = `
INSERT INTO attributes (org_id, key, name, decided_by, elo)
  SELECT o.id, 'priority', 'priority', 'nobody', '' FROM organizations o WHERE NOT EXISTS (SELECT 1 FROM attributes a WHERE a.org_id = o.id AND a.key = 'priority');
UPDATE emails e SET attributes_json = ((e.attributes_json::jsonb - 'priority') || jsonb_build_object(a.id::text, CASE
    WHEN e.attributes_json::jsonb -> 'priority' ->> 'value' IS NOT NULL THEN jsonb_set(e.attributes_json::jsonb -> 'priority', '{value}', to_jsonb(${numbered("e.attributes_json::jsonb -> 'priority' ->> 'value'")}))
    ELSE jsonb_build_object('value', ${numbered('e.priority')}, 'source', 'nobody') END))::text
  FROM accounts m, attributes a
  WHERE m.id = e.account_id AND a.org_id = m.org_id AND a.key = 'priority' AND (e.attributes_json::jsonb -> 'priority' ->> 'value' IS NOT NULL OR e.priority <> 'normal');
UPDATE emails SET attributes_json = (attributes_json::jsonb - 'priority')::text WHERE attributes_json::jsonb -> 'priority' IS NOT NULL;
${boards(['attributes'])};
${boards(['except', 'attributes'])};
UPDATE prompts p SET affinity_json = ((p.affinity_json::jsonb - 'priority') || jsonb_build_object(a.id::text, ${numberedList("p.affinity_json::jsonb -> 'priority'")}))::text
  FROM attributes a WHERE a.org_id = p.org_id AND a.key = 'priority' AND jsonb_typeof(p.affinity_json::jsonb -> 'priority') = 'array';
UPDATE attributes a SET name = 'Priorité'
  WHERE a.key = 'priority' AND a.elo = '' AND (SELECT u.language FROM users u WHERE u.org_id = a.org_id ORDER BY (u.role = 'admin') DESC, u.id LIMIT 1) LIKE 'fr%';
UPDATE attributes a SET key = NULL, name = ${named('Priority', 'Priorité')}, kind = 'choice',
  values_json = jsonb_build_array(${value('1', named('High', 'Haute'), 'high', 'red')}, ${value('2', named('Normal', 'Normale'), 'normal', 'grey')}, ${value('3', named('Low', 'Basse'), 'low', 'blue')})::text
  WHERE a.key = 'priority';
`;

export const priorityIsAnAttributeLikeAnyOther: Migration = { id: '0006-priority-is-an-attribute-like-any-other', sql };
