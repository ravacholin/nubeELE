import assert from 'node:assert/strict';
import test from 'node:test';
import { createWordPress } from '../src/utils/wordPress.js';

test('a short press opens the card without selecting, including after a hold', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const selected: string[] = [];
  const press = createWordPress(id => selected.push(id));
  press.start('a', 10, 10);
  t.mock.timers.tick(200);
  press.end();
  assert.equal(press.allowClick(), true);
  t.mock.timers.tick(600);
  assert.deepEqual(selected, []);
  press.start('a', 10, 10);
  t.mock.timers.tick(600);
  press.end();
  assert.equal(press.allowClick(), false);
  press.start('b', 10, 10);
  t.mock.timers.tick(100);
  press.end();
  assert.equal(press.allowClick(), true);
  assert.deepEqual(selected, ['a']);
});

test('holding selects once and consumes the release click', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const selected: string[] = [];
  const press = createWordPress(id => selected.push(id));
  press.start('a', 10, 10);
  t.mock.timers.tick(499);
  assert.deepEqual(selected, []);
  t.mock.timers.tick(1);
  assert.deepEqual(selected, ['a']);
  t.mock.timers.tick(2000);
  assert.deepEqual(selected, ['a']);
  press.end();
  assert.equal(press.allowClick(), false);
  assert.equal(press.allowClick(), true, 'A later keyboard activation remains available');
});

test('moving or cancelling a press never selects or opens a card', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const selected: string[] = [];
  const press = createWordPress(id => selected.push(id));
  for (const cancel of [false, true]) {
    press.start('a', 10, 10);
    t.mock.timers.tick(100);
    if (cancel) press.cancel();
    else { press.move(30, 10); press.move(10, 10); }
    t.mock.timers.tick(700);
    press.end();
    assert.equal(press.allowClick(), false);
    assert.deepEqual(selected, []);
  }
});

test('minor finger movement allows a hold and a new press cancels the older timer', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const selected: string[] = [];
  const press = createWordPress(id => selected.push(id));
  press.start('a', 10, 10);
  t.mock.timers.tick(300);
  press.start('b', 10, 10);
  press.move(13, 12);
  t.mock.timers.tick(500);
  assert.deepEqual(selected, ['b']);
});
