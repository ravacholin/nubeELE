import assert from 'node:assert/strict';
import test from 'node:test';
import { createWordDetailRequests } from '../src/utils/wordDetails.js';
import type { WordItem } from '../src/types.js';

test('detail cache shares prefetch with selection, separates senses and credentials, and retries errors', async () => {
  let calls = 0;
  let fail = false;
  let clock = 0;
  const word = { id: 'bank', lemma: 'banco', level: 'A2', category: 'sustantivo' } as WordItem;
  const load = createWordDetailRequests(async () => {
    calls++;
    if (fail) return Response.json({ success: false, error: 'Temporal' }, { status: 503 });
    return Response.json({ success: true, data: { meaning: 'Entidad financiera.', example: 'Voy al banco.', synonyms: ['entidad'] } });
  }, () => clock);
  const [a, b] = await Promise.all([load(word, 'finanzas', {}), load(word, 'finanzas', {})]);
  assert.equal(calls, 1);
  a.meaning = 'changed';
  assert.notEqual(a.meaning, b.meaning);
  await load(word, 'finanzas', {});
  assert.equal(calls, 1);
  await load(word, 'muebles', {});
  await load(word, 'finanzas', { 'x-gemini-api-key': 'other-key' });
  assert.equal(calls, 3);
  clock = 10 * 60_000 + 1;
  fail = true;
  await assert.rejects(load(word, 'finanzas', {}), /Temporal/);
  fail = false;
  await load(word, 'finanzas', {});
  assert.equal(calls, 5);
});
