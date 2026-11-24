// Routes: the attributes an organisation gives its emails. The operations are in domain/attributes.
import { createAttribute } from '../../domain/attributes/create-attribute.ts';
import { deleteAttribute } from '../../domain/attributes/delete-attribute.ts';
import { editAttribute } from '../../domain/attributes/edit-attribute.ts';
import { setEmailAttribute } from '../../domain/attributes/set-email-attribute.ts';
import { setAttributeOfSelection } from '../../domain/attributes/set-attribute-of-selection.ts';
import { SKILL_NAME, ruleWritingSkill } from '../../domain/computations/rule-writing-skill.ts';
import { checkRule, tryRule } from '../../domain/observations/attributes.ts';
import { sortAgainByRule } from '../../domain/sorting/sort-again-by-rule.ts';
import { attributeOf, attributesOf } from '../../domain/state/attributes.ts';
import { zip } from '../zip.ts';
import { actorOf, done } from './route.ts';
import type { Handle, Route } from './route.ts';

const list: Handle = async ({ world }, req, res) => void res.json(await attributesOf(world.db, req.org));

const create: Handle = async ({ world }, req, res) => void res.status(201).json(await createAttribute(world, actorOf(req), req.body));

const edit: Handle = async ({ world }, req, res) => void res.json(await editAttribute(world, actorOf(req), req.params.key, req.body));

const remove: Handle = async ({ world }, req, res) => {
  await deleteAttribute(world, actorOf(req), req.params.key);
  done(res);
};

const tryIt: Handle = async ({ world }, req, res) => void res.json(await tryRule(world.db, actorOf(req), req.body));

const check: Handle = async (_, req, res) => void res.json(checkRule(req.body));

const sortAgain: Handle = async ({ world }, req, res) => void res.json(await sortAgainByRule(world, actorOf(req), req.params.key));

/** The skill an AI agent is handed to write a rule: a folder with its one file, as an archive to download. For one attribute, it names it and its values. */
const skill: Handle = async ({ world }, req, res) => {
  const attribute = req.params.key ? await attributeOf(world.db, req.org, req.params.key) : null;
  const archive = zip([{ path: `${SKILL_NAME}/SKILL.md`, content: ruleWritingSkill(attribute) }]);
  res.set({ 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${SKILL_NAME}.zip"` }).send(archive);
};

const setOnSelection: Handle = async ({ world }, req, res) =>
  void res.json(await setAttributeOfSelection(world, actorOf(req), req.body.selection, req.params.key, req.body.value));

const setOnEmail: Handle = async ({ world }, req, res) => {
  await setEmailAttribute(world, actorOf(req), req.params.id, req.params.key, req.body.value);
  done(res);
};

export const ATTRIBUTES: Route[] = [
  { method: 'get', path: '/attributes', handle: list },
  { method: 'post', path: '/attributes', handle: create },
  { method: 'post', path: '/attributes/try', handle: tryIt, for: 'administrators' },
  { method: 'post', path: '/attributes/check', handle: check, for: 'administrators' },
  { method: 'get', path: '/attributes/skill', handle: skill, for: 'administrators' },
  { method: 'get', path: '/attributes/:key/skill', handle: skill, for: 'administrators' },
  { method: 'put', path: '/attributes/:key', handle: edit },
  { method: 'delete', path: '/attributes/:key', handle: remove },
  { method: 'post', path: '/attributes/:key/sort-again', handle: sortAgain },
  { method: 'post', path: '/emails/selection/attributes/:key', handle: setOnSelection },
  { method: 'put', path: '/emails/:id/attributes/:key', handle: setOnEmail },
];
