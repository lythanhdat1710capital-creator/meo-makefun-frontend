// The four surfaces, each a function from API data to HTML. Every value the
// API sends passes through esc() in format.js before it reaches the page.
//
// The board is one request: the list already carries each bounty's live pot,
// entry fee, deadline and entry count, so no bounty is fetched twice.
// The leaderboard is one request too: rows=first brings the top 10 in full
// plus the rest in compact form, and the table pages through them locally.

import { bytes, date, esc, money, num, pct, takingEntries, timeLeft } from './format.js';

/** The live pot: the prize plus the entry fees paid into it. */
export function pot(b) {
  return money(b.potUsd ?? b.rewardAmount);
}

/** The entry fee, when the bounty charges one. */
export function fee(b) {
  return b.entryFeeUsd ? money(b.entryFeeUsd) : null;
}

/** A bounty row's status pill: open while it still takes entries, ended after its deadline. */
function statusPill(b) {
  return takingEntries(b)
    ? '<span class="pill pill-open">Open</span>'
    : '<span class="pill pill-ended">Ended</span>';
}

/** The board: stat strip, filters, and one row per bounty. */
export function boardView(items, filter, sort) {
  const now = Date.now();
  const open = items.filter((b) => takingEntries(b));
  const endingSoon = open.filter((b) => new Date(b.deadline).getTime() - now < 86400000);
  const totalPot = items.reduce((sum, b) => sum + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const totalEntries = items.reduce((sum, b) => sum + Number(b.submissionCount ?? 0), 0);

  let rows = [...items];
  if (filter === 'open') rows = open;
  if (filter === 'soon') rows = endingSoon;
  if (sort === 'pot') rows.sort((a, b) => Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0));
  else if (sort === 'entries') rows.sort((a, b) => Number(b.submissionCount ?? 0) - Number(a.submissionCount ?? 0));
  else rows.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const chip = (key, label) =>
    `<button type="button" class="chip${filter === key ? ' chip-on' : ''}" data-filter="${key}">${label}</button>`;
  const sortOptions = [
    ['deadline', 'Ending soonest'],
    ['pot', 'Biggest pot'],
    ['entries', 'Most entries'],
  ]
    .map(([key, label]) => `<option value="${key}"${sort === key ? ' selected' : ''}>${label}</option>`)
    .join('');

  return `
  <h1>Open bounties</h1>
  <section class="stats">
    <div class="stat"><b>${open.length}</b><span>open now</span></div>
    <div class="stat"><b>${money(totalPot)}</b><span>live pots, all bounties</span></div>
    <div class="stat"><b>${num(totalEntries)}</b><span>entries so far</span></div>
    <div class="stat"><b>${endingSoon.length}</b><span>ending in 24h</span></div>
  </section>
  <div class="toolbar">
    <div class="chips">${chip('open', 'Open now')}${chip('soon', 'Ending in 24h')}${chip('all', 'All bounties')}</div>
    <label class="sort">Sort <select data-sort>${sortOptions}</select></label>
  </div>
  <ul class="board">
    ${rows
      .map(
        (b) => `
      <li class="card${takingEntries(b) ? '' : ' card-ended'}">
        <a class="card-title" href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a>
        <p class="card-summary">${esc(b.summary ?? b.description ?? '')}</p>
        <div class="card-meta">
          <span class="pot">${pot(b)}</span>
          ${fee(b) ? `<span class="fee">Fee ${fee(b)}</span>` : ''}
          <span class="time" data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>
          <span class="entries">${num(b.submissionCount)} entries</span>
          ${statusPill(b)}
        </div>
        <div class="card-tags"><span>${esc(b.category ?? '')}</span>${(b.skills ?? []).slice(0, 3).map((s) => `<span>${esc(s)}</span>`).join('')}</div>
      </li>`,
      )
      .join('')}
  </ul>
  ${rows.length === 0 ? '<p class="empty">No bounties match this filter.</p>' : ''}`;
}

