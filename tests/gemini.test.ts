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
      const names = String(req.headers['x-goog-api-key']).includes('fast-fixture')
        ? ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] : ['gemini-current-flash'];
      res.end(JSON.stringify({ models: names.map(name => ({ name: `models/${name}`, supportedGenerationMethods: ['generateContent'] })) }));
    } else if (req.url?.includes(':generateContent')) {
      let body = '';
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body);
      payloads.push(payload);
      if (req.url?.includes('flash-lite:')) {
        res.statusCode = 429;
        res.end(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota reached' } }));
        return;
      }
      const data = payload.generationConfig.responseSchema.properties.words
        ? { title: 'Viajes', words: [{ id: 'g1', word: 'el viaje', lemma: 'viaje', article: 'el', category: 'sustantivo', level: 'A2', weight: 3 }] }
        : { meaning: 'Traslado a otro lugar.', example: 'Mi viaje empieza mañana.', synonyms: ['recorrido'], translationEn: 'trip', collocation: 'hacer un viaje', pronunciationHint: 'VIA-je' };
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }] }));
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
    assert.equal(cloud.data.words[0].detailsPending, true);
    assert.equal(cloud.data.words[0].meaning, '');
    assert.equal(payloads[0].generationConfig.responseSchema.properties.words.items.properties.meaning, undefined, 'The first request never asks for full cards');
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
    const details = await originalFetch(base + '/api/word-details', {
      method: 'POST', headers: { ...headers, 'x-gemini-api-key': 'AIzaSy-fast-fixture' },
      body: JSON.stringify({ word: 'viaje', topic: 'turismo', level: 'A2' }),
    });
    const card = await details.json();
    assert.equal(details.status, 200);
    assert.equal(card.data.meaning, 'Traslado a otro lugar.');
    assert.deepEqual(card.data.synonyms, ['recorrido']);
    assert.equal(calls.filter(call => call.includes('flash-lite:generateContent')).length, 1, 'Quota-limited model is skipped for the subsequent detail call');
    assert.equal(calls.filter(call => call.startsWith('GET ')).length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    await Promise.all([api, google].map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
  }
});
