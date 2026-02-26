/**
 * clipboardStorage.js — Utility for plant copy/paste and local recently-viewed tracking.
 * 
 * Plant copy uses localStorage with a 30-minute expiry.
 * Recently-viewed uses localStorage for all users (synced to Supabase for logged-in users
 * via dataService to enable shared profile display).
 * Saved gardens for non-logged-in users also use localStorage.
 */

// ============ PLANT COPY / PASTE ============

const COPY_PLANT_KEY = 'garden_copied_plant';
const COPY_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/** Store a plant's data for pasting into another garden */
export function setCopiedPlant(plantData) {
  const toStore = {
    commonName: plantData.commonName || '',
    scientificName: plantData.scientificName || '',
    mainImage: plantData.mainImage || '',
    datePlanted: plantData.datePlanted || '',
    bloomTime: plantData.bloomTime || [],
    height: plantData.height || '',
    sunlight: plantData.sunlight || [],
    moisture: plantData.moisture || [],
    nativeRange: plantData.nativeRange || [],
    notes: plantData.notes || '',
    images: plantData.images || [],
    hasAutofilled: plantData.hasAutofilled || false,
  };
  localStorage.setItem(COPY_PLANT_KEY, JSON.stringify({
    data: toStore,
    timestamp: Date.now(),
  }));
}

/** Retrieve the copied plant (null if expired or absent) */
export function getCopiedPlant() {
  try {
    const raw = localStorage.getItem(COPY_PLANT_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > COPY_EXPIRY_MS) {
      localStorage.removeItem(COPY_PLANT_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Clear the copied plant from storage */
export function clearCopiedPlant() {
  localStorage.removeItem(COPY_PLANT_KEY);
}

// ============ GARDEN COPY SOURCE ============

const COPY_GARDEN_KEY = 'garden_copy_source';

/** Store a garden ID + snapshot for copying */
export function setCopyGardenSource(gardenData) {
  localStorage.setItem(COPY_GARDEN_KEY, JSON.stringify({
    gardenId: gardenData.gardenId,
    name: gardenData.name,
    image: gardenData.image,
    isShared: gardenData.isShared || false,
  }));
}

/** Retrieve the copy-garden source (one-time read, clears after retrieval) */
export function getCopyGardenSource() {
  try {
    const raw = localStorage.getItem(COPY_GARDEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearCopyGardenSource() {
  localStorage.removeItem(COPY_GARDEN_KEY);
}

// ============ LOCAL RECENTLY VIEWED ============

const RECENT_KEY = 'garden_recently_viewed';
const MAX_RECENT = 20;

/** Record a garden view in localStorage */
export function addLocalRecentlyViewed(gardenId) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    let list = raw ? JSON.parse(raw) : [];
    list = list.filter(entry => entry.id !== gardenId);
    list.unshift({ id: gardenId, viewedAt: new Date().toISOString() });
    if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

/** Get locally stored recently viewed garden IDs (ordered by most recent) */
export function getLocalRecentlyViewed() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ============ LOCAL SAVED GARDENS (non-logged-in) ============

const SAVED_KEY = 'garden_saved_gardens';

export function addLocalSavedGarden(gardenId) {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    let list = raw ? JSON.parse(raw) : [];
    if (!list.includes(gardenId)) list.push(gardenId);
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

export function removeLocalSavedGarden(gardenId) {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    let list = raw ? JSON.parse(raw) : [];
    list = list.filter(id => id !== gardenId);
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

export function getLocalSavedGardens() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isLocalGardenSaved(gardenId) {
  return getLocalSavedGardens().includes(gardenId);
}