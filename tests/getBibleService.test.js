import test from 'node:test';
import assert from 'node:assert/strict';
import { getBooks, getChapters, getPassage, searchScripture } from '../src/getBibleService.js';

function mockResponse(data, status = 200) {
  globalThis.fetch = async () => ({ ok: status === 200, status, json: async () => data });
}

test('book and chapter indexes use their numeric order', async () => {
  const originalFetch = globalThis.fetch;
  try {
    mockResponse({ 2: { nr: 2, name: 'Exodus' }, 1: { nr: 1, name: 'Genesis' } });
    assert.deepEqual(await getBooks(), [
      { number: 1, name: 'Genesis' },
      { number: 2, name: 'Exodus' },
    ]);
    mockResponse({ 3: {}, 1: {}, 2: {} });
    assert.deepEqual(await getChapters(1), [1, 2, 3]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('passage lookup keeps the selected verse text and chapter', async () => {
  const originalFetch = globalThis.fetch;
  try {
    mockResponse({
      kjv_43_3: { book_name: 'John', chapter: 3, verses: [{ verse: 16, text: 'For God so loved the world.' }] },
      kjv_43_4: { book_name: 'John', chapter: 4, verses: [{ verse: 1, text: 'When therefore the Lord knew.' }] },
    });
    const passage = await getPassage('John 3:16-4:1');
    assert.equal(passage.verses.length, 2);
    assert.deepEqual(passage.verses[1], { number: 1, text: 'When therefore the Lord knew.', chapter: 4, book: 'John' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('chapter lookup loads the complete chapter after resolving its book', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => ({
      ok: true,
      json: async () => url.includes('query.getbible.net')
        ? { kjv_43_3: { book_nr: 43, chapter: 3, book_name: 'John', verses: [{ verse: 1, text: 'First verse' }] } }
        : { book_nr: 43, chapter: 3, book_name: 'John', verses: [{ verse: 1, text: 'First verse' }, { verse: 2, text: 'Second verse' }] },
    });
    const passage = await getPassage('John 3');
    assert.equal(passage.verses.length, 2);
    assert.equal(passage.verses[1].text, 'Second verse');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('search follows match order and finds verses by number', async () => {
  const originalFetch = globalThis.fetch;
  try {
    mockResponse({
      query: { kind: 'search', total: 1, has_more: false },
      matches: [{ reference: 'John 3:16', book_nr: 43, chapter: 3, verse: 16 }],
      results: { kjv_43_3: { verses: [{ verse: 15, text: 'Other verse' }, { verse: 16, text: 'Matching verse' }] } },
    });
    assert.deepEqual((await searchScripture('love')).matches, [{ reference: 'John 3:16', text: 'Matching verse' }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('missing passages report an error', async () => {
  const originalFetch = globalThis.fetch;
  try {
    mockResponse({ detail: 'Reference not found.' }, 404);
    await assert.rejects(getPassage('Unknown 1:1'), /Reference not found/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
