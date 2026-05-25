'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FiCheck, FiMove } from 'react-icons/fi';
import styles from './ItemGrid.module.css';

// Reference content width for calibrating column count:
const REF_CONTENT_WIDTH = 1136;
const REF_GAP = 32;

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
  const gridStyle = (() => {
    if (!columns) return {};
    const gapScale = Math.min(1, 4 / columns);
    const gapPx = REF_GAP * gapScale;
    const itemWidth = Math.floor(
      (REF_CONTENT_WIDTH - gapPx * (columns - 1)) / columns
    );
    const scale = Math.min(1, 4 / columns);
    const gapRem = (2 * gapScale).toFixed(2);
    return {
      gridTemplateColumns:
        `repeat(auto-fill, minmax(min(${itemWidth}px, calc(50% - 1rem)), 1fr))`,
      gap: `min(${gapRem}rem, var(--page-padding-inline, 2rem))`,
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

  const renderItem = (item) => {
    const id = getItemId(item);

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
            <img
              src={getItemImage(item)}
              alt={getItemName(item)}
              className={styles.image}
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
            <img
              src={getItemImage(item)}
              alt={getItemName(item)}
              className={styles.image}
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
          <img
            src={getItemImage(item)}
            alt={getItemName(item)}
            className={styles.image}
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
