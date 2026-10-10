import assert from 'node:assert/strict';
import test from 'node:test';
import { completeWords } from '../src/server/partialCloud.js';

test('progress contains only complete objects, even with escaped quotes and braces', () => {
  const words = [{ word: 'la señal "} ]"', lemma: 'señal' }, { word: 'el avión', lemma: 'avión' }];
  const json = JSON.stringify({ words, title: 'Viajes' });
  for (let length = 0; length <= json.length; length++) {
    const found = completeWords(json.slice(0, length));
    assert.deepEqual(found, words.slice(0, found.length));
  }
  assert.equal(completeWords(json.slice(0, json.indexOf(',{"word"'))).length, 1);
  assert.deepEqual(completeWords(json), words);
});
