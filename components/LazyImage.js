'use client';
import { useState } from 'react';
import styles from './LazyImage.module.css';

/**
 * An <img> that defers loading until it scrolls into view and shows a
 * shimmering skeleton in the meantime.
 *
 * Renders as a fragment so it drops into existing markup without changing
 * layout: the skeleton is absolutely inset, so the parent just needs to be a
 * positioned box that the image already fills (as the grid tiles are).
 *
 * @param {boolean} eager - skip lazy loading. Use for above-the-fold tiles so
 *   they aren't demoted to low priority and delay the largest paint.
 * @param {string} skeletonClassName - extra class for the skeleton, e.g. to
 *   match a border radius the container itself doesn't have.
 * @param {string} fallbackSrc - tried once if `src`/`srcSet` fail. Grids point
 *   those at Supabase's transformation endpoint and this at the untransformed
 *   original, so tiles still render if transformations are ever turned off.
 */
export default function LazyImage({
  src,
  srcSet,
  alt = '',
  className,
  skeletonClassName,
  fallbackSrc,
  eager = false,
  onError,
  ...rest
}) {
  // `attempt.for` records which incoming src an entry belongs to, so a new src
  // supersedes a stale fallback without needing an effect to reset it.
  const [attempt, setAttempt] = useState({ for: null, url: null });
  const isFallback = attempt.for === src;
  const activeSrc = isFallback ? attempt.url : src;
  // srcSet wins over src whenever it's present, so it has to go when we fall
  // back — otherwise the browser would just re-pick a failing candidate.
  const activeSrcSet = isFallback ? undefined : srcSet;

  // Tracking which url finished loading (rather than a boolean) means the
  // skeleton comes back for free when a tile is reused for a different image,
  // as happens when the grid re-renders after a sort or filter change.
  const [loadedSrc, setLoadedSrc] = useState(null);
  const isLoaded = loadedSrc === activeSrc;
  const markLoaded = () => setLoadedSrc(activeSrc);

  const handleError = (e) => {
    if (fallbackSrc && activeSrc !== fallbackSrc) {
      setAttempt({ for: src, url: fallbackSrc });
      return;
    }
    markLoaded();
    onError?.(e);
  };

  return (
    <>
      <img
        src={activeSrc}
        srcSet={activeSrcSet}
        alt={alt}
        className={`${className || ''} ${isLoaded ? styles.loaded : styles.loading}`.trim()}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        // An image served from the browser cache can finish before React
        // attaches onLoad, which would strand the skeleton on screen.
        ref={(node) => { if (node?.complete && node.naturalWidth > 0) markLoaded(); }}
        onLoad={markLoaded}
        // Once there's nothing left to try, clear the skeleton so a broken
        // image can never shimmer forever.
        onError={handleError}
        {...rest}
      />
      {!isLoaded && (
        <span
          className={`${styles.skeleton} ${skeletonClassName || ''}`.trim()}
          aria-hidden="true"
        />
      )}
    </>
  );
}
