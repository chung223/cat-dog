// Talks to the shared leaderboard, when one is configured.
//
// Honest warning, repeated in the README: the game runs entirely in the
// browser, so a submitted time is whatever the client says it is. Nothing here
// can prove a run happened. It is a scoreboard among people playing along, not
// a competitive ranking.

import { leaderboardConfig, leaderboardEnabled } from './config.js';

export { leaderboardEnabled };

const TIMEOUT_MS = 8000;

async function call(path, options = {}) {
  const config = leaderboardConfig();
  if (!config.url || !config.anonKey) throw new Error('leaderboard is not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!response.ok) throw new Error(`leaderboard returned ${response.status}`);
    // An insert with Prefer: return=minimal answers 201 with an empty body,
    // so only parse when there is actually something there.
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

/** Today's fastest runs, quickest first. */
export async function fetchTop(day, limit = 50) {
  const { table } = leaderboardConfig();
  const query = new URLSearchParams({
    day: `eq.${day}`,
    select: 'name,seconds,mistakes,hints,size',
    order: 'seconds.asc,hints.asc,mistakes.asc',
    limit: String(limit),
  });
  const rows = await call(`${table}?${query}`);
  return Array.isArray(rows) ? rows : [];
}

export async function submitScore(entry) {
  const { table } = leaderboardConfig();
  await call(table, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      day: entry.day,
      name: entry.name.slice(0, 16),
      seconds: entry.seconds,
      mistakes: entry.mistakes,
      hints: entry.hints,
      size: entry.size,
    }),
  });
}
