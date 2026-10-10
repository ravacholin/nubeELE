import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';

test('Vercel handler returns a vocabulary cloud as JSON', async () => {
  const { default: app } = await import('../api/[...path].ts');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/generate-cloud`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'verduras' }),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    const result = await response.json();
    assert.equal(result.success, true);
    assert.equal(result.source, 'curated');
    assert.equal(result.data.words.length, 15);
    assert.ok(result.data.words.some((word: { lemma: string }) => word.lemma === 'zanahoria'));
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
