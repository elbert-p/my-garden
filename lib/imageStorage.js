import { supabase } from './supabaseClient';

const BUCKET = 'images';

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
  const ext = blob.type === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });

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