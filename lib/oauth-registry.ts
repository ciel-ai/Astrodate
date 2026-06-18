/**
 * oauth-registry.ts
 *
 * A tiny module-level registry that lets login.tsx register a one-shot
 * callback for the Android Google OAuth deep-link redirect.
 *
 * The root _layout.tsx runs Linking.addEventListener at all times.  When the
 * OAuth redirect arrives it checks this registry first, hands the URL to the
 * registered callback, and clears it — so the email-verify handler never
 * accidentally swallows a Google OAuth URL.
 */

type OAuthCallback = (url: string) => void;

let _pendingCallback: OAuthCallback | null = null;

/** Call this before opening the browser on Android. */
export function registerOAuthCallback(cb: OAuthCallback): void {
  _pendingCallback = cb;
}

/** Call this in the finally block or on timeout to avoid leaks. */
export function unregisterOAuthCallback(): void {
  _pendingCallback = null;
}

/**
 * Called by the layout's Linking listener.
 * Returns true if a callback was found and fired (caller should skip
 * any further URL processing for this URL).
 */
export function dispatchOAuthCallbackIfPending(url: string): boolean {
  if (!_pendingCallback) return false;
  if (url.includes('code=') || url.includes('access_token') || url.includes('error=')) {
    const cb = _pendingCallback;
    _pendingCallback = null;
    cb(url);
    return true;
  }
  return false;
}
