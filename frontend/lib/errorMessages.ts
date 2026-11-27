const TIMEOUT_RE = /timed out|timeout|aborted/i;
const NETWORK_RE =
  /failed to fetch|networkerror|load failed|fetch failed|econnrefused|network request failed/i;
const TECHNICAL_RE =
  /^\s*[\[{]|https?:\/\/|internal server error|status\s+5\d\d|unexpected token|syntaxerror|typeerror/i;

/**
 * Turns unknown API/network errors into concise, user-safe messages while
 * preserving clean, human-readable validation details from the backend.
 */
export function getFriendlyErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const raw = err.message?.trim() ?? '';
  if (!raw) return fallback;

  if (TIMEOUT_RE.test(raw)) {
    return 'The request took too long to respond. Please check your connection and try again.';
  }
  if (NETWORK_RE.test(raw)) {
    return 'We could not reach the server. Please check your internet connection and try again.';
  }
  if (TECHNICAL_RE.test(raw) || raw.length > 220) {
    return fallback;
  }

  return raw;
}
