import './styles.css';
import { getBooks, getChapters, getPassage, searchScripture } from './getBibleService.js';
import { loadStudyState, saveStudyState } from './storage.js';
import { normalizeReference, setStatus } from './utils.js';

let state = loadStudyState();

const tabs = document.querySelector('#passage-tabs');
const mobileTabs = document.querySelector('#mobile-tabs');
const activeReference = document.querySelector('#active-reference');
const mobileReference = document.querySelector('#mobile-reference');
const saveButton = document.querySelector('#save-passage');
const mobileSaveButton = document.querySelector('#mobile-save');
const scriptureText = document.querySelector('#scripture-text');
let passageRequest;
let passageRequestId = 0;

function saveState() {
  saveStudyState(state);
}

function renderTabsInto(container, mobile = false) {
  if (!container) {
    return;
  }

  container.innerHTML = '';

  state.openPassages.forEach((reference) => {
    const tab = document.createElement('div');
    tab.className = mobile ? 'mobile-passage-tab' : 'workspace-tab';
    tab.setAttribute('role', 'tab');
    tab.tabIndex = 0;
    tab.setAttribute('aria-selected', String(reference === state.activePassage));

    const label = document.createElement('span');
    label.textContent = reference;
    tab.appendChild(label);

    {
      const close = document.createElement('button');
      close.textContent = '×';
      close.className = 'tab-close';
      close.type = 'button';
      close.setAttribute('aria-label', `Close ${reference}`);
      close.addEventListener('click', (event) => {
        event.stopPropagation();
        closePassage(reference);
      });
      tab.appendChild(close);
    }

    tab.addEventListener('click', () => {
      state.activePassage = reference;
      saveState();
      renderWorkspace();
      loadPassage(reference);
    });
    tab.addEventListener('keydown', (event) => {
      if (event.target === tab && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        tab.click();
      }
    });

    container.appendChild(tab);
  });

  {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = mobile ? 'mobile-add-tab' : 'add-tab';
    add.textContent = '+';
    add.setAttribute('aria-label', 'Open another passage');
    add.addEventListener('click', () => {
      if (mobile) {
        window.location.href = '/search.html';
      } else {
        document.querySelector('#desktop-query')?.focus();
      }
    });
    container.appendChild(add);
  }
}

function renderWorkspace() {
  renderTabsInto(tabs);
  renderTabsInto(mobileTabs, true);
  activeReference.textContent = state.activePassage;
  mobileReference.textContent = state.activePassage;
  document.querySelector('#open-passage-count').textContent = `Open Passages (${state.openPassages.length})`;

  const saved = state.savedPassages.includes(state.activePassage);
  saveButton.textContent = saved ? '♥' : '♡';
  mobileSaveButton.textContent = saved ? '♥' : '♡';
  document.querySelectorAll('.book-list button').forEach((button) => {
    button.classList.toggle('selected', state.activePassage.startsWith(`${button.dataset.book} `));
  });
  const url = new URL(window.location.href);
  url.searchParams.set('ref', state.activePassage);
  window.history.replaceState(null, '', url);
}

function renderVerses(passage) {
  scriptureText.replaceChildren();
  let previousChapter;
  const multipleChapters = passage.chapters.length > 1;

  passage.verses.forEach((verse) => {
    const chapterKey = `${verse.book} ${verse.chapter}`;
    if (multipleChapters && chapterKey !== previousChapter) {
      const heading = document.createElement('h2');
      heading.textContent = chapterKey;
      scriptureText.appendChild(heading);
      previousChapter = chapterKey;
    }

    const row = document.createElement('p');
    const number = document.createElement('sup');
    const text = document.createElement('span');
    number.textContent = verse.number;
    text.textContent = verse.text;
    row.append(number, text);
    scriptureText.appendChild(row);
  });
}

async function loadPassage(reference, addTab = false) {
  const normalized = normalizeReference(reference);
  if (!normalized) {
    setStatus('Enter a passage such as John 3:16.');
    return false;
  }
  passageRequest?.abort();
  passageRequest = new AbortController();
  const requestId = ++passageRequestId;
  scriptureText.textContent = 'Loading Scripture...';
  setStatus(`Loading ${normalized}...`);

  try {
    const passage = await getPassage(normalized, state.translation, passageRequest.signal);
    if (requestId !== passageRequestId) {
      return false;
    }
    if (addTab && !state.openPassages.includes(normalized)) {
      state.openPassages.push(normalized);
    }
    state.activePassage = normalized;
    state.recentPassages = [normalized, ...state.recentPassages.filter((item) => item !== normalized)].slice(0, 8);
    saveState();
    renderWorkspace();
    renderVerses(passage);
    setStatus(`${passage.verses.length} ${passage.verses.length === 1 ? 'verse' : 'verses'} · KJV`);
    return true;
  } catch (error) {
    if (error.name === 'AbortError' || requestId !== passageRequestId) {
      return false;
    }
    scriptureText.replaceChildren();
    const message = document.createElement('p');
    message.className = 'reader-error';
    message.textContent = error.message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => loadPassage(normalized, addTab));
    scriptureText.append(message, retry);
    setStatus(error.message);
    return false;
  }
}

