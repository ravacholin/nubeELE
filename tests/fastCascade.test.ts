import assert from 'node:assert/strict';
import test from 'node:test';
import { runFastCascade } from '../src/server/fastCascade.js';

test('falls back on quota failure and skips that model only for the same credential', async () => {
  const cooldowns = new Map<string, number>();
  const calls: string[] = [];
  const generate = async (model: string) => {
    calls.push(model);
    if (model === 'lite') throw Object.assign(new Error('quota'), { status: 429 });
    return 'content';
  };
  assert.equal((await runFastCascade(['lite', 'flash'], generate, cooldowns))?.modelUsed, 'flash');
  await runFastCascade(['lite', 'flash'], generate, cooldowns);
  assert.deepEqual(calls, ['lite', 'flash', 'flash']);
  await runFastCascade(['lite', 'flash'], generate, new Map());
  assert.equal(calls.filter(model => model === 'lite').length, 2);
});

test('aborts a hanging attempt and reaches a healthy fallback within its budget', async () => {
  let aborted = false;
  const result = await runFastCascade(['hung', 'healthy'], async (model, signal) => {
    if (model === 'healthy') return 'words';
    signal.addEventListener('abort', () => { aborted = true; });
    return new Promise<string>(() => {});
  }, new Map(), { attemptMs: 20, totalMs: 100 });
  assert.equal(aborted, true);
  assert.equal(result?.modelUsed, 'healthy');
});

test('limits attempts and stops immediately for credential errors', async () => {
  let calls = 0;
  const unavailable = async () => { calls++; throw Object.assign(new Error('busy'), { status: 503 }); };
  assert.equal(await runFastCascade(['a', 'b', 'c', 'd'], unavailable, new Map()), null);
  assert.equal(calls, 3);
  calls = 0;
  await runFastCascade(['a', 'b'], async () => { calls++; throw Object.assign(new Error('invalid'), { status: 403 }); }, new Map());
  assert.equal(calls, 1);
});
