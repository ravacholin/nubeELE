import assert from 'node:assert/strict';
import test from 'node:test';
import { playSpanishSpeech } from '../src/utils/audio.js';

test('offline pronunciation finishes without requesting neural audio', async (t) => {
  const descriptors = new Map(['navigator', 'window'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  t.after(() => {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const request = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  let finished = false;
  await playSpanishSpeech('embarcar', { onEnd: () => { finished = true; } });
  assert.equal(request.mock.callCount(), 0);
  assert.equal(finished, true);
});
