export function normalizeReference(reference) {
  return reference.trim().replace(/\s+/g, ' ');
}

export function setStatus(message) {
  const status = document.querySelector('#reader-status');

  if (status) {
    status.textContent = message;
  }
}

export function appUrl(path = '', base = import.meta.env?.BASE_URL || '/') {
  return `${base.replace(/\/?$/, '/')}${path.replace(/^\/+/, '')}`;
}

export function passageUrl(reference) {
  return appUrl(`bible.html?ref=${encodeURIComponent(reference)}`);
}
