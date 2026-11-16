// A make.fun frontend: the board of live bounties, a bounty's page, its
// leaderboard and an account's public profile, on hash routes.
//
//   #/                          the board
//   #/bounty/<slug>             one bounty
//   #/bounty/<slug>/leaderboard that bounty's leaderboard
//   #/u/<handle>                an account's public profile
//
// Each view costs one API request the first time it opens; going back
// costs none, because api.js caches answers and revalidates them with
// ETags. A route change cancels the requests the old view started, and a
// render token keeps a slow answer from overwriting a newer view.
// window.__shotReady is false while a view loads and true once its data
// is on screen, so a screenshot script knows when to capture.

import { cancelPending, getBounties, getBounty, getLeaderboard, getProfile, stats } from './api.js';
import { timeLeft } from './format.js';
import { boardView, bountyView, leaderboardView, profileView } from './views.js';

const app = document.getElementById('app');
const counter = document.getElementById('reqcount');

// The board's filter, sort and search, and the paging of long lists, live
// here so a change re-renders from cached data instead of fetching again.
const state = { filter: 'open', sort: 'deadline', query: '', page: 1, view: '' };
let currentHash = '';
let renderToken = 0;
// The leaderboard view a bounty was last shown in, by slug: the API's
// default view is only learned from the first answer, so remembering it
// keeps a return visit on the same cached URL instead of fetching twice.
const viewBySlug = {};

function showCounter() {
  counter.textContent = `${stats.fetched} request${stats.fetched === 1 ? '' : 's'} · ${stats.served} served from cache`;
}

function errorBox(message) {
  return `<div class="error"><p>${message}</p><p><button type="button" data-retry>Try again</button></p></div>`;
}

/** The route a hash names: board, one bounty, its leaderboard, or a profile. */
function parseRoute(hash) {
  const profile = hash.match(/^#\/u\/([^/]+)$/);
  if (profile) return { name: 'profile', handle: decodeURIComponent(profile[1]) };
  const board = hash.match(/^#\/bounty\/([^/]+)\/leaderboard$/);
  if (board) return { name: 'leaderboard', slug: decodeURIComponent(board[1]) };
  const bounty = hash.match(/^#\/bounty\/([^/]+)$/);
  if (bounty) return { name: 'bounty', slug: decodeURIComponent(bounty[1]) };
  return { name: 'board' };
}

async function render() {
  window.__shotReady = false;
  const hash = location.hash || '#/';
  const route = parseRoute(hash);
  // A new route starts its paging over and drops the old view's requests;
  // paging and sorting inside one view keep their place.
  if (hash !== currentHash) {
    currentHash = hash;
    state.page = 1;
    cancelPending();
    if (route.name === 'leaderboard') state.view = viewBySlug[route.slug] ?? '';
  }
  const token = ++renderToken;
  app.innerHTML = '<p class="loading">Loading…</p>';

  let html = '';
  try {
    if (route.name === 'profile') {
      const p = await getProfile(route.handle);
      if (!p || p.error) {
        document.title = 'Profile not found | make.fun';
        html = errorBox(`No account “${route.handle}” was found.`) + '<p><a href="#/">← Back to the board</a></p>';
      } else {
        document.title = `@${p.handle} | make.fun`;
        html = profileView(p, state.page);
      }
    } else if (route.name === 'leaderboard') {
      const lb = await getLeaderboard(route.slug, state.view || undefined);
      if (!lb || lb.error || !lb.competition) {
        document.title = 'Leaderboard not found | make.fun';
        html = errorBox(`No leaderboard for “${route.slug}” was found.`) + '<p><a href="#/">← Back to the board</a></p>';
      } else {
        state.view = lb.view ?? state.view;
        viewBySlug[route.slug] = state.view;
        document.title = `${lb.competition.title} — leaderboard | make.fun`;
        html = leaderboardView(lb, state.page, state.view);
      }
    } else if (route.name === 'bounty') {
      const b = await getBounty(route.slug);
      if (!b || b.error) {
        document.title = 'Bounty not found | make.fun';
        html = errorBox(`No bounty “${route.slug}” was found.`) + '<p><a href="#/">← Back to the board</a></p>';
      } else {
        document.title = `${b.title} | make.fun`;
        html = bountyView(b);
      }
    } else {
      const data = await getBounties();
      if (!data || data.error) {
        document.title = 'make.fun bounties';
        html = errorBox('The bounty board could not be loaded. Check your connection and try again.');
      } else {
        document.title = 'make.fun bounties';
        html = boardView(data.items ?? [], state.filter, state.sort, state.query);
      }
    }
  } catch {
    html = errorBox('Something went wrong while loading this view.');
  }
  // A newer render took over while this one waited: leave its work alone.
  if (token !== renderToken) return;
  app.innerHTML = html;
  applySearch();
  window.scrollTo(0, 0);
  showCounter();
  window.__shotReady = true;
}

/** The board's search: hide the cards whose title, summary or slug do
 * not contain the query. No request, no re-render, so the input keeps
 * focus while typing. */
function applySearch() {
  const input = app.querySelector('[data-search-input]');
  if (!input) return;
  const q = state.query.trim().toLowerCase();
  let shown = 0;
  for (const card of app.querySelectorAll('.card')) {
    const hit = !q || (card.getAttribute('data-search') || '').includes(q);
    card.hidden = !hit;
    if (hit) shown += 1;
  }
  const count = app.querySelector('[data-match-count]');
  if (count) count.textContent = `${shown} ${shown === 1 ? 'bounty' : 'bounties'}`;
}

/** The countdowns tick in place every 30 s: the text changes, the page is never rebuilt for it. */
setInterval(() => {
  for (const el of document.querySelectorAll('[data-deadline]')) {
    el.textContent = timeLeft(el.getAttribute('data-deadline'));
  }
}, 30_000);

// A failed avatar never shows a broken image: hide it, the handle stays.
document.addEventListener('error', (event) => {
  if (event.target instanceof HTMLImageElement) event.target.style.display = 'none';
}, true);

// One delegated listener for the controls the views render: filter chips
// and sort on the board, paging on the long tables, the leaderboard's
// view switch, and the retry button on an error.
app.addEventListener('click', (event) => {
  const filter = event.target.closest('[data-filter]');
  if (filter) {
    state.filter = filter.getAttribute('data-filter');
    state.page = 1;
    render();
    return;
  }
  const page = event.target.closest('[data-page]');
  if (page && !page.disabled) {
    state.page = Number(page.getAttribute('data-page'));
    render();
    return;
  }
  if (event.target.closest('[data-retry]')) render();
});

app.addEventListener('input', (event) => {
  if (event.target.matches('[data-search-input]')) {
    state.query = event.target.value;
    applySearch();
  }
});

app.addEventListener('change', (event) => {
  if (event.target.matches('[data-sort]')) {
    state.sort = event.target.value;
    render();
  }
  if (event.target.matches('[data-view]')) {
    state.view = event.target.value;
    state.page = 1;
    render();
  }
});

window.addEventListener('hashchange', render);
render();
