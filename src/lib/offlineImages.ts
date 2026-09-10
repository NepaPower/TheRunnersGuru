import { cacheGet, cacheSet } from './offlineCache';
import { resolveCourseSegmentImage, COURSE_SEGMENT_STORAGE_PREFIX } from './api';

/**
 * Offline support, step 3b: segment elevation images.
 *
 * A CourseSegment's `profileImage` is a `storage:`-prefixed private-bucket
 * path; online it's shown through a 1-hour signed URL, so it's useless
 * offline. Here we fetch each one once while online, downscale it, and
 * keep the bytes in IndexedDB (key `img:<ref>`, value a Blob) so the
 * Segment info popup can render it with no connection.
 */

const MAX_EDGE = 1600; // px on the long side — plenty for an elevation chart
const JPEG_QUALITY = 0.82;

/** Hard ceiling on the total downscaled image bytes cached for one plan. */
export const IMAGE_CACHE_CAP_BYTES = 25 * 1024 * 1024;

const keyFor = (ref: string) => `img:${ref}`;

/** Downscale to <= MAX_EDGE on the long side and re-encode as JPEG. Falls
 * back to the original blob on any failure (unsupported format, no canvas). */
async function downscale(blob: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob;
  }
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  if (scale === 1 && blob.type === 'image/jpeg') {
    bitmap.close();
    return blob;
  }
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b ?? blob), 'image/jpeg', JPEG_QUALITY);
  });
}

/** A cached segment image as an object URL, or null if it isn't cached.
 * The caller owns the URL and must `URL.revokeObjectURL` it. */
export async function getCachedSegmentImageURL(ref: string): Promise<string | null> {
  const snap = await cacheGet<Blob>(keyFor(ref));
  if (!snap || !(snap.value instanceof Blob)) return null;
  return URL.createObjectURL(snap.value);
}

/** True once this ref's image bytes are in the cache. */
export async function isSegmentImageCached(ref: string): Promise<boolean> {
  const snap = await cacheGet<Blob>(keyFor(ref));
  return !!snap && snap.value instanceof Blob;
}

/**
 * Fetch (online), downscale, and cache one storage-backed segment image.
 * Returns the stored blob's byte size, 0 if there was nothing to do
 * (not a storage ref, already cached with 0 handled by caller) or it
 * failed. Never throws.
 */
export async function cacheSegmentImage(ref: string): Promise<number> {
  if (!ref.startsWith(COURSE_SEGMENT_STORAGE_PREFIX)) return 0;
  try {
    const existing = await cacheGet<Blob>(keyFor(ref));
    if (existing?.value instanceof Blob) return existing.value.size;
    const url = await resolveCourseSegmentImage(ref);
    if (!url) return 0;
    const resp = await fetch(url);
    if (!resp.ok) return 0;
    const raw = await resp.blob();
    const small = await downscale(raw).catch(() => raw);
    await cacheSet<Blob>(keyFor(ref), small);
    return small.size;
  } catch {
    return 0;
  }
}
