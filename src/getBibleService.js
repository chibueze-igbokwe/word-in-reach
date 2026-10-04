const bibleBase = 'https://api.getbible.net/v2';
const queryBase = 'https://query.getbible.net/v2';
const searchBase = 'https://search.getbible.net/v2';
const lexicalBase = 'https://api.getbible.net/v3';
const dictionaryBase = 'https://dictionaries.getbible.net/v1';
const commentaryBase = 'https://commentaries.getbible.net/v1';
const topicsBase = 'https://bookmarks.getbible.net/v1';

async function requestJson(url, signal) {
  let response;

  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    throw new Error('Could not connect to GetBible. Check your connection and try again.');
  }

  if (!response.ok) {
    let detail;
    try {
      detail = (await response.json()).detail;
    } catch {
      detail = null;
    }
    if (response.status === 404) {
      throw new Error(detail || 'That passage or translation was not found.');
    }
    throw new Error(detail || `GetBible could not complete the request (${response.status}).`);
  }

  return response.json();
}

export async function getBooks(translation = 'kjv', signal) {
  const data = await requestJson(`${bibleBase}/${translation}/books.json`, signal);
  return Object.values(data)
    .map((book) => ({ number: Number(book.nr), name: book.name }))
    .sort((a, b) => a.number - b.number);
}

export async function getChapters(bookNumber, translation = 'kjv', signal) {
  const data = await requestJson(`${bibleBase}/${translation}/${bookNumber}/chapters.json`, signal);
  return Object.keys(data).map(Number).sort((a, b) => a - b);
}

export async function getPassage(reference, translation = 'kjv', signal) {
  const data = await requestJson(`${queryBase}/${translation}/${encodeURIComponent(reference)}`, signal);
  let chapters = Object.values(data).filter((chapter) => Array.isArray(chapter.verses));
  if (/^.+\s+\d+$/.test(reference.trim()) && chapters.length === 1) {
    const selected = chapters[0];
    chapters = [await requestJson(`${bibleBase}/${translation}/${selected.book_nr}/${selected.chapter}.json`, signal)];
  }
  const verses = chapters.flatMap((chapter) => chapter.verses.map((verse) => ({
    number: verse.verse,
    text: verse.text,
    chapter: chapter.chapter,
    book: chapter.book_name,
  })));

  if (verses.length === 0) {
    throw new Error('No verses were returned for this passage.');
  }

  return { chapters, verses };
}

export async function searchScripture(query, translation = 'kjv', offset = 0, signal) {
  const params = new URLSearchParams({ q: query, limit: '20', offset: String(offset) });
  const data = await requestJson(`${searchBase}/${translation}?${params}`, signal);
  const matches = (data.matches || []).map((match) => {
    const chapter = data.results?.[`${translation}_${match.book_nr}_${match.chapter}`];
    const verse = chapter?.verses?.find((item) => Number(item.verse) === Number(match.verse));
    return { reference: match.reference, text: verse?.text || '' };
  });

  return {
    kind: data.query?.kind,
    total: data.query?.total || 0,
    hasMore: Boolean(data.query?.has_more),
    matches,
  };
}

export async function getLexicalVerse(bookNumber, chapter, verse, translation = 'kjv', signal) {
  const data = await requestJson(`${lexicalBase}/${translation}/${bookNumber}/${chapter}.json`, signal);
  return data.verses?.find((item) => Number(item.verse) === Number(verse)) || null;
}

export async function getDictionaryEntry(strongId, signal) {
  const id = String(strongId).toUpperCase();
  if (!/^[GH]\d{1,5}$/.test(id)) {
    throw new Error('Select a word with a Strong’s number.');
  }
  const dictionary = id.startsWith('G') ? 'strongsgreek' : 'strongshebrew';
  return requestJson(`${dictionaryBase}/${dictionary}/${id}.json`, signal);
}

export async function getCommentary(bookNumber, chapter, verse, signal) {
  const data = await requestJson(`${commentaryBase}/clarke/${bookNumber}/${chapter}.json`, signal);
  return data.entries?.filter((entry) => (entry.verses ?? [entry.verse]).includes(Number(verse))) || [];
}

export async function getTopics(signal) {
  const data = await requestJson(`${topicsBase}/topics.json`, signal);
  return data.topics || [];
}

export async function getTopic(id, signal) {
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error('That topic was not found.');
  }
  return requestJson(`${topicsBase}/topics/${id}.json`, signal);
}
