// Small helpers for the DOM and the storage.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function safeStorage() {
  try {
    const key = 'smashterpiece.test';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return window.localStorage;
  } catch {
    // Private mode or no storage: keep the data in memory only.
    const data = new Map();
    return {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: (k) => data.delete(k),
    };
  }
}

// Give a file to the player. On a phone or a tablet, the share sheet
// opens, so that a parent can keep the file (for example in Files or in
// Google Drive). Otherwise the browser downloads the file.
// Return 'shared', 'downloaded' or 'closed'.
export async function offerFile(file, title = 'Smashterpiece') {
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return 'shared';
    }
  } catch (error) {
    // The player closed the share sheet.
    if (error && error.name === 'AbortError') return 'closed';
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
