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
// To add a new badge: append an object with { key, icon, filterLabel, criteria[] }.
// Each criterion has { key, label, check(entry) }.
// A badge is earned when ANY criterion passes.

export const BADGE_DEFS = [
  {
    key: 'bee',
    icon: '/Bee Icon 3_85.png',
    filterLabel: 'Bees',
    criteria: [
      {
        key: 'specialistBees',
        label: 'Specialist Bees',
        tooltip: 'Top 30 Native Host plant for Pollen Specialist Bees',
        check: (entry) => {
          const khp = entry['Key Host Plant'];
          return Array.isArray(khp) && khp.includes('Specialist Bees');
        },
      },
      {
        key: 'bumblebees',
        label: 'Bumblebees',
        tooltip: 'Native plant recommended for bumblebees in MA',
        check: (entry) => entry['Bumblebees'] === 1,
      },
      {
        key: 'pollenSource',
        label: 'Pollen Source',
        tooltip: 'Pollen source for MA Specialist, Endangered, Threatened, or At-risk bees',
        check: (entry) => !!entry['Pollen Source'],
      },
    ],
  },
];

// --- Cache: keyed by "commonName\0scientificName" → badge array / reasons ---
// Entries persist for the session. A new key is generated if either name changes,
// so renamed plants are automatically rechecked.

const cache = new Map();
const reasonsCache = new Map();

export function getPlantBadges(commonName, scientificName) {
  const cacheKey = `${commonName || ''}\0${scientificName || ''}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const entry = findByScientific(scientificName) || findByCommon(commonName);
  const badges = [];
  if (entry) {
    for (const def of BADGE_DEFS) {
      if (def.criteria.some(c => c.check(entry))) {
        badges.push({ key: def.key, icon: def.icon });
      }
    }
  }
  cache.set(cacheKey, badges);
  return badges;
}

/** Returns a tooltip string for a badge, e.g. "Supports specialist bees, supports bumblebees" */
export function getBadgeTooltip(badgeKey, commonName, scientificName) {
  const reasons = getPlantBadgeReasons(commonName, scientificName);
  const matched = reasons[badgeKey] || [];
  const def = BADGE_DEFS.find(d => d.key === badgeKey);
  if (!def) return badgeKey;
  const parts = def.criteria
    .filter(c => matched.includes(c.key))
    .map(c => c.tooltip);
  return parts.length > 0 ? parts.join(', ') : badgeKey;
}

/** Returns matched criteria keys per badge, e.g. { bee: ['specialistBees', 'bumblebees'] } */
export function getPlantBadgeReasons(commonName, scientificName) {
  const cacheKey = `${commonName || ''}\0${scientificName || ''}`;
  if (reasonsCache.has(cacheKey)) return reasonsCache.get(cacheKey);

  const entry = findByScientific(scientificName) || findByCommon(commonName);
  const reasons = {};
  if (entry) {
    for (const def of BADGE_DEFS) {
      const matched = def.criteria.filter(c => c.check(entry)).map(c => c.key);
      if (matched.length > 0) reasons[def.key] = matched;
    }
  }
  reasonsCache.set(cacheKey, reasons);
  return reasons;
}
