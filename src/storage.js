const STORAGE_KEY = 'word-in-reach-state';

const defaultState = {
  openPassages: ['John 3:16'],
  activePassage: 'John 3:16',
  savedPassages: [],
  recentPassages: [],
  translation: 'kjv',
};

export function loadStudyState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const passages = (items) => Array.isArray(items) ? [...new Set(items.filter((item) => typeof item === 'string' && item.trim()))] : [];
    const openPassages = passages(saved?.openPassages);
    if (!openPassages.length) openPassages.push(...defaultState.openPassages);
    return {
      openPassages,
      activePassage: openPassages.includes(saved?.activePassage) ? saved.activePassage : openPassages[0],
      savedPassages: passages(saved?.savedPassages),
      recentPassages: passages(saved?.recentPassages).slice(0, 8),
      translation: ['kjv', 'web'].includes(saved?.translation) ? saved.translation : defaultState.translation,
    };
  } catch {
    return { ...defaultState, openPassages: [...defaultState.openPassages], savedPassages: [], recentPassages: [] };
  }
}

export function saveStudyState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
