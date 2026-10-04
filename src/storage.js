const STORAGE_KEY = 'word-in-reach-state';

const defaultState = {
  openPassages: ['John 3:16'],
  activePassage: 'John 3:16',
  savedPassages: [],
  recentPassages: ['John 3:16'],
  translation: 'kjv',
};

export function loadStudyState() {
  const savedState = localStorage.getItem(STORAGE_KEY);

  if (!savedState) {
    return { ...defaultState };
  }

  try {
    return { ...defaultState, ...JSON.parse(savedState) };
  } catch {
    return { ...defaultState };
  }
}

export function saveStudyState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
