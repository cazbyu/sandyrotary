/**
 * Remember the page a signed-out visitor asked for (e.g. a WhatsApp link to /deposit-ideas) and
 * return there after login. localStorage, not sessionStorage: a magic link opens in a new tab.
 * Only same-origin app paths are accepted, and the entry expires after 30 minutes.
 */
const KEY = 'sr_return_to';
const TTL_MS = 30 * 60 * 1000;

function isSafePath(path: string) {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') && !path.startsWith('/login');
}

export function rememberReturnTo(path: string) {
  if (!isSafePath(path) || path === '/') return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Storage unavailable (private mode): the member just lands on Home.
  }
}

// The answer for the location being rendered, so a repeated render (React StrictMode) agrees with the
// first one even though storage was already cleared. Storage is cleared on first read: no redirect loops.
let lastAnswer: { from: string; to: string } | null = null;

/** The remembered path (removed once read), or null if none, expired, or already current. */
export function takeReturnTo(currentPath: string): string | null {
  if (lastAnswer && lastAnswer.from === currentPath) return lastAnswer.to;
  lastAnswer = null;
  // A background tab (e.g. the old login tab when a magic link opens a new one) must not take it.
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { path, at } = JSON.parse(raw) as { path?: string; at?: number };
    if (!path || !at || Date.now() - at > TTL_MS || !isSafePath(path) || path === currentPath) return null;
    lastAnswer = { from: currentPath, to: path };
    return path;
  } catch {
    return null;
  }
}
