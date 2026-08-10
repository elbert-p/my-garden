// Shared plant autofill logic: look a plant up in the reference database
// (plants_dynamic.json, keyed by Latin name) and build the field updates to
// apply. Used by the plant detail page's Autofill action and by bulk upload.
import plantsData from '@/plants_dynamic.json';
import { getAutofillImageUrl, imageExists } from './autofillImages';

/** Case-insensitive lookup by Latin/scientific name (the JSON key). */
export const findByScientific = (name) => {
  if (!name) return null;
  const key = Object.keys(plantsData).find(k => k.toLowerCase() === name.trim().toLowerCase());
  return key ? plantsData[key] : null;
};

/** Lookup by common name, matching the primary or any alternate common name. */
export const findByCommon = (name) => {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  return Object.values(plantsData).find(entry => {
    if ((entry['Common name'] || '').trim().toLowerCase() === normalized) return true;
    const alts = entry['Alternate common names'];
    if (Array.isArray(alts) && alts.some(a => a.trim().toLowerCase() === normalized)) return true;
    return false;
  }) || null;
};

// Scientific name takes priority; returns { data, matchedBy } or null.
export const findData = (scientificName, commonName) => {
  const byScientific = findByScientific(scientificName);
  if (byScientific) return { data: byScientific, matchedBy: 'scientific' };
  const byCommon = findByCommon(commonName);
  if (byCommon) return { data: byCommon, matchedBy: 'common' };
  return null;
};

/**
 * Build the autofilled field updates for `plant` given a `findData` result.
 * Existing values on the plant are preserved when the reference has none.
 * Returns an object of updates (camelCase) including `hasAutofilled: true`.
 *
 * @param {object} plant - current plant (camelCase model)
 * @param {{data: object, matchedBy: 'scientific'|'common'}} result
 * @param {object} [opts] - { validateImage: boolean } — when true (default),
 *   a reference image is only used if it actually loads (needs a browser).
 */
export async function buildAutofillUpdates(plant, result, opts = {}) {
  const { validateImage = true } = opts;
  const { data, matchedBy } = result;

  // Determine common name:
  // - Matched by common name: keep the user's entered name (already recognized)
  // - Matched by scientific name: replace with the DB common name unless the
  //   user's current common name matches the DB common/alternate names
  let commonName = plant.commonName?.trim() || '';
  if (matchedBy === 'scientific' && data['Common name']) {
    const userCommon = commonName.toLowerCase();
    const dbCommon = data['Common name'].trim().toLowerCase();
    const dbAlts = (data['Alternate common names'] || []).map(a => a.trim().toLowerCase());
    const isRecognized = userCommon && (userCommon === dbCommon || dbAlts.includes(userCommon));
    if (!isRecognized) commonName = data['Common name'].trim();
  }

  // Use the reference image (first path) only if the user has no image — and,
  // when validating, only if it actually loads, so we never store a dead URL.
  let mainImage = plant.mainImage;
  if (!mainImage) {
    const candidate = getAutofillImageUrl(data);
    if (validateImage) {
      mainImage = (candidate && await imageExists(candidate)) ? candidate : '';
    } else {
      mainImage = candidate || '';
    }
  }

  return {
    commonName,
    mainImage,
    scientificName: data['Latin name']?.trim() || plant.scientificName,
    bloomTime: data['Bloom time'] || plant.bloomTime,
    height: data['Height'] || plant.height,
    sunlight: data['Sunlight'] || plant.sunlight,
    moisture: data['Moisture'] || plant.moisture,
    plantType: data['plantType'] || plant.plantType,
    nativeRange: data['Native Range'] || plant.nativeRange,
    hostedInsects: data['Hosted Butterflies and Moths'] || plant.hostedInsects,
    hasAutofilled: true,
  };
}
