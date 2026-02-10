'use client';
import Link from 'next/link';
import styles from './ItemGrid.module.css';

/**
 * Reusable Item Grid Component
 * @param {Array} items - Array of items to display
 * @param {string} emptyMessage - Message when no items
 * @param {string} linkPrefix - URL prefix for item links
 * @param {function} getItemId - Function to get item ID
 * @param {function} getItemImage - Function to get item image
 * @param {function} getItemName - Function to get item name
 * @param {function} getItemStyle - Optional function for custom name styling
 * @param {function} getItemBadge - Optional function to get badge value (e.g. plant count)
 * @param {function} getItemDimmed - Optional function returning true if item should appear dimmed
 */
export default function ItemGrid({ 
  items = [],
  emptyMessage = 'No items yet.',
  linkPrefix = '',
  getItemId = (item) => item.id,
  getItemImage = (item) => item.image,
  getItemName = (item) => item.name,
  getItemStyle = () => ({}),
  getItemBadge,
  getItemDimmed,
}) {
  if (items.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.grid}>
      {items.map((item) => {
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
      })}
    </div>
  );
}