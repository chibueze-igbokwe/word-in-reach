const crossReferenceBase = 'https://bible.helloao.org/api/d/open-cross-ref';
let booksPromise;

async function requestJson(url, signal) {
  let response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Could not connect to the cross-reference source. Try again.');
  }
  if (!response.ok) throw new Error(`Cross references are unavailable (${response.status}).`);
  return response.json();
}

export async function getCrossReferences(bookNumber, chapter, verse, signal) {
  if (!booksPromise) {
    booksPromise = requestJson(`${crossReferenceBase}/books.json`).catch((error) => {
      booksPromise = null;
      throw error;
    });
  }
  const index = await booksPromise;
  const source = index.books.find((book) => Number(book.order) === Number(bookNumber));
  if (!source) return [];
  const data = await requestJson(`${crossReferenceBase}/${source.id}/${chapter}.json`, signal);
  const item = data.chapter?.content?.find((row) => Number(row.verse) === Number(verse));
  return (item?.references || []).map((ref) => {
    const target = index.books.find((book) => book.id === ref.book);
    return target ? { bookNumber: Number(target.order), chapter: Number(ref.chapter), verse: Number(ref.verse), endVerse: ref.endVerse ? Number(ref.endVerse) : null } : null;
  }).filter(Boolean);
}
