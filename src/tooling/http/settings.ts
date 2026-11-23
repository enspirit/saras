// Routes: a member's own settings and their organisation's. The operations are in
// domain/settings: each field sent is one of them, applied in the order written here; a field
// that is refused stops there, and those before it stay applied.
import { profileOf } from '../../domain/observations/profile.ts';
import { chooseLanguage } from '../../domain/settings/choose-language.ts';
import { chooseSorting } from '../../domain/settings/choose-sorting.ts';
import { chooseWriting } from '../../domain/settings/choose-writing.ts';
import { renameOrganization } from '../../domain/settings/rename-organization.ts';
import { setAsideAutomatedFirst } from '../../domain/settings/set-aside-automated-first.ts';
import { setOrganizationKey } from '../../domain/settings/set-organization-key.ts';
import { setOrganizationModel } from '../../domain/settings/set-organization-model.ts';
import { setOwnName } from '../../domain/settings/set-own-name.ts';
import { setSignature } from '../../domain/settings/set-signature.ts';
import { sortAgainUnsorted } from '../../domain/sorting/sort-again-unsorted.ts';
import { actorOf, done } from './route.ts';
import type { Handle, Route } from './route.ts';

const profile: Handle = ({ world }, req, res) => void res.json(profileOf(world, actorOf(req)));

const ownSettings: Handle = async ({ world }, req, res) => {
  const { signature, language, name } = req.body;
  const actor = actorOf(req);
  if (typeof name === 'string') await setOwnName(world, actor, name);
  if (typeof language === 'string') await chooseLanguage(world, actor, language);
  if (typeof signature === 'string') await setSignature(world, actor, signature);
  done(res);
};

const organizationSettings: Handle = async ({ world }, req, res) => {
  const { name, sorting, writing, skipAutomated, model, openrouterKey } = req.body;
  const actor = actorOf(req);
  if (typeof name === 'string') await renameOrganization(world, actor, name);
  if (sorting !== undefined) await chooseSorting(world, actor, sorting);
  if (writing !== undefined) await chooseWriting(world, actor, writing);
  if (typeof skipAutomated === 'boolean') await setAsideAutomatedFirst(world, actor, skipAutomated);
  if (typeof model === 'string') await setOrganizationModel(world, actor, model);
  if (typeof openrouterKey === 'string') await setOrganizationKey(world, actor, openrouterKey);
  done(res);
};

const sortAgain: Handle = async ({ world }, req, res) => {
  await sortAgainUnsorted(world, actorOf(req));
  done(res);
};

export const SETTINGS: Route[] = [
  { method: 'get', path: '/me', handle: profile },
  { method: 'put', path: '/settings', handle: ownSettings },
  { method: 'put', path: '/organization', handle: organizationSettings, for: 'administrators' },
  { method: 'post', path: '/organization/sort-again', handle: sortAgain, for: 'administrators' },
];
