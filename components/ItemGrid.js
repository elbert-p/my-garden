'use client';
import Link from 'next/link';
import styles from './ItemGrid.module.css';

// Reference content width for calibrating column count:
// At a typical 1200px viewport, content is 1200 − 2 × 32 = 1136px.
const REF_CONTENT_WIDTH = 1136;
const REF_GAP = 32; // 2rem at 16px root

export default function ItemGrid({
  items = [],
  sortGroups,
  emptyMessage = 'No items yet.',
  linkPrefix = '',
  getItemId = (item) => item.id,
  getItemImage = (item) => item.image,
  getItemName = (item) => item.name,
  getItemStyle = () => ({}),
  getItemBadge,
  getItemDimmed,
  columns,
}) {
  // Compute grid style.
  // When `columns` is set, calibrate item width so that exactly `columns`
  // items fit at the reference desktop width.  On narrow screens auto-fill
  // naturally drops to fewer columns, with a floor of 2 columns ensured
  // by min(Xpx, calc(50% - gap/2)).
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

  const renderItem = (item) => {
    const badge = getItemBadge?.(item);
    const dimmed = getItemDimmed?.(item);
    return (
      <Link
        key={getItemId(item)}
        href={`${linkPrefix}/${getItemId(item)}`}
        className={`${styles.item} ${dimmed ? styles.itemDimmed : ''}`}
      >
        <div className={styles.imageContainer}>
          <img
            src={getItemImage(item)}
            alt={getItemName(item)}
            className={styles.image}
          />
          {badge != null && <span className={styles.badge}>{badge}</span>}
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