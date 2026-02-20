'use client';
import Link from 'next/link';
import styles from './ItemGrid.module.css';

// Derived from CSS: 1200px max-width - 2×32px padding = 1136px content area
const CONTENT_WIDTH = 1136;
const DEFAULT_GAP = 32; // 2rem
const DEFAULT_ITEM_WIDTH = (CONTENT_WIDTH - DEFAULT_GAP * 3) / 4; // 260px at 4 columns

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
  // Compute scaled grid style: gap shrinks for 5+ columns,
  // item width accounts for scaled gap, properties scale from item size.
  const gridStyle = (() => {
    if (!columns) return {};
    const gapScale = Math.min(1, 4 / columns);
    const gapPx = DEFAULT_GAP * gapScale;
    const itemWidth = Math.floor((CONTENT_WIDTH - gapPx * (columns - 1)) / columns);
    const scale = Math.min(itemWidth / DEFAULT_ITEM_WIDTH, 1);
    return {
      gridTemplateColumns: `repeat(auto-fill, minmax(${itemWidth}px, 1fr))`,
      gap: `${(2 * gapScale).toFixed(2)}rem`,
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