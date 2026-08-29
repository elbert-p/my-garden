'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FiCheck, FiMove } from 'react-icons/fi';
import { tileUrl, tileSrcSet } from '@/lib/imageStorage';
import LazyImage from './LazyImage';
import styles from './ItemGrid.module.css';

// Reference content width for calibrating column count:
const REF_CONTENT_WIDTH = 1136;
const REF_GAP = 32;
// Track width when no column count is set, mirroring the CSS default in
// ItemGrid.module.css (`minmax(min(250px, calc(50% - 1rem)), 1fr)`).
const DEFAULT_TRACK_WIDTH = 250;
// --page-max-width-large is `max(1200px, calc(100vw - 300px))`, so content
// stops being pinned at 1200 and starts tracking the window at 1500px.
const STRETCH_VIEWPORT = 1500;

// Tiles below this index load eagerly. Everything after them waits until it
// scrolls into view, which is what keeps a 200-plant garden from fetching 200
// photos up front. Lazy images are fetched at low priority, so exempting the
// first rows avoids pushing back the largest paint. With grouped sorts the
// index restarts per group, which just means a few extra eager tiles.
const EAGER_TILE_COUNT = 8;

const LONG_PRESS_MS = 500;
const PRESS_MOVE_TOLERANCE = 10;

export default function ItemGrid({
  items = [],
  sortGroups,
  emptyMessage = 'No items yet.',
  linkPrefix = '',
  getItemId = (item) => item.id,
  getItemImage = (item) => item.image,
  fallbackImage,
  getItemName = (item) => item.name,
  getItemStyle = () => ({}),
  getItemBadge,
  renderOverlay,
  getItemDimmed,
  columns,
  // Selection mode props (privacy)
  selectionMode = false,
  selectedIds,
  onToggleSelection,
  // Rearrange mode props
  rearrangeMode = false,
  onReorder,
  // When provided on mount, immediately starts a drag with this id.
  // Used by the long-press handoff: parent sets it when entering rearrange mode.
  initialDragId,
  // Long-press to enter rearrange mode (normal mode only).
  // Receives the long-pressed item id so the parent can prime an immediate drag.
  onLongPress,
}) {
  // Width of one grid track at the reference content width. Hoisted out of
  // gridStyle because the srcset `sizes` below needs the same number.
  const gapScale = columns ? Math.min(1, 4 / columns) : 1;
  const itemWidth = columns
    ? Math.floor((REF_CONTENT_WIDTH - REF_GAP * gapScale * (columns - 1)) / columns)
    : DEFAULT_TRACK_WIDTH;

  // Past maxGridWidth the grid can hold one more track than `columns`, so
  // tiles stretch to about itemWidth * (n+1)/n before another column fits.
  const wideTileWidth = Math.ceil(itemWidth * (columns ? (columns + 1) / columns : 1.25));

  // Describes the tile's width to the browser so srcset can pick a size,
  // factoring in screen density on top. Three regimes, matching the CSS:
  //   narrow  — the min() clause in gridTemplateColumns collapses auto-fill to
  //             two columns. Page padding and the gap put a tile at a
  //             consistent ~44% of the viewport, so 46vw leaves a little
  //             margin without tipping into the next candidate up. The 480px
  //             floor covers high column counts, where tracks are slim enough
  //             that phones still fit only two but stretch them to fill.
  //   normal  — content is pinned at --page-max-width-large's 1200px floor, so
  //             tiles sit at itemWidth.
  //   wide    — past STRETCH_VIEWPORT the page grows with the window and tiles
  //             stretch toward wideTileWidth.
  // Overshooting is the safe direction: the browser picks the sharper candidate.
  const imageSizes = [
    `(max-width: ${Math.max(480, itemWidth * 2 + 96)}px) 46vw`,
    `(max-width: ${STRETCH_VIEWPORT}px) ${itemWidth}px`,
    `${wideTileWidth}px`,
  ].join(', ');

  const gridStyle = (() => {
    if (!columns) return {};
    const gapPx = REF_GAP * gapScale;
    // Cap the grid's width just under the point where an (N+1)th auto-fill
    // track would fit. Items can still grow with the container up to this
    // cap; below it, auto-fill drops to fewer columns naturally on narrow
    // screens. This decouples the upper bound from itemWidth so wide-laptop
    // viewports can't sneak an extra column in.
    const maxGridWidth = (columns + 1) * itemWidth + columns * gapPx - 1;
    const scale = Math.min(1, 4 / columns);
    const gapRem = (2 * gapScale).toFixed(2);
    return {
      gridTemplateColumns:
        `repeat(auto-fill, minmax(min(${itemWidth}px, calc(50% - 1rem)), 1fr))`,
      gap: `min(${gapRem}rem, var(--page-padding-inline, 2rem))`,
      maxWidth: `${maxGridWidth}px`,
      marginInline: 'auto',
      '--item-radius': `${Math.round(15 * scale)}px`,
      '--item-name-mt': `${(0.75 * scale).toFixed(2)}rem`,
      '--item-name-pb': `${(0.5 * scale).toFixed(2)}rem`,
    };
  })();

  // ===== Drag state =====
  const [draggingId, setDraggingId] = useState(null);
  // Mirrors draggingId for use inside document-level listeners (avoids stale closure)
  const draggingIdRef = useRef(null);
  draggingIdRef.current = draggingId;
  // Tracks the last tile we swapped *with* — debounces the swap so the cursor
  // doesn't oscillate when it lands inside the just-swapped neighbour. Cleared
  // as soon as the cursor moves to a different tile.
  const lastSwapOverIdRef = useRef(null);

  // Latest items / callbacks for use inside the doc listeners
  const itemsRef = useRef(items);
  const getItemIdRef = useRef(getItemId);
  const onReorderRef = useRef(onReorder);
  itemsRef.current = items;
  getItemIdRef.current = getItemId;
  onReorderRef.current = onReorder;

  const swapTo = useCallback((clientX, clientY) => {
    const dragging = draggingIdRef.current;
    if (!dragging) return;
    const el = document.elementFromPoint(clientX, clientY);
    const tile = el?.closest('[data-rearrange-id]');
    const overId = tile?.getAttribute('data-rearrange-id') || null;
    // Cursor moved to a different tile — release the debounce so we can swap.
    if (overId && overId !== lastSwapOverIdRef.current) {
      lastSwapOverIdRef.current = null;
    }
    if (!overId) return;
    if (overId === dragging) return;
    if (overId === lastSwapOverIdRef.current) return;
    const getId = getItemIdRef.current;
    const ids = itemsRef.current.map(getId);
    const fromIdx = ids.indexOf(dragging);
    const toIdx = ids.indexOf(overId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...ids];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    lastSwapOverIdRef.current = overId;
    onReorderRef.current?.(next);
  }, []);

  // Long-press handoff: on mount (or when initialDragId first arrives), kick
  // off the drag automatically so the user doesn't have to press again.
  const consumedInitialRef = useRef(false);
  useEffect(() => {
    if (initialDragId && !consumedInitialRef.current) {
      consumedInitialRef.current = true;
      lastSwapOverIdRef.current = null;
      setDraggingId(initialDragId);
    }
  }, [initialDragId]);

  // Document-level pointer listeners while a drag is active. Document-level
  // (rather than element-level pointer capture) so the drag survives the
  // Link <-> div DOM swap that happens when rearrange mode flips on.
  useEffect(() => {
    if (!draggingId) return;
    const onMove = (e) => swapTo(e.clientX, e.clientY);
    const onUp = () => {
      setDraggingId(null);
      lastSwapOverIdRef.current = null;
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [draggingId, swapTo]);

  // Pointer-down on a tile in rearrange mode → start a drag here.
  const handleRearrangeDown = (e, item) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    lastSwapOverIdRef.current = null;
    setDraggingId(getItemId(item));
  };

  // ===== Long-press detection (normal mode only) =====
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const longPressStartRef = useRef({ x: 0, y: 0 });

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleLongPressDown = (e, item) => {
    if (!onLongPress) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    longPressFiredRef.current = false;
    longPressStartRef.current = { x: e.clientX, y: e.clientY };
    clearLongPressTimer();
    const itemId = getItemId(item);
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      longPressTimerRef.current = null;
      onLongPress(itemId);
    }, LONG_PRESS_MS);
  };

  const handleLongPressMove = (e) => {
    if (!longPressTimerRef.current) return;
    const dx = e.clientX - longPressStartRef.current.x;
    const dy = e.clientY - longPressStartRef.current.y;
    if (Math.abs(dx) > PRESS_MOVE_TOLERANCE || Math.abs(dy) > PRESS_MOVE_TOLERANCE) {
      clearLongPressTimer();
    }
  };

  const handleLongPressEnd = () => {
    clearLongPressTimer();
  };

  const handleLongPressClick = (e) => {
    if (longPressFiredRef.current) {
      e.preventDefault();
      longPressFiredRef.current = false;
    }
  };

  const renderItem = (item, index) => {
    const id = getItemId(item);
    const eager = index < EAGER_TILE_COUNT;
    // Tiles ask Supabase for a square crop at each srcset size and keep the
    // untransformed original as a fallback. Deriving this here rather than in
    // getItemImage means every grid in the app benefits without changes.
    const fullImage = getItemImage(item);

    // ----- Rearrange mode -----
    if (rearrangeMode) {
      const isDragging = id === draggingId;
      return (
        <div
          key={id}
          data-rearrange-id={id}
          className={`${styles.item} ${styles.itemClickable} ${isDragging ? styles.itemDragging : ''}`}
          onPointerDown={(e) => handleRearrangeDown(e, item)}
          style={{ touchAction: 'none' }}
        >
          <div className={styles.imageContainer}>
            <LazyImage
              src={tileUrl(fullImage)}
              srcSet={tileSrcSet(fullImage)}
              sizes={imageSizes}
              fallbackSrc={fullImage}
              alt={getItemName(item)}
              className={styles.image}
              skeletonClassName={styles.imageSkeleton}
              eager={eager}
              draggable={false}
              onError={fallbackImage ? (e) => { if (e.target.src !== window.location.origin + fallbackImage) e.target.src = fallbackImage; } : undefined}
            />
            <div className={styles.rearrangeHandle}>
              <FiMove size={16} strokeWidth={2.5} />
            </div>
            {renderOverlay?.(item)}
          </div>
          <span className={styles.name} style={getItemStyle(item)}>
            {getItemName(item)}
          </span>
        </div>
      );
    }

    const badge = getItemBadge?.(item);
    const isSelected = selectionMode && selectedIds?.has(id);
    const isDimmed = selectionMode
      ? !isSelected
      : getItemDimmed?.(item);

    if (selectionMode) {
      return (
        <div
          key={id}
          className={`${styles.item} ${isDimmed ? styles.itemDimmed : ''} ${styles.itemClickable}`}
          onClick={() => onToggleSelection?.(id)}
        >
          <div className={styles.imageContainer}>
            <LazyImage
              src={tileUrl(fullImage)}
              srcSet={tileSrcSet(fullImage)}
              sizes={imageSizes}
              fallbackSrc={fullImage}
              alt={getItemName(item)}
              className={styles.image}
              skeletonClassName={styles.imageSkeleton}
              eager={eager}
              onError={fallbackImage ? (e) => { if (e.target.src !== window.location.origin + fallbackImage) e.target.src = fallbackImage; } : undefined}
            />
            <div className={`${styles.selectionCheckbox} ${isSelected ? styles.selectionChecked : ''}`}>
              {isSelected && <FiCheck size={16} strokeWidth={3.5} />}
            </div>
            {renderOverlay?.(item)}
          </div>
          <span className={styles.name} style={getItemStyle(item)}>
            {getItemName(item)}
          </span>
        </div>
      );
    }

    return (
      <Link
        key={id}
        href={`${linkPrefix}/${id}`}
        className={`${styles.item} ${isDimmed ? styles.itemDimmed : ''}`}
        onPointerDown={onLongPress ? (e) => handleLongPressDown(e, item) : undefined}
        onPointerMove={onLongPress ? handleLongPressMove : undefined}
        onPointerUp={onLongPress ? handleLongPressEnd : undefined}
        onPointerCancel={onLongPress ? handleLongPressEnd : undefined}
        onPointerLeave={onLongPress ? handleLongPressEnd : undefined}
        onClick={onLongPress ? handleLongPressClick : undefined}
      >
        <div className={styles.imageContainer}>
          <LazyImage
            src={tileUrl(fullImage)}
            srcSet={tileSrcSet(fullImage)}
            sizes={imageSizes}
            fallbackSrc={fullImage}
            alt={getItemName(item)}
            className={styles.image}
            skeletonClassName={styles.imageSkeleton}
            eager={eager}
            onError={fallbackImage ? (e) => { if (e.target.src !== window.location.origin + fallbackImage) e.target.src = fallbackImage; } : undefined}
          />
          {badge != null && <span className={styles.badge}>{badge}</span>}
          {renderOverlay?.(item)}
        </div>
        <span className={styles.name} style={getItemStyle(item)}>
          {getItemName(item)}
        </span>
      </Link>
    );
  };

  if (sortGroups && sortGroups.length > 0) {
    return (
      <div className={styles.grouped}>
        {sortGroups.map((group, gi) => (
          <div key={gi} className={styles.section}>
            <div className={styles.marker}>{group.label}</div>
            <div className={styles.grid} style={gridStyle}>
              {group.items.map(renderItem)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.grid} style={gridStyle}>
      {items.map(renderItem)}
    </div>
  );
}

/**
 * Section wrapper for the home page grid sections (Created, Saved, Recently Viewed)
 */
export function ItemGridSection({ title, children }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>{title}</div>
      {children}
    </div>
  );
}
