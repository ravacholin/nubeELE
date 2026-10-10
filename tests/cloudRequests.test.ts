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

test('streams UTF-8 words before completion, shares progress, and caches only the final cloud', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let calls = 0;
  const loader = createCloudRequests(async () => {
    calls++;
    return new Response(new ReadableStream({ start(c) { controller = c; } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
  });
  const snapshots: any[] = [];
  let finished = false;
  const first = loader('náutica', 'B1', {}, data => snapshots.push(data)).then(data => { finished = true; return data; });
  const data = { title: 'Náutica', words: [{ id: '1', word: 'el timón' }] };
  const bytes = new TextEncoder().encode(JSON.stringify({ type: 'progress', data }) + '\n');
  // Split within the accented letter to exercise incremental UTF-8 decoding.
  const split = bytes.indexOf(195) + 1;
  controller.enqueue(bytes.slice(0, split));
  controller.enqueue(bytes.slice(split));
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(finished, false);
  assert.deepEqual(snapshots, [data]);
  const joined: any[] = [];
  const second = loader('náutica', 'B1', {}, data => joined.push(data));
  assert.deepEqual(joined, [data]);
  controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'complete', success: true, source: 'gemini', data }) + '\n'));
  controller.close();
  assert.deepEqual(await first, data);
  assert.deepEqual(await second, data);
  await loader('náutica', 'B1', {});
  assert.equal(calls, 1);
});

test('truncated streams and terminal errors are never cached, reset clears partial progress', async () => {
  let calls = 0;
  const snapshots: any[] = [];
  const loader = createCloudRequests(async () => {
    calls++;
    const events = [{ type: 'progress', data: { words: [{ word: 'fallida' }] } }, { type: 'reset' }];
    if (calls === 2) events.push({ type: 'error', error: 'Temporal' } as any);
    return new Response(events.map(e => JSON.stringify(e)).join('\n'), { headers: { 'Content-Type': 'application/x-ndjson' } });
  });
  await assert.rejects(loader('tema', 'A1', {}, data => snapshots.push(data)), /interrumpió/);
  assert.equal(snapshots.at(-1), null);
  await assert.rejects(loader('tema', 'A1', {}), /Temporal/);
  assert.equal(calls, 2);
});
