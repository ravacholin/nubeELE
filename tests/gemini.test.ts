import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { test } from 'node:test';
import app from '../server.js';

test('validates and generates with available Gemini models when the fixed model is unavailable', async () => {
  const calls: string[] = [];
  const google = http.createServer((req, res) => {
    calls.push(`${req.method} ${req.url}`);
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET' && req.url?.startsWith('/v1beta/models')) {
      res.end(JSON.stringify({ models: [{ name: 'models/gemini-current-flash', supportedGenerationMethods: ['generateContent'] }] }));
    } else if (req.url?.includes('gemini-current-flash:generateContent')) {
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ title: 'Viajes', words: [{ id: 'g1', word: 'el viaje', lemma: 'viaje', article: 'el', category: 'sustantivo', level: 'A2', weight: 3, meaning: 'Traslado a otro lugar.', example: 'Mi viaje empieza mañana.' }] }) }] } }] }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { code: 404, status: 'NOT_FOUND', message: 'Requested model is not found for API version v1beta.' } }));
    }
  });
  const api = app.listen(0, '127.0.0.1');
  google.listen(0, '127.0.0.1');
  await Promise.all([once(google, 'listening'), once(api, 'listening')]);
  const googleAddress = google.address();
  const apiAddress = api.address();
  assert.ok(googleAddress && typeof googleAddress !== 'string');
  assert.ok(apiAddress && typeof apiAddress !== 'string');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === 'generativelanguage.googleapis.com') {
      url.protocol = 'http:';
      url.host = `127.0.0.1:${googleAddress.port}`;
      return originalFetch(url, init);
    }
    return originalFetch(input, init);
  };
  try {
    const base = `http://127.0.0.1:${apiAddress.port}`;
    const headers = { 'Content-Type': 'application/json', 'x-gemini-api-key': 'AIzaSy-test-fixture-only' };
    const validation = await originalFetch(base + '/api/validate-key', { method: 'POST', headers, body: '{}' });
    const validated = await validation.json();
    assert.equal(validation.status, 200, JSON.stringify(validated));
    assert.equal(validated.success, true);
    assert.ok(calls.every(call => call.startsWith('GET ')), 'Key validation must not consume generation quota');
    const response = await originalFetch(base + '/api/generate-cloud', { method: 'POST', headers, body: JSON.stringify({ prompt: 'viajes interplanetarios' }) });
    const cloud = await response.json();
    assert.equal(response.status, 200);
    assert.equal(cloud.source, 'gemini');
    assert.equal(cloud.modelUsed, 'gemini-current-flash');
    assert.equal(cloud.data.words[0].lemma, 'viaje');
  } finally {
    globalThis.fetch = originalFetch;
    await Promise.all([api, google].map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
  }
});
