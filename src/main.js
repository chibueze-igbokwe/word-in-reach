import './styles.css';
import { searchScripture, getBooks, getTopic, getTopics } from './getBibleService.js';
import { loadStudyState } from './storage.js';
import { createIcon, mountIcons } from './icons.js';
import { appUrl, normalizeReference, passageUrl } from './utils.js';

const state = loadStudyState();
const page = document.body.dataset.page;

function createPassageLink(reference, detail, iconName = 'book-open') {
  const link = document.createElement('a');
  const strong = document.createElement('strong');
  const small = document.createElement('small');
  link.href = passageUrl(reference);
  strong.textContent = reference;
  small.textContent = detail;
  link.append(createIcon(iconName, 'list-icon'), strong, small, createIcon('chevron-right', 'list-chevron'));
  return link;
}

function renderRecentPassages() {
  const list = document.querySelector('#recent-list');

  if (!list) {
    return;
  }

  list.replaceChildren(createPassageLink(state.activePassage, 'Continue your study'));
}

function renderSavedPassages() {
  const list = document.querySelector('#saved-list');

  if (!list) {
    return;
  }

  if (state.savedPassages.length === 0) {
    list.innerHTML = '<div class="empty-state"><span data-icon="heart"></span><h2>No saved verses yet</h2><p>Save a passage from the Scripture reader and it will appear here.</p></div>';
    mountIcons(list);
    return;
  }

  state.savedPassages.forEach((reference) => {
    list.appendChild(createPassageLink(reference, 'Saved passage', 'heart'));
  });
}

function handleHomeSearch(formSelector, inputSelector) {
  const form = document.querySelector(formSelector);
  const input = document.querySelector(inputSelector);

  if (!form || !input) {
    return;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = normalizeReference(input.value);

    if (query) {
      window.location.href = appUrl(`search.html?q=${encodeURIComponent(query)}`);
    }
  });
}

function renderStudyTrail() {
  const list = document.querySelector('#recent-study-list');
  if (!list) return;
  list.replaceChildren();
  state.recentPassages.forEach((reference) => {
    list.appendChild(createPassageLink(reference, 'Recent passage · KJV', 'bookmark'));
  });
}

async function renderTopics() {
  const grid = document.querySelector('#topic-grid');
  if (!grid) return;
  try {
    const topics = await getTopics();
    const featured = ['saved-by-faith', 'effective-prayer', 'biblical-love', 'grace'].map((id) => topics.find((topic) => topic.id === id)).filter(Boolean);
    grid.replaceChildren();
    (featured.length ? featured : topics.slice(0, 4)).forEach((topic) => {
      const link = document.createElement('a');
      link.href = appUrl(`search.html?topic=${encodeURIComponent(topic.id)}`);
      const symbol = document.createElement('span');
      symbol.textContent = topic.name.charAt(0);
      link.append(symbol, topic.name);
      grid.appendChild(link);
    });
  } catch (error) {
    grid.textContent = error.message;
  }
}

function setupSearch() {
  const form = document.querySelector('#search-form');
  const input = document.querySelector('#search-query');
  const results = document.querySelector('#search-results');
  const status = document.querySelector('#search-status');
  const more = document.querySelector('#search-more');
  const directory = document.querySelector('#topic-directory');
  let currentQuery = '';
  let offset = 0;
  let request;

  async function showTopic(id) {
    request?.abort();
    request = new AbortController();
    results.replaceChildren();
    directory.hidden = true;
    more.hidden = true;
    status.textContent = 'Loading topic...';
    try {
      const [topic, books] = await Promise.all([getTopic(id, request.signal), getBooks(state.translation, request.signal)]);
      input.value = topic.name;
      status.textContent = `${topic.name} · ${topic.verses.length} Scripture references from GetBible Topics`;
      topic.verses.forEach(([bookNumber, chapter, verse]) => {
        const book = books.find((item) => item.number === Number(bookNumber));
        if (!book) return;
        const reference = `${book.name} ${chapter}:${verse}`;
        const link = document.createElement('a');
        link.href = passageUrl(reference);
        const strong = document.createElement('strong');
        strong.textContent = reference;
        const text = document.createElement('span');
        text.textContent = `Explore ${reference}`;
        link.append(strong, text);
        results.appendChild(link);
      });
    } catch (error) {
      if (error.name !== 'AbortError') status.textContent = error.message;
    }
  }

  async function showTopicDirectory() {
    try {
      const topics = await getTopics();
      directory.replaceChildren();
      const heading = document.createElement('h2');
      heading.textContent = 'Topics to Explore';
      directory.appendChild(heading);
      topics.forEach((topic) => {
        const link = document.createElement('a');
        link.href = appUrl(`search.html?topic=${encodeURIComponent(topic.id)}`);
        link.textContent = `${topic.name} (${topic.verses})`;
        directory.appendChild(link);
      });
      directory.hidden = false;
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function runSearch(append = false) {
    const query = normalizeReference(input.value);
    if (!query) {
      status.textContent = 'Enter a passage or words to search.';
      return;
    }
    if (!append) {
      currentQuery = query;
      offset = 0;
      results.replaceChildren();
      window.history.replaceState(null, '', appUrl(`search.html?q=${encodeURIComponent(query)}`));
    }
    directory.hidden = true;
    request?.abort();
    request = new AbortController();
    more.hidden = true;
    status.textContent = 'Searching Scripture...';

    try {
      if (!append) {
        let topics = [];
        try {
          topics = await getTopics(request.signal);
        } catch (error) {
          if (error.name === 'AbortError') throw error;
        }
        const topic = topics.find((item) => item.name.toLowerCase() === query.toLowerCase() || item.aliases?.some((alias) => alias.toLowerCase() === query.toLowerCase()));
        if (topic) {
          window.history.replaceState(null, '', appUrl(`search.html?topic=${encodeURIComponent(topic.id)}`));
          await showTopic(topic.id);
          return;
        }
      }
      const data = await searchScripture(currentQuery, state.translation, offset, request.signal);
      if (data.kind === 'reference') {
        window.location.href = passageUrl(currentQuery);
        return;
      }
      data.matches.forEach((match) => {
        const link = document.createElement('a');
        link.href = passageUrl(match.reference);
        const heading = document.createElement('strong');
        heading.textContent = match.reference;
        const text = document.createElement('span');
        text.textContent = match.text;
        link.append(heading, text);
        results.appendChild(link);
      });
      offset += data.matches.length;
      status.textContent = data.total === 0 ? 'No matching verses found.' : `${data.total} matching ${data.total === 1 ? 'verse' : 'verses'} in KJV`;
      more.hidden = !data.hasMore;
    } catch (error) {
      if (error.name !== 'AbortError') {
        status.textContent = error.message;
        more.hidden = !append;
      }
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runSearch();
  });
  more.addEventListener('click', () => runSearch(true));
  const initialQuery = new URLSearchParams(window.location.search).get('q');
  const initialTopic = new URLSearchParams(window.location.search).get('topic');
  if (initialTopic) {
    showTopic(initialTopic);
  } else if (initialQuery) {
    input.value = initialQuery;
    runSearch();
  } else {
    showTopicDirectory();
  }
}

mountIcons();

if (page === 'home') {
  renderRecentPassages();
  renderStudyTrail();
  renderTopics();
  handleHomeSearch('#home-search', '#home-query');
  document.querySelector('.mobile-header .icon-button')?.addEventListener('click', () => {
    const menu = document.querySelector('#mobile-menu');
    menu.hidden = !menu.hidden;
  });
}

if (page === 'saved') {
  renderSavedPassages();
}

if (page === 'search') {
  setupSearch();
}
