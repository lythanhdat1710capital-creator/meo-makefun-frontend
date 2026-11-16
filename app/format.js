// Small helpers for showing API values. Every string the API sends is
// escaped before it reaches innerHTML, so a bounty title can never inject
// markup into the page.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('1000.00', '0.50', 500) as '$1,000' or '$0.50'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
}

/** A whole number with thousands separators. */
export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

/** A byte count as '745 B', '12 KB' or '1.2 MB'. */
export function bytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** A place number as '1st', '2nd', '3rd', '4th'. */
export function ordinal(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const lastTwo = n % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** A date as 'Nov 18, 2026, 6:00 PM UTC'. */
export function date(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** A judge score in micro units (940081) as '94.01%'. */
export function pct(micro) {
  const n = Number(micro);
  if (!Number.isFinite(n)) return '—';
  return `${(n / 10000).toFixed(2)}%`;
}

/** The time until a deadline: '2d 4h left', '35m left', '12s left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const parts = [
    [86400000, 'd'],
    [3600000, 'h'],
    [60000, 'm'],
    [1000, 's'],
  ];
  const out = [];
  let rest = ms;
  for (const [size, unit] of parts) {
    const n = Math.floor(rest / size);
    if (n > 0) out.push(`${n}${unit}`);
    rest %= size;
    if (out.length === 2) break;
  }
  return `${out.join(' ')} left`;
}

/** How long ago a timestamp was: '3h ago', '2d ago', 'just now'. */
export function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

/** True while a bounty still takes entries: the API may still read status open after the deadline, so the deadline decides, not the status alone. */
export function takingEntries(b) {
  return b?.acceptingSubmissions !== false && new Date(b?.deadline).getTime() > Date.now();
}
