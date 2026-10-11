import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStudyState, saveStudyState } from '../src/storage.js';

test('study state preserves valid tabs, saved verses, history, and translation', () => {
  const previousStorage = globalThis.localStorage;
  let stored = JSON.stringify({
    openPassages: ['John 3:16', 'Romans 8:28', 'John 3:16'],
    activePassage: 'Romans 8:28',
    savedPassages: ['John 3:16'],
    recentPassages: ['Romans 8:28'],
    translation: 'web',
  });
  globalThis.localStorage = {
    getItem: () => stored,
    setItem: (_, value) => { stored = value; },
  };
  try {
    const state = loadStudyState();
    assert.deepEqual(state.openPassages, ['John 3:16', 'Romans 8:28']);
    assert.equal(state.activePassage, 'Romans 8:28');
    assert.deepEqual(state.savedPassages, ['John 3:16']);
    assert.equal(state.translation, 'web');
    state.savedPassages.push('Genesis 1:1');
    saveStudyState(state);
    assert.deepEqual(loadStudyState().savedPassages, ['John 3:16', 'Genesis 1:1']);
  } finally {
    globalThis.localStorage = previousStorage;
  }
});

test('invalid stored state falls back to a usable workspace', () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ openPassages: [], activePassage: 'Missing 1:1', savedPassages: null, translation: 'unknown' }),
  };
  try {
    const state = loadStudyState();
    assert.deepEqual(state.openPassages, ['John 3:16']);
    assert.equal(state.activePassage, 'John 3:16');
    assert.deepEqual(state.savedPassages, []);
    assert.equal(state.translation, 'kjv');
  } finally {
    globalThis.localStorage = previousStorage;
  }
});
