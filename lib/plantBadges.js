import plantsData from '@/plants_dynamic.json';

// --- Lookup helpers (same logic as plant page autofill) ---

const findByScientific = (name) => {
  if (!name) return null;
  const key = Object.keys(plantsData).find(
    (k) => k.toLowerCase() === name.trim().toLowerCase()
  );
  return key ? plantsData[key] : null;
};

const findByCommon = (name) => {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  return (
    Object.values(plantsData).find((entry) => {
      if ((entry['Common name'] || '').trim().toLowerCase() === normalized) return true;
      const alts = entry['Alternate common names'];
      if (Array.isArray(alts) && alts.some((a) => a.trim().toLowerCase() === normalized)) return true;
      return false;
    }) || null
  );
};

// --- Badge definitions ---
// To add a new badge: append an object with { key, icon, check(entry) }.

const BADGE_DEFS = [
  {
    key: 'bee',
    icon: '/2Asset 2.png',
    check: (entry) => {
      const khp = entry['Key Host Plant'];
      if (Array.isArray(khp) && khp.includes('Specialist Bees')) return true;
      if (entry['Bumblebees'] === 1) return true;
      return false;
    },
  },
];

// --- Cache: keyed by "commonName\0scientificName" → badge array ---
// Entries persist for the session. A new key is generated if either name changes,
// so renamed plants are automatically rechecked.

const cache = new Map();

export function getPlantBadges(commonName, scientificName) {
  const cacheKey = `${commonName || ''}\0${scientificName || ''}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const entry = findByScientific(scientificName) || findByCommon(commonName);
  const badges = [];
  if (entry) {
    for (const def of BADGE_DEFS) {
      if (def.check(entry)) badges.push({ key: def.key, icon: def.icon });
    }
  }
  cache.set(cacheKey, badges);
  return badges;
}
