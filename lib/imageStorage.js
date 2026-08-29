import { supabase } from './supabaseClient';

const BUCKET = 'images';

// Uploaded objects are named with a fresh UUID and never overwritten
// (`upsert: false`), so a URL's bytes can't change and it's safe to let
// browsers and the CDN hold onto them for a year. The Supabase default is one
// hour, which had returning visitors re-downloading whole gardens.
// Trade-off: a deleted image stays reachable from caches for up to this long.
const CACHE_CONTROL_SECONDS = '31536000';

const EXTENSION_BY_MIME = {
  'image/png': 'png',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
};

/**
 * Settings for browser-image-compression, applied everywhere a user picks a
 * photo. Every upload lands as JPEG at full 1920px resolution.
 */
export const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  // The library otherwise keeps the source MIME type. PNG has no quality knob,
  // so PNG uploads could only reach maxSizeMB by throwing away resolution —
  // real ones landed around 700px wide and still weighed ~930 KB.
  fileType: 'image/jpeg',
  // The default quality of 1.0 only stops once the file dips under maxSizeMB,
  // which is why stored photos clustered just below 1 MB. 0.8 at 1920px is
  // visually indistinguishable and roughly a third of the size — raise it if
  // you can see artefacts in the plant page lightbox.
  initialQuality: 0.9,
  // Never trade resolution for file size: the plant page opens photos
  // near-fullscreen in the lightbox. This only disables the fallback that
  // shrinks dimensions when quality alone can't hit maxSizeMB — the initial
  // maxWidthOrHeight resize still applies.
  alwaysKeepResolution: true,
};

// ============ IMAGE TRANSFORMATIONS ============
// Supabase resizes on the fly (Pro plan, enabled in Storage Settings), so
// there's nothing to pre-generate or back-fill — these URLs work on every
// image already in the bucket.

const OBJECT_PATH = '/storage/v1/object/public/';
const RENDER_PATH = '/storage/v1/render/image/public/';

/**
 * Tile sizes offered to the browser via srcset. It picks one per tile from
 * the rendered width and the screen's pixel density, so this ladder is what
 * makes grid images adapt to column count, viewport and retina.
 *
 * Covers the range this app's tiles actually occupy: 256 device px at 8
 * columns on a laptop, up to ~2100 at 1 column on a 27-inch display at 2x.
 * Simulated against every column/viewport/density combination the app can
 * produce, 35 of 36 get a size at or above what the tile needs; the last is
 * 1 column on a 2560px screen, which wants more detail than a 1920px original
 * holds. Billing counts distinct source images rather than variants, so
 * lengthening this list costs nothing but extra CDN cache entries.
 */
const TILE_WIDTHS = [400, 800, 1200, 1600, 1920];

/** Transform quality, 20-100. Supabase defaults to 80. */
const TILE_QUALITY = 80;

/**
 * A grid tile's URL at one size, or the input unchanged for anything not in
 * Storage (local /public placeholders, data URLs from signed-out users).
 *
 * Always sends width, height and resize together. With width alone the
 * transformer pins the width but keeps the source height — a 1805x1824 photo
 * comes back 400x1824, badly stretched. Asking for a square crop instead
 * matches the `object-fit: cover` the tiles already apply in CSS, and is
 * fewer bytes than shipping the full frame for the browser to crop.
 */
export function tileUrl(imageUrl, size = TILE_WIDTHS[0]) {
  if (!imageUrl || isDataUrl(imageUrl) || !imageUrl.includes(OBJECT_PATH)) return imageUrl;
  const base = imageUrl.replace(OBJECT_PATH, RENDER_PATH);
  return `${base}?width=${size}&height=${size}&resize=cover&quality=${TILE_QUALITY}`;
}

/**
 * srcset across TILE_WIDTHS. Pair with a `sizes` describing the tile's width —
 * ItemGrid derives one from its own column maths.
 *
 * Sources smaller than a requested size come back at their own dimensions, so
 * that candidate's `w` is an over-statement. Harmless: there's no more detail
 * in the original for a larger candidate to have offered.
 */
export function tileSrcSet(imageUrl) {
  if (!imageUrl || isDataUrl(imageUrl) || !imageUrl.includes(OBJECT_PATH)) return undefined;
  return TILE_WIDTHS.map((size) => `${tileUrl(imageUrl, size)} ${size}w`).join(', ');
}

/** Check if a string is a base64 data URL */
export const isDataUrl = (str) =>
  !!str && typeof str === 'string' && str.startsWith('data:');

/** Convert a data URL to a Blob */
function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Upload an image to Supabase Storage.
 * If the value is already a URL (not a data URL), returns it unchanged.
 * @param {string} dataUrl - base64 data URL or existing URL
 * @param {string} userId - owner's user ID (used as folder prefix)
 * @param {string} folder - subfolder name ('plants' | 'gardens')
 * @returns {Promise<string>} public URL of the uploaded image
 */
export async function uploadImage(dataUrl, userId, folder = 'plants') {
  if (!dataUrl || !isDataUrl(dataUrl)) return dataUrl;

  const blob = dataUrlToBlob(dataUrl);
  const ext = EXTENSION_BY_MIME[blob.type] || 'jpg';
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: blob.type,
      upsert: false,
      cacheControl: CACHE_CONTROL_SECONDS,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete an image from Supabase Storage by its public URL.
 * Silently ignores non-storage URLs, data URLs, and errors.
 */
export async function deleteImage(imageUrl) {
  if (!imageUrl || isDataUrl(imageUrl)) return;

  try {
    // Build the base URL for this bucket to extract the path
    const baseUrl = supabase.storage.from(BUCKET).getPublicUrl('').data.publicUrl;
    if (!imageUrl.startsWith(baseUrl)) return; // not a storage URL

    const path = imageUrl.slice(baseUrl.length);
    if (path) {
      await supabase.storage.from(BUCKET).remove([path]);
    }
  } catch (err) {
    console.error('[ImageStorage] Delete failed:', err);
  }
}