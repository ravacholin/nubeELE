import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

test('offline expansion respects the topic, focus, exclusions and requested replacement count', async () => {
  const { default: app } = await import('../api/[...path].ts');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const expand = async (body: object) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/expand-cloud`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    return (await response.json()).newWords;
  };
  try {
    const verbs = await expand({ topic: 'ingredientes', expansionType: 'verbs' });
    assert.ok(verbs.length > 1);
    assert.ok(verbs.every((word: any) => word.category === 'verbo' && word.article === null));
    assert.ok(verbs.some((word: any) => word.lemma === 'cocinar'));
    assert.ok(!verbs.some((word: any) => word.lemma === 'enriquecer'));
    const replacements = await expand({ topic: 'verduras', expansionType: 'verbs', existingWords: ['COCINAR'], wordCount: 2 });
    assert.equal(replacements.length, 2);
    assert.ok(!replacements.some((word: any) => word.lemma === 'cocinar'));
    const expressions = await expand({ topic: 'verduras', expansionType: 'expressions' });
    assert.ok(expressions.length > 0);
    assert.ok(expressions.every((word: any) => word.category === 'expresion'));
    const advanced = await expand({ topic: 'verduras', expansionType: 'advanced' });
    assert.ok(advanced.length > 0);
    assert.ok(advanced.every((word: any) => ['B2', 'C1'].includes(word.level)));
    const travel = await expand({ topic: 'viajes', wordCount: 2, existingWords: [
      'billete de ida y vuelta', 'andén', 'facturar', 'alojamiento', 'embarcar', 'retraso', 'recorrer',
    ] });
    assert.equal(travel.length, 2, 'A selected travel term can be renewed after the initial curated cloud');
    assert.deepEqual(await expand({ topic: 'tema sin banco léxico', expansionType: 'verbs' }), []);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
