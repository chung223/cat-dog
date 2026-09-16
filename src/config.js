// Shared daily leaderboard.
//
// Leave these empty and the game falls back to a local board — your own daily
// results, kept in this browser. Fill them in (see the README for the table
// and its row-level security policies) and every player's daily time goes to
// the same table.
//
// Both values are safe to commit. A Supabase anon key is designed to be
// public; what stops abuse is the RLS policy on the table, not secrecy.

const BAKED_IN = {
  url: '', // e.g. https://abcdefgh.supabase.co
  anonKey: '',
  table: 'scores',
};

// A local override, handy for trying a backend out before committing to it:
//   localStorage.setItem('shiba-grid/leaderboard', JSON.stringify({ url, anonKey }))
function override() {
  try {
    return JSON.parse(localStorage.getItem('shiba-grid/leaderboard') || 'null');
  } catch {
    return null;
  }
}

export function leaderboardConfig() {
  return { ...BAKED_IN, ...(override() || {}) };
}

export function leaderboardEnabled() {
  const config = leaderboardConfig();
  return Boolean(config.url && config.anonKey);
}
