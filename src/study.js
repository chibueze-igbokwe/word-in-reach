import './styles.css';
import { getBooks, getChapters, getPassage, searchScripture, getLexicalVerse, getDictionaryEntry, getCommentary } from './getBibleService.js';
import { getCrossReferences } from './bibleDataService.js';
import { createIcon, mountIcons } from './icons.js';
import { loadStudyState, saveStudyState } from './storage.js';
import { appUrl, normalizeReference, setStatus } from './utils.js';

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
let books = [];
let selectedVerse;
let studyView = 'Words';
let studyRequestId = 0;
let crossRequestId = 0;
const studyContent = document.querySelector('#study-content');
const relatedVerses = document.querySelector('#related-verses');

function referenceFor(verse) {
  return `${verse.book} ${verse.chapter}:${verse.number}`;
}

function addMessage(container, message) {
  container.replaceChildren();
  const p = document.createElement('p');
  p.className = 'study-message';
  p.textContent = message;
  container.appendChild(p);
}

function referenceButton(reference, detail = 'Open passage') {
  const button = document.createElement('button');
  const icon = createIcon('book-open', 'list-icon');
  const strong = document.createElement('strong');
  const small = document.createElement('small');
  const arrow = createIcon('chevron-right', 'list-chevron');
  strong.textContent = reference;
  small.textContent = detail;
  button.append(icon, strong, small, arrow);
  button.addEventListener('click', () => openPassage(reference));
  return button;
}

async function loadCrossReferences() {
  if (!selectedVerse || !books.length) return;
  const selected = selectedVerse;
  const book = books.find((item) => item.name === selected.book);
  if (!book) return;
  const requestId = ++crossRequestId;
  addMessage(relatedVerses, `Loading references for ${referenceFor(selected)}...`);
  if (studyView === 'Cross References') addMessage(studyContent, 'Loading cross references...');
  try {
    const references = await getCrossReferences(book.number, selected.chapter, selected.number);
    if (requestId !== crossRequestId) return;
    const list = references.map((item) => {
      const target = books.find((entry) => entry.number === item.bookNumber);
      return target ? `${target.name} ${item.chapter}:${item.verse}${item.endVerse ? `-${item.endVerse}` : ''}` : null;
    }).filter(Boolean);
    relatedVerses.replaceChildren();
    if (!list.length) addMessage(relatedVerses, 'No cross references found for this verse.');
    list.slice(0, 3).forEach((reference) => relatedVerses.appendChild(referenceButton(reference)));
    if (studyView === 'Cross References') {
      studyContent.replaceChildren();
      const heading = document.createElement('h2');
      heading.textContent = `Cross References for ${referenceFor(selected)}`;
      const trail = document.createElement('p');
      trail.className = 'study-source';
      trail.textContent = 'Open a connected passage to add it to your study tabs and trail.';
      const listElement = document.createElement('div');
      listElement.className = 'compact-list';
      list.forEach((reference) => listElement.appendChild(referenceButton(reference)));
      studyContent.append(heading, trail, listElement);
      if (!list.length) addMessage(listElement, 'No cross references found for this verse.');
      if (state.recentPassages.length > 1) {
        const trailHeading = document.createElement('h2');
        trailHeading.textContent = 'Your Scripture Trail';
        const trailList = document.createElement('div');
        trailList.className = 'compact-list';
        state.recentPassages.forEach((reference) => trailList.appendChild(referenceButton(reference, 'Revisit passage')));
        studyContent.append(trailHeading, trailList);
      }
      const source = document.createElement('a');
      source.href = 'https://www.openbible.info/labs/cross-references/';
      source.textContent = 'Cross-reference data: OpenBible.info (CC BY 4.0)';
      source.className = 'study-source';
      studyContent.appendChild(source);
    }
  } catch (error) {
    if (requestId !== crossRequestId) return;
    addMessage(relatedVerses, error.message);
    if (studyView === 'Cross References') addMessage(studyContent, error.message);
  }
}

async function loadWords() {
  if (!selectedVerse || !books.length) return;
  const selected = selectedVerse;
  const book = books.find((item) => item.name === selected.book);
  if (!book) return;
  const requestId = ++studyRequestId;
  addMessage(studyContent, `Loading word study for ${referenceFor(selected)}...`);
  try {
    const lexical = await getLexicalVerse(book.number, selected.chapter, selected.number, state.translation);
    if (requestId !== studyRequestId || studyView !== 'Words') return;
    const tokens = lexical?.tokens?.filter((token) => token.lemma?.strong) || [];
    studyContent.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = `Words in ${referenceFor(selected)}`;
    const hint = document.createElement('p');
    hint.className = 'study-source';
    hint.textContent = 'Choose an English word to see its original-language entry.';
    const choices = document.createElement('div');
    choices.className = 'word-choices';
    studyContent.append(heading, hint, choices);
    if (!tokens.length) {
      addMessage(choices, 'Word links are unavailable for this verse.');
      return;
    }
    tokens.forEach((token) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = token.token;
      button.addEventListener('click', () => showWord(token, choices));
      choices.appendChild(button);
    });
    showWord(tokens[0], choices);
  } catch (error) {
    if (requestId === studyRequestId) addMessage(studyContent, error.message);
  }
}

