// A make.fun frontend: the board of live bounties, a bounty's page, its
// leaderboard and an account's public profile, on hash routes.
//
//   #/                          the board
//   #/bounty/<slug>             one bounty
//   #/bounty/<slug>/leaderboard that bounty's leaderboard
//   #/u/<handle>                an account's public profile
//
// Each view costs one API request the first time it opens; going back costs
// none, because api.js caches answers and revalidates them with ETags.
// window.__shotReady is false while a view loads and true once its data is
// on screen, so a screenshot script knows when to capture.

import { getBounties, getBounty, getLeaderboard, getProfile, stats } from './api.js';
import { timeLeft } from './format.js';
import { boardView, bountyView, leaderboardView, profileView } from './views.js';

const app = document.getElementById('app');
const counter = document.getElementById('reqcount');

// The board's filter and sort, and the paging of long lists, live here so a
// change re-renders from cached data instead of fetching again.
const state = { filter: 'open', sort: 'deadline', page: 1, view: '' };
let lastRoute = '';
// The leaderboard view a bounty was last shown in, by slug: the API's
// default view is only learned from the first answer, so remembering it
// keeps a return visit on the same cached URL instead of fetching twice.
const viewBySlug = {};

/** The countdowns tick in place every 30 s: the text changes, the page is never rebuilt for it. */
setInterval(() => {
  for (const el of document.querySelectorAll('[data-deadline]')) {
    el.textContent = timeLeft(el.getAttribute('data-deadline'));
  }
}, 30_000);

function showCounter() {
  counter.textContent = `${stats.fetched} request${stats.fetched === 1 ? '' : 's'} · ${stats.served} served from cache`;
}

function failed(message) {
  return `<div class="error"><p>${message}</p><p><button type="button" data-retry>Try again</button></p></div>`;
}

async function render() {
  window.__shotReady = false;
  const hash = location.hash || '#/';
  // A new route starts its paging over; paging and sorting inside one view keep their place.
  // A leaderboard return visit keeps the view it was last shown in.
  if (hash !== lastRoute) {
    lastRoute = hash;
    state.page = 1;
    const lbMatch = hash.match(/^#\/bounty\/([^/]+)\/leaderboard$/);
    state.view = lbMatch ? (viewBySlug[decodeURIComponent(lbMatch[1])] ?? '') : '';
  }
  const bountyMatch = hash.match(/^#\/bounty\/([^/]+)(?:\/leaderboard)?$/);
  const profileMatch = hash.match(/^#\/u\/([^/]+)$/);
  const isLeaderboard = hash.includes('/leaderboard');
  app.innerHTML = '<p class="loading">Loading…</p>';

  try {
    if (profileMatch) {
      const handle = decodeURIComponent(profileMatch[1]);
      const p = await getProfile(handle);
      if (!p || p.error) {
        document.title = 'Profile not found | make.fun';
        app.innerHTML = failed(`No account “${handle}” was found.`) + '<p><a href="#/">← Back to the board</a></p>';
      } else {
        document.title = `@${p.handle} | make.fun`;
        app.innerHTML = profileView(p, state.page);
      }
    } else if (bountyMatch) {
      const slug = decodeURIComponent(bountyMatch[1]);
      if (isLeaderboard) {
        const lb = await getLeaderboard(slug, state.view || undefined);
        if (!lb || lb.error || !lb.competition) {
          document.title = 'Leaderboard not found | make.fun';
          app.innerHTML = failed(`No leaderboard for “${slug}” was found.`) + '<p><a href="#/">← Back to the board</a></p>';
        } else {
          state.view = lb.view ?? state.view;
          viewBySlug[slug] = state.view;
          document.title = `${lb.competition.title} — leaderboard | make.fun`;
          app.innerHTML = leaderboardView(lb, state.page, state.view);
        }
      } else {
        const b = await getBounty(slug);
        if (!b || b.error) {
          document.title = 'Bounty not found | make.fun';
          app.innerHTML = failed(`No bounty “${slug}” was found.`) + '<p><a href="#/">← Back to the board</a></p>';
        } else {
          document.title = `${b.title} | make.fun`;
          app.innerHTML = bountyView(b);
        }
      }
    } else {
      const data = await getBounties();
      if (!data || data.error) {
        document.title = 'make.fun bounties';
        app.innerHTML = failed('The bounty board could not be loaded. Check your connection and try again.');
      } else {
        document.title = 'make.fun bounties';
        app.innerHTML = boardView(data.items ?? [], state.filter, state.sort);
      }
    }
  } catch {
    app.innerHTML = failed('Something went wrong while loading this view.');
  }
  window.scrollTo(0, 0);
  showCounter();
  window.__shotReady = true;
}

// One delegated listener for the controls the views render: filter chips and
// sort on the board, paging on the long tables, the leaderboard's view switch.
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
