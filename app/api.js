// make.fun's public API: read-only GET, open to any origin (CORS).
// Docs: https://make.fun/api/openapi.json and https://make.fun/llms.txt
//
// One request per view is the goal. Answers live in an in-memory cache:
// younger than a minute they are served without any request at all, and
// older ones are re-fetched with If-None-Match, so a 304 answer costs no
// body. The API's ETags are bound to the minute, so a recheck after the
// minute turns still answers 200 with a fresh tag.
//
// A route change cancels the requests its view started (AbortController),
// so a slow answer can never overwrite the view that replaced it.

const API = 'https://make.fun/api';

// url -> { etag, body, fetchedAt }
const cache = new Map();
const inflight = new Set();

// Counts for the footer: fetches that went out, and views served from the
// in-memory cache without one.
export const stats = { fetched: 0, served: 0 };

/** Abort every request still in flight (called when the route changes). */
export function cancelPending() {
  for (const controller of inflight) controller.abort();
  inflight.clear();
}

/** GET a JSON answer, cached and ETag-revalidated. Returns null on failure. */
async function apiGet(path) {
  const url = API + path;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.fetchedAt < 60_000) {
    stats.served += 1;
    return hit.body;
  }
  const headers = {};
  if (hit?.etag) headers['If-None-Match'] = hit.etag;
  const controller = new AbortController();
  inflight.add(controller);
  let res;
  try {
    stats.fetched += 1;
    res = await fetch(url, { headers, signal: controller.signal });
  } catch {
    return null;
  } finally {
    inflight.delete(controller);
  }
  if (res.status === 304 && hit) {
    hit.fetchedAt = Date.now();
    stats.served += 1;
    return hit.body;
  }
  if (!res.ok) return null;
  const body = await res.json();
  cache.set(url, { etag: res.headers.get('ETag'), body, fetchedAt: Date.now() });
  return body;
}

/** The open bounties, one request: the list already carries each bounty's live pot, entry fee, deadline and entry count. */
export const getBounties = () => apiGet('/competitions?status=open&activity=times');

/** One bounty, by slug. submissions=summary keeps the thousands of entries out of the answer. */
export const getBounty = (slug) => apiGet(`/competitions/${encodeURIComponent(slug)}?submissions=summary`);

/** A bounty's leaderboard. rows=first returns the top 10 in full plus the rest compact, so a long board costs one request. */
export const getLeaderboard = (slug, view) =>
  apiGet(`/competitions/${encodeURIComponent(slug)}/leaderboard?rows=first${view ? `&view=${encodeURIComponent(view)}` : ''}`);

/** An account's public profile, by handle. */
export const getProfile = (handle) => apiGet(`/profiles/${encodeURIComponent(handle)}`);

/** An image path the API returns (usually '/api/avatars/….webp') as an absolute https://make.fun URL. */
export function absImage(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return `https://make.fun${path}`;
  return null;
}
