'use client';
import Link from 'next/link';
import styles from './ItemGrid.module.css';

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
}) {
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
        </div>
        <span className={styles.name} style={getItemStyle(item)}>
          {getItemName(item)}
          {badge != null && <span className={styles.badge}>{badge}</span>}
        </span>
      </Link>
    );
  };

  // Grouped rendering with markers
  if (sortGroups && sortGroups.length > 0) {
    return (
      <div className={styles.grouped}>
        {sortGroups.map((group, gi) => (
          <div key={gi} className={styles.section}>
            <div className={styles.marker}>{group.label}</div>
            <div className={styles.grid}>
              {group.items.map(renderItem)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Flat rendering (existing)
  if (items.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.grid}>
      {items.map(renderItem)}
    </div>
  );
}