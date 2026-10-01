import './styles.css';
import { searchScripture } from './getBibleService.js';
import { loadStudyState } from './storage.js';
import { appUrl, normalizeReference, passageUrl } from './utils.js';

const state = loadStudyState();
const page = document.body.dataset.page;

function renderRecentPassages() {
  const list = document.querySelector('#recent-list');

  if (!list) {
    return;
  }

  list.innerHTML = '';

  [state.activePassage].forEach((reference) => {
    const link = document.createElement('a');
    link.href = passageUrl(reference);
    link.innerHTML = `<strong>${reference}</strong><small>Continue your study</small><b>›</b>`;
    list.appendChild(link);
  });
}

function renderSavedPassages() {
  const list = document.querySelector('#saved-list');

  if (!list) {
    return;
  }

  if (state.savedPassages.length === 0) {
    list.innerHTML = '<div class="empty-state"><span>♡</span><h2>No saved verses yet</h2><p>Save a passage from the Scripture reader and it will appear here.</p></div>';
    return;
  }

  state.savedPassages.forEach((reference) => {
    const link = document.createElement('a');
    link.href = passageUrl(reference);
    link.innerHTML = `<strong>${reference}</strong><small>Saved passage</small><b>›</b>`;
    list.appendChild(link);
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

function setupSearch() {
  const form = document.querySelector('#search-form');
  const input = document.querySelector('#search-query');
  const results = document.querySelector('#search-results');
  const status = document.querySelector('#search-status');
  const more = document.querySelector('#search-more');
  let currentQuery = '';
  let offset = 0;
  let request;

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
    request?.abort();
    request = new AbortController();
    more.hidden = true;
    status.textContent = 'Searching Scripture...';

    try {
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
  if (initialQuery) {
    input.value = initialQuery;
    runSearch();
  }
}

if (page === 'home') {
  renderRecentPassages();
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
