import assert from 'node:assert/strict';
import test from 'node:test';
import { appendCloudWords, changeCloudFocus, replaceSelectedWords, keepSelectedWords, MAX_CLOUD_WORDS } from '../src/utils/cloudWords.js';
import type { WordItem } from '../src/types.js';

const word = (index: number): WordItem => ({
  id: `word-${index}`, word: `término ${index}`, lemma: `término ${index}`,
  article: null, category: 'expresion', level: 'B1', weight: 3,
  meaning: '', example: '',
});

test('the cloud grows past fifteen terms and replaces the oldest only at capacity', () => {
  let cloud = Array.from({ length: 15 }, (_, index) => word(index));
  cloud = appendCloudWords(cloud, [word(15), word(16)]);
  assert.equal(cloud.length, 17);

  for (let index = 17; index < MAX_CLOUD_WORDS + 12; index++) {
    cloud = appendCloudWords(cloud, [word(index)]);
    assert.ok(cloud.length <= MAX_CLOUD_WORDS);
  }
  assert.deepEqual(cloud.map(item => item.id),
    Array.from({ length: MAX_CLOUD_WORDS }, (_, index) => word(index + 12).id));
});

test('repeated terms do not evict words or reset their arrival order', () => {
  const cloud = Array.from({ length: MAX_CLOUD_WORDS }, (_, index) => word(index));
  const repeated = { ...word(0), id: 'duplicate', lemma: '  TÉRMINO 0  ' };
  assert.strictEqual(appendCloudWords(cloud, [repeated]), cloud);
  const updated = appendCloudWords(cloud, [repeated, word(MAX_CLOUD_WORDS), word(MAX_CLOUD_WORDS)]);
  assert.equal(updated.length, MAX_CLOUD_WORDS);
  assert.equal(updated[0].id, word(1).id);
  assert.equal(updated.at(-1)?.id, word(MAX_CLOUD_WORDS).id);
});

test('a large incoming batch keeps only the newest terms without changing the inputs', () => {
  const saved = { ...word(0), isFavorite: true };
  const current = [saved];
  const additions = Array.from({ length: MAX_CLOUD_WORDS + 5 }, (_, index) => word(index + 1));
  const updated = appendCloudWords(current, additions);
  assert.equal(updated.length, MAX_CLOUD_WORDS);
  assert.equal(updated[0].id, word(6).id);
  assert.deepEqual(current, [saved]);
  assert.equal(saved.isFavorite, true);
  assert.equal(additions.length, MAX_CLOUD_WORDS + 5);
});

test('switching to verbs removes ingredients and rejects unrelated categories in the response', () => {
  const ingredient = { ...word(0), category: 'sustantivo' as const };
  const verb = { ...word(1), category: 'verbo' as const };
  const nextVerb = { ...word(2), category: 'verbo' as const };
  assert.deepEqual(changeCloudFocus([ingredient, verb], [ingredient, nextVerb], 'verbs'), [verb, nextVerb]);
  assert.deepEqual(changeCloudFocus([verb], [word(3)], 'expressions'), [word(3)]);
  assert.deepEqual(changeCloudFocus([verb], [{ ...word(4), level: 'B2' }], 'advanced').map(w => w.id), [word(4).id]);
});

test('selected terms survive a new search and automatic eviction with their details intact', () => {
  const retained = { ...word(0), meaning: 'Keep my completed card' };
  const selected = new Set([retained.id]);
  const incoming = Array.from({ length: MAX_CLOUD_WORDS + 5 }, (_, index) => word(index + 1));
  const updated = keepSelectedWords([retained, word(99)], incoming, selected);
  assert.equal(updated.length, MAX_CLOUD_WORDS);
  assert.strictEqual(updated[0], retained);
  assert.ok(!updated.some(w => w.id === word(99).id));
  const expanded = appendCloudWords(updated, [word(100)], selected);
  assert.strictEqual(expanded[0], retained);
  assert.equal(expanded.length, MAX_CLOUD_WORDS);
  assert.equal(expanded.at(-1)?.id, word(100).id);
});

test('regeneration changes only selected terms and preserves all others in place', () => {
  const current = [word(0), word(1), word(2), word(3)];
  const selected = new Set([word(1).id, word(3).id]);
  const updated = replaceSelectedWords(current, [word(0), word(8), word(9), word(10)], selected);
  assert.deepEqual(updated, [current[0], word(8), current[2], word(9)]);
  assert.strictEqual(updated[0], current[0]);
  assert.strictEqual(updated[2], current[2]);
  assert.deepEqual(replaceSelectedWords(current, [word(8)], selected), [current[0], word(8), current[2], current[3]]);
  assert.strictEqual(replaceSelectedWords(current, [], selected), current);
});