async function openPassage(reference) {
  const opened = await loadPassage(reference, true);
  if (opened) {
    document.querySelector('.bible-sidebar').classList.remove('is-open');
    document.querySelector('#mobile-browse').setAttribute('aria-expanded', 'false');
  }
}

function closePassage(reference) {
  if (state.openPassages.length === 1) {
    setStatus('Keep at least one passage open.');
    return;
  }

  const index = state.openPassages.indexOf(reference);
  const wasActive = state.activePassage === reference;
  state.openPassages = state.openPassages.filter((item) => item !== reference);

  if (wasActive) {
    state.activePassage = state.openPassages[Math.max(0, index - 1)];
  }

  saveState();
  renderWorkspace();
  if (wasActive) {
    loadPassage(state.activePassage);
  }
}

function toggleSave() {
  const reference = state.activePassage;
  const index = state.savedPassages.indexOf(reference);

  if (index === -1) {
    state.savedPassages.push(reference);
    setStatus(`${reference} saved.`);
  } else {
    state.savedPassages.splice(index, 1);
    setStatus(`${reference} removed from saved passages.`);
  }

  saveState();
  renderWorkspace();
}

async function showChapters(book, container) {
  const existing = container.querySelector('.chapter-list');
  if (existing) {
    existing.remove();
    return;
  }
  const chapters = document.createElement('div');
  chapters.className = 'chapter-list';
  chapters.textContent = 'Loading chapters...';
  container.appendChild(chapters);

  try {
    const numbers = await getChapters(book.number, state.translation);
    chapters.replaceChildren();
    numbers.forEach((number) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = number;
      button.setAttribute('aria-label', `${book.name} chapter ${number}`);
      button.addEventListener('click', () => openPassage(`${book.name} ${number}`));
      chapters.appendChild(button);
    });
  } catch (error) {
    chapters.textContent = error.message;
  }
}

async function loadBookNavigation() {
  const oldBooks = document.querySelector('#old-books');
  const newBooks = document.querySelector('#new-books');
  try {
    const books = await getBooks(state.translation);
    oldBooks.replaceChildren();
    newBooks.replaceChildren();
    books.forEach((book) => {
      const container = document.createElement('div');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'book-button';
      button.dataset.book = book.name;
      button.textContent = book.name;
      button.addEventListener('click', () => showChapters(book, container));
      container.appendChild(button);
      (book.number <= 39 ? oldBooks : newBooks).appendChild(container);
    });
    renderWorkspace();
  } catch (error) {
    oldBooks.textContent = error.message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Try again';
    retry.addEventListener('click', loadBookNavigation);
    oldBooks.appendChild(retry);
  }
}

document.querySelector('#desktop-search')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.querySelector('#desktop-query');
  const query = normalizeReference(input.value);
  if (!query) {
    return;
  }
  setStatus(`Looking up ${query}...`);
  try {
    const result = await searchScripture(query, state.translation);
    if (result.kind === 'reference') {
      openPassage(query);
    } else {
      window.location.href = `/search.html?q=${encodeURIComponent(query)}`;
    }
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelectorAll('[data-ref]').forEach((element) => {
  element.addEventListener('click', () => openPassage(element.dataset.ref));
});

saveButton?.addEventListener('click', toggleSave);
mobileSaveButton?.addEventListener('click', toggleSave);
document.querySelector('#mobile-browse').addEventListener('click', (event) => {
  const open = document.querySelector('.bible-sidebar').classList.toggle('is-open');
  event.currentTarget.setAttribute('aria-expanded', String(open));
});
function showStudyView(view) {
  document.body.dataset.studyView = view.toLowerCase().replace(' ', '-');
  document.querySelectorAll('.study-subnav button, .panel-tabs button').forEach((button) => {
    button.classList.toggle('active', button.textContent.trim() === view);
  });
  const empty = document.querySelector('#panel-empty');
  if (view === 'Commentary') {
    empty.textContent = 'Commentary will appear here when study data is connected.';
  } else if (view === 'Cross References') {
    empty.textContent = 'Cross references will appear here when study data is connected.';
  }
  empty.hidden = view === 'Words' || view === 'Passage';
}

document.querySelectorAll('.study-subnav button, .panel-tabs button').forEach((button) => {
  button.addEventListener('click', () => showStudyView(button.textContent.trim()));
});
document.querySelector('#toggle-mobile-tabs')?.addEventListener('click', (event) => {
  const strip = document.querySelector('#mobile-tabs');
  const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
  event.currentTarget.setAttribute('aria-expanded', String(!expanded));
  strip.hidden = expanded;
});

const initialReference = new URLSearchParams(window.location.search).get('ref');

loadBookNavigation();
if (initialReference && initialReference !== state.activePassage) {
  openPassage(initialReference);
} else {
  renderWorkspace();
  loadPassage(state.activePassage);
}
