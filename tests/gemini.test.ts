import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { test } from 'node:test';
import app from '../server.js';

test('validates and generates with available Gemini models when the fixed model is unavailable', async () => {
  const calls: string[] = [];
  const payloads: any[] = [];
  const google = http.createServer(async (req, res) => {
    calls.push(`${req.method} ${req.url}`);
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET' && req.url?.startsWith('/v1beta/models')) {
      res.end(JSON.stringify({ models: [{ name: String(req.headers['x-goog-api-key']).includes('fast-fixture') ? 'models/gemini-2.5-flash' : 'models/gemini-current-flash', supportedGenerationMethods: ['generateContent'] }] }));
    } else if (req.url?.includes(':generateContent')) {
      let body = '';
      for await (const chunk of req) body += chunk;
      payloads.push(JSON.parse(body));
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
    const second = await originalFetch(base + '/api/generate-cloud', { method: 'POST', headers, body: JSON.stringify({ prompt: 'otra temática espacial' }) });
    assert.equal((await second.json()).source, 'gemini');
    assert.equal(calls.filter(call => call.startsWith('GET ')).length, 1, 'Validation warms the model list for later generations');
    assert.equal(payloads[0].generationConfig.thinkingConfig, undefined, 'Unknown models keep supported defaults');
    await originalFetch(base + '/api/validate-key', { method: 'POST', headers, body: '{}' });
    assert.equal(calls.filter(call => call.startsWith('GET ')).length, 2, 'Explicit validation must always contact Google');
    const fast = await originalFetch(base + '/api/generate-cloud', {
      method: 'POST', headers: { ...headers, 'x-gemini-api-key': 'AIzaSy-fast-fixture' },
      body: JSON.stringify({ prompt: 'vocabulario de astronomía' }),
    });
    assert.equal((await fast.json()).modelUsed, 'gemini-2.5-flash');
    assert.equal(calls.filter(call => call.startsWith('GET ')).length, 3, 'Model catalogs are isolated by API key');
    assert.equal(payloads.at(-1).generationConfig.thinkingConfig.thinkingBudget, 0);
  } finally {
    globalThis.fetch = originalFetch;
    await Promise.all([api, google].map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
  }
});
