import assert from 'node:assert/strict';
import test from 'node:test';
import { createCloudRequests } from '../src/utils/cloudRequests.js';

test('reuses recent clouds, coalesces duplicates, and isolates keys and levels', async () => {
  let calls = 0;
  let clock = 0;
  const loader = createCloudRequests(async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json({ success: true, source: 'gemini', data: { title: 'Viajes', words: [{ word: 'viaje' }] } });
  }, () => clock);
  const headers = { 'x-gemini-api-key': 'key-a' };
  const [a, b] = await Promise.all([loader('Viajes', 'A1', headers), loader(' viajes ', 'A1', headers)]);
  assert.equal(calls, 1, 'Simultaneous equivalent queries generate once');
  a.words[0].word = 'changed';
  assert.equal(b.words[0].word, 'viaje', 'Consumers cannot mutate shared responses');
  assert.equal((await loader('VIAJES', 'A1', headers)).words[0].word, 'viaje');
  assert.equal(calls, 1);
  await loader('Viajes', 'B2', headers);
  await loader('Viajes', 'A1', { 'x-gemini-api-key': 'key-b' });
  assert.equal(calls, 3);
  clock = 5 * 60_000 + 1;
  await loader('Viajes', 'A1', headers);
  assert.equal(calls, 4, 'Expired clouds are regenerated');
});

test('temporary errors and fallback clouds can be retried immediately', async () => {
  let calls = 0;
  const loader = createCloudRequests(async () => {
    calls++;
    if (calls === 1) return Response.json({ success: false, error: 'Temporal' }, { status: 503 });
    return Response.json({ success: true, source: 'resilient-synthesizer', data: { words: [{ word: 'viaje' }] } });
  });
  await assert.rejects(loader('Viajes', 'Todos', {}), /Temporal/);
  await loader('Viajes', 'Todos', {});
  await loader('Viajes', 'Todos', {});
  assert.equal(calls, 3);
});
