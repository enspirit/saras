// What an operation is given is checked against the type the specification gives its input,
// before the operation sees it: the specification and the server read one text.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Request } from 'express';
import { parse } from 'yaml';
import { Refusal } from '../../src/domain/refusal.ts';
import { checkOf, givenBy } from '../../src/tooling/http/inputs.ts';
import { ROUTES } from '../../src/tooling/http/server.ts';
import { readSpecification } from '../../src/tooling/specification.ts';

const specification = readSpecification();
const request = (method: string, sent: unknown, params: Record<string, string> = {}): Request => ({ method, params, query: method === 'GET' ? sent : {}, body: method === 'GET' ? undefined : sent }) as unknown as Request;

/** What a check says of an input: what it is converted to, or the code it is refused with. */
function said(type: string, input: unknown): unknown {
  try {
    return checkOf(specification, type)(request('POST', input));
  } catch (error) {
    if (error instanceof Refusal) return `${error.kind} ${error.problem.code} ${JSON.stringify(error.problem.params)}`;
    throw error;
  }
}

test('a request gives what it sends, its query for a read, with the parameters of its path', () => {
  assert.deepEqual(givenBy(request('PUT', { name: 'x', id: 7 }, { id: '3' })), { name: 'x', id: '3' }, 'the path names what is acted on, whatever the body says');
  assert.deepEqual(givenBy(request('GET', { search: 'devis' }, { id: '3' })), { search: 'devis', id: '3' });
  assert.deepEqual(givenBy(request('POST', [1, 2])), [1, 2], 'what is not a record is given as it is, for the type to refuse');
});

test('what fits is converted to the type: a number of a path, a flag of a query', () => {
  assert.deepEqual(said('BoardNamed', { id: '3' }), { id: 3 });
  assert.deepEqual(said('BoardAsked', { id: '3', search: 'devis' }), { id: 3, search: 'devis' });
});

test('what does not fit is refused as invalid, by where it is, and never by what was given', () => {
  assert.equal(said('BoardNamed', { id: 'abc' }), 'invalid request.invalid {"at":".id"}');
  assert.equal(said('BoardNamed', { id: 0 }), 'invalid request.invalid {"at":".id"}');
  assert.equal(said('BoardGiven', { name: 'x', shared: 'yes', filter: {} }), 'invalid request.invalid {"at":".shared"}');
  assert.equal(said('BoardGiven', { name: 'x', shared: false, filter: {}, owner: 2 }), 'invalid request.invalid {"at":".owner"}');
  assert.equal(said('BoardGiven', { name: 'x', shared: false }), 'invalid request.invalid {"at":".filter"}');
  assert.equal(said('BoardGiven', 'x'), 'invalid request.invalid {"at":"."}');
  assert.equal(said('FilterGiven', { filter: { mailbox: [3, 3] } }), 'invalid request.invalid {"at":".filter.mailbox"}');
});

test('a constraint labelled with a code of the server is refused with it', () => {
  assert.equal(said('BoardGiven', { name: '  ', shared: false, filter: {} }), 'invalid boards.nameRequired {}');
});

/** The operations a route serves, with what the specification says of each. */
const served = ROUTES.flatMap((route) => ('operation' in route ? [route.operation] : []));

type Case = { when: string; input?: unknown; then: string };
const casesOf = (name: string): { input?: string; examples?: Case[]; counterexamples?: Case[] } => parse(readFileSync(specification.operations.get(name)!.file, 'utf8'));

test('the input of every example of an operation served is of its type; a counterexample the type refuses is refused with the code it says', () => {
  const misfits = served.flatMap((name) => {
    const { input, examples = [], counterexamples = [] } = casesOf(name);
    if (!input) return [];
    const refusedExamples = examples.filter((example) => typeof said(input, example.input ?? {}) === 'string').map((example) => `${name}, ${example.when}: ${said(input, example.input ?? {})}`);
    const otherwise = counterexamples.flatMap((counter) => {
      const refused = said(input, counter.input ?? {});
      return typeof refused === 'string' && refused.split(' ')[1] !== counter.then.split(' ')[1] ? [`${name}, ${counter.when}: ${refused}, not ${counter.then}`] : [];
    });
    return [...refusedExamples, ...otherwise];
  });
  assert.deepEqual(misfits, []);
});
