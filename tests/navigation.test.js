import test from 'node:test';
import assert from 'node:assert/strict';
import { appUrl, passageUrl } from '../src/utils.js';

test('application URLs stay inside the configured base', () => {
  assert.equal(appUrl('', '/project/'), '/project/');
  assert.equal(appUrl('search.html?q=faith', '/project/'), '/project/search.html?q=faith');
  assert.equal(appUrl('/#topics', '/project/'), '/project/#topics');
  assert.equal(appUrl('saved.html', '/'), '/saved.html');
});

test('passage URLs encode the reference', () => {
  assert.equal(passageUrl('John 3:16'), '/bible.html?ref=John%203%3A16');
});