/** A bounty's page: summary, live pot, fee, dates, rewards table, rules text. */
export function bountyView(b) {
  const open = takingEntries(b);
  const rewards = (b.rewardsNow ?? []).length
    ? b.rewardsNow
    : Object.entries(b.rewards ?? {}).map(([place, amount]) => ({ place: Number(place), baseUsd: amount, feeShareUsd: '0.00', amountUsd: amount }));
  const paragraphs = String(b.description ?? '')
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => `<p>${esc(p.trim())}</p>`)
    .join('');

  return `
  <p class="crumbs"><a href="#/">All bounties</a> &rsaquo; ${esc(b.category ?? '')}</p>
  <h1>${esc(b.title)}</h1>
  <p class="lede">${esc(b.summary ?? '')}</p>
  <section class="stats">
    <div class="stat"><b>${pot(b)}</b><span>live pot</span></div>
    <div class="stat"><b>${fee(b) ?? 'Free'}</b><span>entry fee</span></div>
    <div class="stat"><b data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</b><span>time left</span></div>
    <div class="stat"><b>${num(b.submissionCount)}</b><span>entries</span></div>
  </section>
  <p class="statusline">${open ? '<span class="pill pill-open">Accepting entries</span>' : '<span class="pill pill-ended">Entries closed</span>'}
    <span>Opened ${date(b.opensAt ?? b.publishedAt)} · Deadline ${date(b.deadline)}</span></p>
  <div class="actions">
    <a class="button" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard</a>
    <a class="button button-ghost" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}">View on make.fun</a>
  </div>
  <h2>Rewards</h2>
  <table class="rewards">
    <thead><tr><th>Place</th><th>Prize</th><th>Fee share</th><th>Total</th></tr></thead>
    <tbody>
      ${rewards.map((r) => `<tr><td>${esc(r.place)}</td><td>${money(r.baseUsd)}</td><td>${money(r.feeShareUsd)}</td><td><b>${money(r.amountUsd)}</b></td></tr>`).join('')}
    </tbody>
  </table>
  <h2>About this bounty</h2>
  <div class="description">${paragraphs}</div>
  <p class="actions"><a class="button" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">See the leaderboard</a></p>`;
}

/** One leaderboard row: full entries carry every column, compact rest rows carry the rank value and its interval. */
function leaderboardRow(e, rankKey, micro) {
  const value = e.values ? e.values[rankKey] : e.value;
  const shown = micro ? pct(value) : esc(e.display?.[rankKey] ?? value ?? '—');
  const low = e.values ? e.values[`${rankKey}_low`] : e.interval?.low;
  const high = e.values ? e.values[`${rankKey}_high`] : e.interval?.high;
  const interval = low != null && high != null ? `${micro ? pct(low) : esc(low)} – ${micro ? pct(high) : esc(high)}` : '—';
  const size = e.values?.bytes != null ? bytes(e.values.bytes) : '—';
  return `<tr>
    <td>${num(e.rank)}</td>
    <td><a href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a>${e.house ? ' <span class="pill pill-house">house</span>' : ''}</td>
    <td>${esc(e.title ?? '')}</td>
    <td><b>${shown}</b></td>
    <td>${interval}</td>
    <td>${size}</td>
    <td>${esc(e.status ?? '')}</td>
  </tr>`;
}

