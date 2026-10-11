import assert from 'node:assert/strict';
import test from 'node:test';
import { readCloudSnapshot, saveCloudSnapshot, type CloudSnapshot } from '../src/utils/cloudSnapshot.js';

const cloud: CloudSnapshot = {
  version: 1, topic: 'viajes', focus: 'verbs',
  cloud: { title: 'Viajes', summary: '', suggestedTopics: [], challenge: '', words: [{
    id: 'travel1', word: 'embarcar', lemma: 'embarcar', article: null, category: 'verbo',
    level: 'A2', weight: 4, meaning: 'Subir a bordo.', example: 'Vamos a embarcar.', isFavorite: true,
  }] },
};
const memoryStorage = () => {
  let content: string | null = null;
  return { getItem: () => content, setItem: (_key: string, value: string) => { content = value; } };
};

test('the last cloud survives a reload with its topic, focus, cards and favorites', () => {
  const storage = memoryStorage();
  saveCloudSnapshot(cloud, storage);
  assert.deepEqual(readCloudSnapshot(storage), cloud);
  saveCloudSnapshot({ ...cloud, topic: 'cocina', cloud: { ...cloud.cloud, words: [] } }, storage);
  assert.equal(readCloudSnapshot(storage)?.topic, 'cocina');
  assert.deepEqual(readCloudSnapshot(storage)?.cloud.words, [], 'A deliberately cleared board stays cleared');
});

test('invalid or old snapshots cannot prevent the app from opening', () => {
  const storage = memoryStorage();
  for (const value of ['{bad JSON', '{}', JSON.stringify({ ...cloud, version: 2 }), JSON.stringify({ ...cloud, focus: 'invalid' }), JSON.stringify({ ...cloud, cloud: { ...cloud.cloud, words: [{ id: null }] } })]) {
    storage.setItem('', value);
    assert.equal(readCloudSnapshot(storage), null);
  }
});

test('unavailable or full browser storage leaves the app usable', () => {
  const storage = { getItem() { throw new Error('Private browser'); }, setItem() { throw new Error('Quota exceeded'); } };
  assert.equal(readCloudSnapshot(storage), null);
  assert.doesNotThrow(() => saveCloudSnapshot(cloud, storage));
});
