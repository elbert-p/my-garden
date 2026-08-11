// Tracks changes to the bundled plant reference database (plants_dynamic.json)
// so the app can notice when reference data that matches plants already in a
// user's garden is added *or updated*, and offer to (re)autofill them.
//
// The reference data is shipped in the client bundle and only changes when the
// app is redeployed, so checks are deliberately cheap and rare:
//   - Each entry gets a content signature over the fields autofill uses. A
//     "version" is a signature of all of those together; it changes only when
//     some entry's autofill-relevant data changes — exactly what can create a
//     new or improved autofill opportunity.
//   - "changedTokens" are the matchable tokens (scientific keys + common /
//     alternate names) belonging to entries that were added or modified since
//     the last check.
//   - Both are computed at most once per day (throttled by a stored timestamp)
//     and cached in localforage, so every garden reuses the same result instead
//     of re-scanning the whole database.
import plantsData from '@/plants_dynamic.json';
import localforage from 'localforage';

const STORE_KEY = 'autofillDbState';
const DAY_MS = 24 * 60 * 60 * 1000;

export const norm = (s) => (s || '').trim().toLowerCase();

// A small, stable string hash (cyrb53) used to signature tokens/entries.
const hashString = (str) => {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

// Signature over exactly the fields autofill reads, so the version bumps when —
// and only when — an entry's autofillable content changes.
const entryContent = (e) => JSON.stringify([
  e['Latin name'], e['Common name'], e['Alternate common names'],
  e['Bloom time'], e['Height'], e['Sunlight'], e['Moisture'],
  e['plantType'], e['Native Range'], e['Hosted Butterflies and Moths'],
  e['Autofill image paths'],
]);

// Per-entry content signatures + the tokens each entry can be matched on
// (mirrors findData). Computed once per session.
let sessionIndex = null;
const buildIndex = () => {
  if (sessionIndex) return sessionIndex;
  const sigs = {};        // normKey -> content hash
  const tokensByKey = {}; // normKey -> [matchable tokens]
  for (const key of Object.keys(plantsData)) {
    const entry = plantsData[key];
    const nk = norm(key);
    const tokens = new Set([nk]);
    if (entry['Latin name']) tokens.add(norm(entry['Latin name']));
    if (entry['Common name']) tokens.add(norm(entry['Common name']));
    const alts = entry['Alternate common names'];
    if (Array.isArray(alts)) alts.forEach(a => a && tokens.add(norm(a)));
    tokensByKey[nk] = [...tokens];
    sigs[nk] = hashString(entryContent(entry));
  }
  const keysSorted = Object.keys(sigs).sort();
  const version = `${hashString(keysSorted.map(k => `${k}:${sigs[k]}`).join('|'))}.${keysSorted.length}`;
  sessionIndex = { version, sigs, tokensByKey };
  return sessionIndex;
};

/**
 * Return the current reference-DB { version, changedTokens }.
 *
 * `changedTokens` is the list of matchable tokens belonging to entries that
 * were added or modified since the previous check. Throttled to at most one
 * real computation per day; otherwise the last cached result is returned. Never
 * throws — on any storage error it falls back to computing from the bundle.
 */
export async function getAutofillDbState() {
  let stored = null;
  try {
    stored = await localforage.getItem(STORE_KEY);
  } catch { /* treat as no stored state */ }

  const now = Date.now();

  // Within the daily window: reuse the cached result, no recomputation.
  if (stored && stored.checkedAt && (now - stored.checkedAt < DAY_MS)) {
    return { version: stored.version, changedTokens: stored.changedTokens || [] };
  }

  const { version, sigs, tokensByKey } = buildIndex();

  let changedTokens;
  if (!stored) {
    // First ever baseline — nothing counts as new/changed.
    changedTokens = [];
  } else if (stored.version !== version) {
    const prevSigs = stored.sigs || {};
    const changed = new Set();
    for (const key of Object.keys(sigs)) {
      if (prevSigs[key] !== sigs[key]) {
        (tokensByKey[key] || []).forEach(t => changed.add(t));
      }
    }
    changedTokens = [...changed];
  } else {
    // Unchanged since last time — keep the last diff for gardens that haven't
    // reconciled it yet.
    changedTokens = stored.changedTokens || [];
  }

  try {
    await localforage.setItem(STORE_KEY, { version, sigs, changedTokens, checkedAt: now });
  } catch { /* best-effort cache; reconciliation still works this session */ }

  return { version, changedTokens };
}
