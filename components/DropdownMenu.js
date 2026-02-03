'use client';
import { useState, useRef, useEffect } from 'react';
import { IoEllipsisHorizontal } from 'react-icons/io5';
import styles from './DropdownMenu.module.css';

/**
 * Reusable Dropdown Menu Component
 * @param {Array} items - Array of menu items: { icon, label, onClick, danger?, variant? }
 *   - variant: 'default' | 'success' | 'danger'
 *   - danger: shorthand for variant='danger'
 * @param {string} buttonClassName - Optional additional class for the trigger button
 */
export default function DropdownMenu({ items, buttonClassName = '' }) {
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
    item.onClick();
  };

  const getItemClass = (item) => {
    const variant = item.danger ? 'danger' : item.variant;
    switch (variant) {
      case 'success': return `${styles.item} ${styles.itemSuccess}`;
      case 'danger': return `${styles.item} ${styles.itemDanger}`;
      default: return styles.item;
    }
  };

  return (
    <div className={styles.container} ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`${styles.menuButton} ${buttonClassName}`}
        aria-label="Menu"
      >
        <IoEllipsisHorizontal size={20} />
      </button>
      {isOpen && (
        <div className={styles.dropdown}>
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => handleItemClick(item)}
              className={getItemClass(item)}
            >
              {item.icon && <span className={styles.icon}>{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}