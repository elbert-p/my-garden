// Version + per-entry signatures for the bundled plant reference database
// (plants_dynamic.json), used to detect when a garden plant is out of date with
// the database and offer to (re)autofill it.
//
// Everything here is derived from the bundled data, so it needs no storage of
// its own:
//   - `getReferenceVersion()` is a signature of the whole database. It changes
//     only when a deploy alters autofill-relevant data, and is used as a cheap
//     per-garden gate: a garden is only re-scanned when its recorded version
//     differs from the current one.
//   - `entrySignature(entry)` signatures a single entry's autofill-relevant
//     fields. Each plant records the signature of the entry it was last
//     autofilled/declined against; when that differs from the entry's current
//     signature, the plant has a pending change. This is self-describing per
//     plant, so it works for any garden — including ones created before this
//     system existed — with no snapshot to fall out of sync.
import plantsData from '@/plants_dynamic.json';

export const norm = (s) => (s || '').trim().toLowerCase();

// A small, stable string hash (cyrb53).
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

// Serialize exactly the fields autofill reads, so a signature changes when — and
// only when — an entry's autofillable content changes.
const entryContent = (e) => JSON.stringify([
  e['Latin name'], e['Common name'], e['Alternate common names'],
  e['Bloom time'], e['Height'], e['Sunlight'], e['Moisture'],
  e['plantType'], e['Native Range'], e['Hosted Butterflies and Moths'],
  e['Autofill image paths'],
]);

/** Signature of a single reference entry's autofillable content. '' if falsy. */
export const entrySignature = (entry) => (entry ? hashString(entryContent(entry)) : '');

// Whole-database version, computed once per session.
let cachedVersion = null;
export const getReferenceVersion = () => {
  if (cachedVersion) return cachedVersion;
  const keys = Object.keys(plantsData).sort();
  const combined = keys.map(k => `${norm(k)}:${entrySignature(plantsData[k])}`).join('|');
  cachedVersion = `${hashString(combined)}.${keys.length}`;
  return cachedVersion;
};
