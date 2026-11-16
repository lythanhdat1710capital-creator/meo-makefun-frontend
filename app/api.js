// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
//
// One request per view is the goal, so answers are cached in memory and
// revalidated with ETags: an answer younger than a minute is served without
// a request at all, and an older one is re-fetched with If-None-Match, so a
// 304 costs no body. The API's ETags are bound to the minute, so a recheck
// after the minute turns still answers 200 with a fresh tag.

const API = 'https://make.fun/api';

// url -> { etag, body, fetchedAt }
const cache = new Map();

// Counts for the footer: how many fetches went out, and how many views were
// served from the in-memory cache without one.
export const stats = { fetched: 0, served: 0 };

/** GET a JSON answer, cached and ETag-revalidated. Returns null on failure. */
export async function apiGet(path) {
  const url = API + path;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.fetchedAt < 60_000) {
    stats.served += 1;
    return hit.body;
  }
  const headers = {};
  if (hit?.etag) headers['If-None-Match'] = hit.etag;
  let res;
  try {
    stats.fetched += 1;
    res = await fetch(url, { headers });
  } catch {
    return null;
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

/** One bounty, by slug. submissions=summary keeps the 6,000-entry submission list out of the answer. */
export const getBounty = (slug) => apiGet(`/competitions/${encodeURIComponent(slug)}?submissions=summary`);

/** A bounty's leaderboard. rows=first returns the top 10 in full plus the rest in compact form, which keeps a 4,500-row board to one request. */
export const getLeaderboard = (slug, view) =>
  apiGet(`/competitions/${encodeURIComponent(slug)}/leaderboard?rows=first${view ? `&view=${encodeURIComponent(view)}` : ''}`);

/** An account's public profile, by handle. */
export const getProfile = (handle) => apiGet(`/profiles/${encodeURIComponent(handle)}`);
