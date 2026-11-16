import { supabase } from '../supabaseClient';

async function sessionAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function authHeaders(extra = {}) {
  const token = await sessionAccessToken();
  if (!token) {
    throw new Error('Sign in to continue.');
  }
  return {
    ...extra,
    Authorization: `Bearer ${token}`,
  };
}

function redirectToLogin() {
  const next = `${window.location.pathname}${window.location.search || ''}`;
  const q = next && next !== '/' ? `?next=${encodeURIComponent(next)}` : '';
  window.location.assign(`/login${q}`);
}

/**
 * Authenticated fetch. Reads a fresh session each call.
 * On 401: refresh once and retry; if still 401, sign out and redirect.
 * Does not sign out on 403.
 */
async function authFetch(url, options = {}, { retried = false } = {}) {
  const headers = new Headers(options.headers || {});
  const token = await sessionAccessToken();
  if (!token) {
    await supabase.auth.signOut().catch(() => {});
    redirectToLogin();
    throw new Error('Sign in to continue.');
  }
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });

  if (res.status !== 401) return res;

  if (retried) {
    await supabase.auth.signOut().catch(() => {});
    redirectToLogin();
    throw new Error('Session expired. Please sign in again.');
  }

  const { error } = await supabase.auth.refreshSession();
  if (error) {
    await supabase.auth.signOut().catch(() => {});
    redirectToLogin();
    throw new Error('Session expired. Please sign in again.');
  }

  return authFetch(url, options, { retried: true });
}

export { authFetch, authHeaders, sessionAccessToken };
