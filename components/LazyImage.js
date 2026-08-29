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
 */
export default function LazyImage({
  src,
  alt = '',
  className,
  skeletonClassName,
  eager = false,
  onError,
  ...rest
}) {
  // Tracking which src finished loading (rather than a boolean) means the
  // skeleton comes back for free when a tile is reused for a different image,
  // as happens when the grid re-renders after a sort or filter change.
  const [loadedSrc, setLoadedSrc] = useState(null);
  const isLoaded = loadedSrc === src;
  const markLoaded = () => setLoadedSrc(src);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`${className || ''} ${isLoaded ? styles.loaded : styles.loading}`.trim()}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        // An image served from the browser cache can finish before React
        // attaches onLoad, which would strand the skeleton on screen.
        ref={(node) => { if (node?.complete && node.naturalWidth > 0) markLoaded(); }}
        onLoad={markLoaded}
        // Clear the skeleton on error too, so a broken image can never shimmer
        // forever. If the caller swaps in a fallback, its own load event lands
        // a moment later and fades it in.
        onError={(e) => { markLoaded(); onError?.(e); }}
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
