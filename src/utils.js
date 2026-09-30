export function normalizeReference(reference) {
  return reference.trim().replace(/\s+/g, ' ');
}

export function setStatus(message) {
  const status = document.querySelector('#reader-status');

  if (status) {
    status.textContent = message;
  }
}

export function passageUrl(reference) {
  return `/bible.html?ref=${encodeURIComponent(reference)}`;
}
