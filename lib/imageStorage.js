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
  initialQuality: 0.8,
  // Never trade resolution for file size: the plant page opens photos
  // near-fullscreen in the lightbox. This only disables the fallback that
  // shrinks dimensions when quality alone can't hit maxSizeMB — the initial
  // maxWidthOrHeight resize still applies.
  alwaysKeepResolution: true,
};

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