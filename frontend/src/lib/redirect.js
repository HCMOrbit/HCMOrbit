// Shared helpers for the post-auth redirect flow.
// A logged-out user hitting an auth-gated route is bounced to /login (or /register)
// with `?redirect=<original URL>` so they return to where they started after sign-in.

const REDIRECT_PARAM = "redirect";
const SESSION_KEY = "hcm_post_auth_redirect";

// Build the login href for the current location, preserving the full URL
// (path + query + hash) so it can be restored after sign-in.
export function loginHref(location, base = "/login") {
  if (!location) return base;
  const dest = `${location.pathname}${location.search || ""}${location.hash || ""}`;
  // Don't loop back to an auth page
  if (/^\/(login|register|onboarding|auth\/?)/.test(dest)) return base;
  return `${base}?${REDIRECT_PARAM}=${encodeURIComponent(dest)}`;
}

// Read the `redirect` query param from a location and return a SAFE
// internal path to navigate to, or null if missing/unsafe.
// Only allows relative paths starting with "/" (and not "//" or "/\\") to
// prevent open-redirect attacks via the auth flow.
export function safeRedirectTarget(search) {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const raw = params.get(REDIRECT_PARAM);
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("/")) return null;     // must be relative
    if (decoded.startsWith("//")) return null;     // protocol-relative
    if (decoded.startsWith("/\\")) return null;    // backslash trick
    if (/^\/(login|register)/.test(decoded)) return null; // no auth loop
    return decoded;
  } catch {
    return null;
  }
}

// Stash a redirect target across an external OAuth round-trip (Emergent
// Google) since the hash returned from the OAuth provider only contains
// session_id, not a query string we control.
export function stashOAuthRedirect(dest) {
  try {
    if (dest && typeof dest === "string" && dest.startsWith("/")) {
      sessionStorage.setItem(SESSION_KEY, dest);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* sessionStorage unavailable (privacy mode, etc.) — safely no-op */
  }
}

export function popOAuthRedirect() {
  try {
    const v = sessionStorage.getItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (v && typeof v === "string" && v.startsWith("/") && !v.startsWith("//")) {
      return v;
    }
  } catch {
    /* sessionStorage unavailable — fall through to null */
  }
  return null;
}
