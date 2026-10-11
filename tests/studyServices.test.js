import test from 'node:test';
import assert from 'node:assert/strict';
import { getLexicalVerse, getDictionaryEntry, getCommentary, getTopics, getTopic, getDailyDiscovery } from '../src/getBibleService.js';
import { getCrossReferences } from '../src/bibleDataService.js';

test('study lookups use verse-linked lexical and commentary records', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  try {
    globalThis.fetch = async (url) => {
      urls.push(url);
      let data;
      if (url.includes('/v3/kjv/43/3.json')) data = { verses: [{ verse: 16, tokens: [{ token: 'loved', lemma: { strong: ['G25'] } }] }] };
      else if (url.includes('/strongsgreek/G25.json')) data = { id: 'G25', text: 'Definition from source' };
      else data = { entries: [{ verse: 15, text: 'Other' }, { verse: 16, text: 'Comment on verse 16' }] };
      return { ok: true, json: async () => data };
    };
    assert.equal((await getLexicalVerse(43, 3, 16)).tokens[0].lemma.strong[0], 'G25');
    assert.equal((await getDictionaryEntry('G25')).text, 'Definition from source');
    assert.deepEqual((await getCommentary(43, 3, 16)).map((entry) => entry.text), ['Comment on verse 16']);
    assert.ok(urls.some((url) => url.endsWith('/clarke/43/3.json')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('commentary lookup includes every covered verse and excludes unrelated entries', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ entries: [
        { verse: 14, verses: [14, 15, 16], text: 'Covers verses 14 through 16' },
        { verse: 16, text: 'Only verse 16' },
        { verse: 17, text: 'Unrelated verse' },
      ] }),
    });
    assert.deepEqual((await getCommentary(43, 3, 16)).map((entry) => entry.text), [
      'Covers verses 14 through 16',
      'Only verse 16',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('topic catalog and topic verses come from GetBible', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => ({
      ok: true,
      json: async () => url.endsWith('/topics.json')
        ? { topics: [{ id: 'grace', name: 'Grace', verses: 2 }] }
        : { id: 'grace', name: 'Grace', verses: [[43, 3, 16]] },
    });
    assert.equal((await getTopics())[0].id, 'grace');
    assert.deepEqual((await getTopic('grace')).verses[0], [43, 3, 16]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cross references map API book IDs to canonical book numbers', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => ({
      ok: true,
      json: async () => url.endsWith('/books.json')
        ? { books: [{ id: 'JHN', order: 43 }, { id: 'ROM', order: 45 }] }
        : { chapter: { content: [{ verse: 16, references: [{ book: 'ROM', chapter: 5, verse: 8, score: 4 }] }] } },
    });
    assert.deepEqual(await getCrossReferences(43, 3, 16), [{ bookNumber: 45, chapter: 5, verse: 8, endVerse: null }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('daily discovery uses a dated GetBible topic and real verse text', async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  try {
    globalThis.fetch = async (url) => {
      requested.push(url);
      let data;
      if (url.includes('/topics/')) data = { name: 'Grace', verses: [[43, 3, 16]] };
      else if (url.endsWith('/books.json')) data = { 43: { nr: 43, name: 'John' } };
      else data = { web_43_3: { book_name: 'John', chapter: 3, verses: [{ verse: 16, text: 'Real verse text' }] } };
      return { ok: true, json: async () => data };
    };
    assert.deepEqual(await getDailyDiscovery(new Date(2026, 9, 11), 'web'), {
      reference: 'John 3:16', text: 'Real verse text', topic: 'Grace',
    });
    assert.ok(requested.some((url) => url.includes('/v2/web/books.json')));
    assert.ok(requested.some((url) => url.includes('/v2/web/John%203%3A16')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