/** A bounty's leaderboard: the table pages through every row locally, 25 a page, so a 4,500-row board never rebuilds the page to turn it. */
export function leaderboardView(lb, page, view) {
  const PAGE = 25;
  const full = lb.entries ?? [];
  const rest = lb.rest ?? [];
  const all = [...full, ...rest];
  const rankKey = lb.rank_key ?? 'judge';
  const rankCol = (lb.columns ?? []).find((c) => c.key === rankKey);
  const micro = (rankCol?.source ?? '').endsWith('_micro');
  const pages = Math.max(1, Math.ceil(all.length / PAGE));
  const current = Math.min(Math.max(page, 1), pages);
  const slice = all.slice((current - 1) * PAGE, current * PAGE);
  const viewOptions = (lb.views ?? []).length > 1
    ? `<label class="sort">View <select data-view>${(lb.views ?? []).map((v) => `<option value="${esc(v)}"${v === view ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`
    : '';

  return `
  <p class="crumbs"><a href="#/">All bounties</a> &rsaquo; <a href="#/bounty/${encodeURIComponent(lb.competition.slug)}">${esc(lb.competition.title)}</a> &rsaquo; Leaderboard</p>
  <h1>${esc(lb.competition.title)} — leaderboard</h1>
  <p class="lede">${esc(lb.phase?.title ?? '')} · ${lb.phase?.scores_visible ? 'scores live' : 'scores hidden'} · ${num(all.length)} entries</p>
  <div class="toolbar"><span class="muted">Page ${current} of ${pages}</span>${viewOptions}</div>
  <div class="tablewrap"><table class="board-table">
    <thead><tr><th>#</th><th>Entrant</th><th>Entry</th><th>${esc(rankCol?.title ?? 'Score')}</th><th>Interval</th><th>Size</th><th>Status</th></tr></thead>
    <tbody>${slice.map((e) => leaderboardRow(e, rankKey, micro)).join('')}</tbody>
  </table></div>
  <div class="pager">
    <button type="button" data-page="${current - 1}"${current <= 1 ? ' disabled' : ''}>← Previous</button>
    <span>Page ${current} of ${pages}</span>
    <button type="button" data-page="${current + 1}"${current >= pages ? ' disabled' : ''}>Next →</button>
  </div>`;
}

/** An account's public profile: identity, record, and every entry it made. */
export function profileView(p, page) {
  const PAGE = 10;
  const solutions = p.solutions ?? [];
  const pages = Math.max(1, Math.ceil(solutions.length / PAGE));
  const current = Math.min(Math.max(page, 1), pages);
  const slice = solutions.slice((current - 1) * PAGE, current * PAGE);
  const r = p.record ?? {};
  const initials = (p.handle ?? '?').slice(0, 2).toUpperCase();
  const avatar = p.avatar
    ? `<img class="avatar" crossorigin="anonymous" src="${esc(p.avatar)}" alt="">`
    : `<span class="avatar avatar-fallback" aria-hidden="true">${esc(initials)}</span>`;

  return `
  <section class="profile-head">
    ${avatar}
    <div>
      <h1>${esc(p.display_name ?? p.handle)}</h1>
      <p class="handle">@${esc(p.handle)}${p.house ? ' <span class="pill pill-house">house</span>' : ''}</p>
      ${p.bio ? `<p class="lede">${esc(p.bio)}</p>` : ''}
      <p class="muted">Joined ${date(p.joined_at)}${p.github_login ? ` · GitHub ${esc(p.github_login)}` : ''}${p.x ? ` · X @${esc(p.x)}` : ''}</p>
      ${p.wallet?.address ? `<p class="muted">Wallet <a href="${esc(p.wallet.explorer_url ?? '')}">${esc(p.wallet.address.slice(0, 8))}…${esc(p.wallet.address.slice(-4))}</a></p>` : ''}
    </div>
  </section>
  <section class="stats">
    <div class="stat"><b>${num(r.competitions_entered)}</b><span>bounties entered</span></div>
    <div class="stat"><b>${num(r.competitions_placed)}</b><span>placements</span></div>
    <div class="stat"><b>${num(r.competitions_won)}</b><span>wins</span></div>
    <div class="stat"><b>${num(r.podium_finishes)}</b><span>podiums</span></div>
    <div class="stat"><b>${money(r.prize_usd ?? 0)}</b><span>prizes won</span></div>
  </section>
  <h2>Entries (${num(solutions.length)})</h2>
  ${solutions.length === 0
    ? '<p class="empty">No entries yet.</p>'
    : `<div class="tablewrap"><table class="board-table">
      <thead><tr><th>Bounty</th><th>Entry</th><th>Place</th><th>Prize</th><th>Score</th><th>Entered</th></tr></thead>
      <tbody>${slice
        .map((s) => {
          const micro = (s.score?.column?.source ?? '').endsWith('_micro');
          const score = s.score ? (micro ? pct(s.score.value) : esc(s.score.display ?? s.score.value)) : '—';
          return `<tr>
            <td><a href="#/bounty/${encodeURIComponent(s.competition.slug)}">${esc(s.competition.title)}</a></td>
            <td>${esc(s.title ?? '')}</td>
            <td>${s.placement != null ? `#${num(s.placement)}` : '—'}</td>
            <td>${s.prize_usd != null ? money(s.prize_usd) : '—'}</td>
            <td>${score}</td>
            <td>${date(s.entered_at)}</td>
          </tr>`;
        })
        .join('')}</tbody>
    </table></div>
    <div class="pager">
      <button type="button" data-page="${current - 1}"${current <= 1 ? ' disabled' : ''}>← Previous</button>
      <span>Page ${current} of ${pages}</span>
      <button type="button" data-page="${current + 1}"${current >= pages ? ' disabled' : ''}>Next →</button>
    </div>`}`;
}
