'use client';
import Link from 'next/link';
import styles from './ItemGrid.module.css';

/**
 * Reusable Item Grid Component
 * @param {Array} items - Array of items to display
 * @param {function} renderItem - Custom render function for each item
 * @param {string} emptyMessage - Message when no items
 * @param {string} linkPrefix - URL prefix for item links
 * @param {string} linkSuffix - URL suffix for item links (e.g., query params)
 * @param {function} getItemId - Function to get item ID
 * @param {function} getItemImage - Function to get item image
 * @param {function} getItemName - Function to get item name
 * @param {function} getItemStyle - Optional function for custom name styling
 */
export default function ItemGrid({ 
  items = [],
  emptyMessage = 'No items yet.',
  linkPrefix = '',
  linkSuffix = '',
  getItemId = (item) => item.id,
  getItemImage = (item) => item.image,
  getItemName = (item) => item.name,
  getItemStyle = () => ({}),
}) {
  if (items.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <Link 
          key={getItemId(item)} 
          href={`${linkPrefix}/${getItemId(item)}${linkSuffix}`} 
          className={styles.item}
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
          </span>
        </Link>
      ))}
    </div>
  );
}