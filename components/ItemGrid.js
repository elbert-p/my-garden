'use client';
import Link from 'next/link';
import { FiCheck } from 'react-icons/fi';
import styles from './ItemGrid.module.css';

// Reference content width for calibrating column count:
const REF_CONTENT_WIDTH = 1136;
const REF_GAP = 32;

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
  // Selection mode props
  selectionMode = false,
  selectedIds,
  onToggleSelection,
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

  const renderItem = (item) => {
    const badge = getItemBadge?.(item);
    const id = getItemId(item);
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
            />
            <div className={`${styles.selectionCheckbox} ${isSelected ? styles.selectionChecked : ''}`}>
              {isSelected && <FiCheck size={16} strokeWidth={3.5} />}
            </div>
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