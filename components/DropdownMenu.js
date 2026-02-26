'use client';
import { useState, useRef, useEffect } from 'react';
import { FiMenu } from 'react-icons/fi';
import styles from './DropdownMenu.module.css';

/**
 * Reusable Dropdown Menu Component
 * @param {Array} items - Array of menu items: { icon, label, onClick, danger?, variant?, divider? }
 *   - variant: 'default' | 'success' | 'danger' | 'share' | 'save'
 *   - danger: shorthand for variant='danger'
 *   - divider: if true, renders a divider line instead of a button
 * @param {React.ReactNode} icon - Custom icon for the trigger button (default: hamburger)
 * @param {string} buttonClassName - Optional custom class for the trigger button
 */
export default function DropdownMenu({ items, icon, buttonClassName }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleItemClick = (item) => {
    setIsOpen(false);
    item.onClick?.();
  };

  const getItemClass = (item) => {
    const variant = item.danger ? 'danger' : item.variant;
    switch (variant) {
      case 'success': return `${styles.item} ${styles.itemSuccess}`;
      case 'danger': return `${styles.item} ${styles.itemDanger}`;
      case 'share': return `${styles.item} ${styles.itemShare}`;
      case 'save': return `${styles.item} ${styles.itemSave}`;
      default: return styles.item;
    }
  };

  // Filter out items where visible === false
  const visibleItems = items.filter(item => item.visible !== false);

  return (
    <div className={styles.container} ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={buttonClassName || styles.menuButton}
        aria-label="Menu"
      >
        {icon || <FiMenu size={20} />}
      </button>
      {isOpen && (
        <div className={styles.dropdown}>
          {visibleItems.map((item, index) => {
            if (item.divider) {
              return <div key={index} className={styles.divider} />;
            }
            return (
              <button
                key={index}
                onClick={() => handleItemClick(item)}
                className={getItemClass(item)}
              >
                {item.icon && <span className={styles.icon}>{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}