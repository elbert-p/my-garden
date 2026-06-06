// Helpers for autofill reference images and their photo credits.
// Image paths and credits live in plants_dynamic.json, keyed by Latin name:
//   "Autofill image paths":   ["aquilegia_canadensis.jpg", ...]
//   "Autofill image credits": ["K. Elbert", ...]   // parallel to paths
import plantsData from '@/plants_dynamic.json';

const AUTOFILL_BUCKET = 'autofill_images';

/** Public Supabase Storage URL for an autofill image file name. */
export const buildAutofillImageUrl = (path) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AUTOFILL_BUCKET}/${path}`;

/**
 * First autofill image URL for a species entry, or '' if none.
 * Pass the entry object (e.g. the autofill match data).
 */
export const getAutofillImageUrl = (entry) => {
  const paths = entry?.['Autofill image paths'];
  if (!Array.isArray(paths) || !paths[0]) return '';
  return buildAutofillImageUrl(paths[0]);
};

/** Resolve true only if the image at `url` actually loads (so we never store a dead URL). */
export const imageExists = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(false);
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });

// Reverse index: autofill image URL -> credit. Image paths are unique per
// photo, so the credit follows the specific image regardless of which plant
// uses it or whether its scientific name later changes. Built once, lazily.
let creditsByUrl = null;
const getCreditsByUrl = () => {
  if (creditsByUrl) return creditsByUrl;
  creditsByUrl = new Map();
  for (const entry of Object.values(plantsData)) {
    const paths = entry['Autofill image paths'];
    const credits = entry['Autofill image credits'];
    if (!Array.isArray(paths) || !Array.isArray(credits)) continue;
    paths.forEach((path, i) => {
      if (path && credits[i]) creditsByUrl.set(buildAutofillImageUrl(path), credits[i]);
    });
  }
  return creditsByUrl;
};

/**
 * Photo credit for a given image URL, or null if it isn't a credited autofill
 * image. Keyed on the image itself, so it's unique per photo and unaffected by
 * scientific-name edits.
 */
export const getImageCredit = (imageUrl) => {
  if (!imageUrl) return null;
  return getCreditsByUrl().get(imageUrl) || null;
};