async function showWord(token, choices) {
  choices.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.textContent === token.token));
  const ids = (Array.isArray(token.lemma.strong) ? token.lemma.strong : String(token.lemma.strong).split(' ')).filter(Boolean);
  const requestId = ++studyRequestId;
  document.querySelector('#word-details')?.remove();
  const details = document.createElement('div');
  details.id = 'word-details';
  details.className = 'word-details';
  details.textContent = 'Loading dictionary entries...';
  studyContent.appendChild(details);
  try {
    const entries = await Promise.all(ids.map((id) => getDictionaryEntry(id)));
    if (requestId !== studyRequestId || studyView !== 'Words') return;
    details.replaceChildren();
    entries.forEach((entry) => {
      const title = document.createElement('h3');
      title.textContent = `${token.token} · ${entry.id}`;
      const original = document.createElement('p');
      original.className = 'study-source';
      original.textContent = `${entry.id.startsWith('G') ? 'Greek' : 'Hebrew'} · Strong’s dictionary`;
      const definition = document.createElement('p');
      definition.textContent = entry.text;
      details.append(title, original, definition);
      if (entry.see_also?.length) {
        const related = document.createElement('div');
        related.className = 'word-choices';
        entry.see_also.slice(0, 8).forEach((item) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = item.id;
          button.addEventListener('click', () => showWord({ token: item.id, lemma: { strong: [item.id] } }, choices));
          related.appendChild(button);
        });
        details.appendChild(related);
      }
    });
  } catch (error) {
    if (requestId === studyRequestId) addMessage(details, error.message);
  }
}

async function loadCommentary() {
  if (!selectedVerse || !books.length) return;
  const selected = selectedVerse;
  const book = books.find((item) => item.name === selected.book);
  if (!book) return;
  const requestId = ++studyRequestId;
  addMessage(studyContent, `Loading commentary for ${referenceFor(selected)}...`);
  try {
    const entries = await getCommentary(book.number, selected.chapter, selected.number);
    if (requestId !== studyRequestId || studyView !== 'Commentary') return;
    studyContent.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = `Commentary on ${referenceFor(selected)}`;
    const source = document.createElement('p');
    source.className = 'study-source';
    source.textContent = 'Adam Clarke’s Commentary · Public Domain';
    studyContent.append(heading, source);
    if (!entries.length) addMessage(studyContent, 'No commentary entry was found for this verse.');
    entries.forEach((entry) => {
      const paragraph = document.createElement('p');
      paragraph.className = 'commentary-text';
      paragraph.textContent = entry.text;
      studyContent.appendChild(paragraph);
    });
  } catch (error) {
    if (requestId === studyRequestId) addMessage(studyContent, error.message);
  }
}

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
      close.appendChild(createIcon('x'));
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
    add.appendChild(createIcon('plus'));
    add.setAttribute('aria-label', 'Open another passage');
    add.addEventListener('click', () => {
      if (mobile) {
        window.location.href = appUrl('search.html');
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
  [saveButton, mobileSaveButton].forEach((button) => {
    button.replaceChildren(createIcon('heart'));
    button.classList.toggle('is-saved', saved);
    button.setAttribute('aria-label', saved ? 'Remove saved passage' : 'Save passage');
  });
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
    row.className = 'verse-row';
    const number = document.createElement('sup');
    const text = document.createElement('span');
    number.textContent = verse.number;
    text.textContent = verse.text;
    row.append(number, text);
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `Study ${referenceFor(verse)}`);
    row.classList.toggle('selected', selectedVerse && referenceFor(verse) === referenceFor(selectedVerse));
    row.addEventListener('click', () => selectVerse(verse));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectVerse(verse);
      }
    });
    scriptureText.appendChild(row);
  });
}

function selectVerse(verse) {
  selectedVerse = verse;
  document.querySelectorAll('.verse-row').forEach((row) => row.classList.toggle('selected', row.getAttribute('aria-label') === `Study ${referenceFor(verse)}`));
  loadCrossReferences();
  if (studyView === 'Words') loadWords();
  if (studyView === 'Commentary') loadCommentary();
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
    selectedVerse = passage.verses[0];
    renderVerses(passage);
    selectVerse(selectedVerse);
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
    books = await getBooks(state.translation);
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
    if (selectedVerse) selectVerse(selectedVerse);
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
      window.location.href = appUrl(`search.html?q=${encodeURIComponent(query)}`);
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
  studyRequestId += 1;
  document.body.dataset.studyView = view.toLowerCase().replace(' ', '-');
  if (view !== 'Passage') studyView = view;
  document.querySelectorAll('.study-subnav button, .panel-tabs button').forEach((button) => {
    button.classList.toggle('active', button.textContent.trim() === view);
  });
  if (view === 'Words') loadWords();
  if (view === 'Commentary') loadCommentary();
  if (view === 'Cross References') loadCrossReferences();
}

document.querySelectorAll('.study-subnav button, .panel-tabs button').forEach((button) => {
  button.addEventListener('click', () => showStudyView(button.textContent.trim()));
});
document.querySelector('#view-cross-references')?.addEventListener('click', () => showStudyView('Cross References'));
document.querySelector('#toggle-mobile-tabs')?.addEventListener('click', (event) => {
  const strip = document.querySelector('#mobile-tabs');
  const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
  event.currentTarget.setAttribute('aria-expanded', String(!expanded));
  strip.hidden = expanded;
});

const initialReference = new URLSearchParams(window.location.search).get('ref');

mountIcons();
loadBookNavigation();
if (initialReference && initialReference !== state.activePassage) {
  openPassage(initialReference);
} else {
  renderWorkspace();
  loadPassage(state.activePassage);
}
