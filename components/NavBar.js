'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { IoLeaf, IoClose } from 'react-icons/io5';
import { FiMenu, FiSearch } from 'react-icons/fi';
import UserMenu from './UserMenu';
import DropdownMenu from './DropdownMenu';
import SharedByBadge from './SharedByBadge';
import styles from './NavBar.module.css';

/**
 * NavBar - Sticky navigation bar component
 * 
 * @param {string} title - Page title
 * @param {boolean} showHome - Show home button (default: true)
 * @param {Array} tabs - Array of { label, href, active } for tab navigation
 * @param {boolean} showSearch - Show search button
 * @param {string} searchValue - Current search value
 * @param {function} onSearchChange - Search input change handler
 * @param {string} searchPlaceholder - Placeholder text for search input
 * @param {Array} menuItems - Items for dropdown menu (if provided, shows menu button)
 * @param {object} sharedBy - User object for shared pages (shows SharedByBadge next to title)
 * @param {React.ReactNode} extraActions - Additional action buttons
 * @param {string} contentWidth - Max width for content alignment ('large' = 1200px, 'medium' = 800px)
 */
export default function NavBar({
  title,
  showHome = true,
  tabs = [],
  showSearch = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  menuItems,
  sharedBy,
  extraActions,
  contentWidth = 'large',
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const maxWidth = contentWidth === 'medium' ? '800px' : '1200px';

  // Focus input when search opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Close search on escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        onSearchChange?.('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, onSearchChange]);

  const handleSearchToggle = () => {
    if (isSearchOpen) {
      setIsSearchOpen(false);
      onSearchChange?.('');
    } else {
      setIsSearchOpen(true);
    }
  };

  const handleSearchClear = () => {
    onSearchChange?.('');
    searchInputRef.current?.focus();
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContent}>
        {/* Far Left - Home Button */}
        <div className={styles.navLeft}>
          {showHome && (
            <Link href="/" className={styles.homeButton}>
              <IoLeaf size={22} />
            </Link>
          )}
        </div>

        {/* Center - Title, Tabs, Actions - width matches page content */}
        <div 
          className={styles.navCenter}
          style={{ '--content-max-width': maxWidth }}
        >
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>{title}</h1>
            {sharedBy && <SharedByBadge user={sharedBy} />}
          </div>
          
          <div className={styles.spacer} />
          
          {/* Tab Navigation */}
          {tabs.length > 0 && (
            <div className={styles.tabs}>
              {tabs.map((tab) => (
                tab.href ? (
                  <Link
                    key={tab.label}
                    href={tab.href}
                    className={`${styles.tab} ${tab.active ? styles.tabActive : ''}`}
                  >
                    {tab.label}
                  </Link>
                ) : (
                  <button
                    key={tab.label}
                    onClick={tab.onClick}
                    className={`${styles.tab} ${tab.active ? styles.tabActive : ''}`}
                  >
                    {tab.label}
                  </button>
                )
              ))}
            </div>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            {extraActions}
            
            {showSearch && (
              <div className={`${styles.searchContainer} ${isSearchOpen ? styles.searchOpen : ''}`}>
                {isSearchOpen && (
                  <div className={styles.searchInputWrapper}>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchValue}
                      onChange={(e) => onSearchChange?.(e.target.value)}
                      placeholder={searchPlaceholder}
                      className={styles.searchInput}
                    />
                    {searchValue && (
                      <button 
                        className={styles.searchClearButton}
                        onClick={handleSearchClear}
                        aria-label="Clear search"
                      >
                        <IoClose size={16} />
                      </button>
                    )}
                  </div>
                )}
                <button 
                  className={styles.iconButton} 
                  onClick={handleSearchToggle}
                  aria-label={isSearchOpen ? "Close search" : "Open search"}
                >
                  {isSearchOpen ? <IoClose size={20} /> : <FiSearch size={20} />}
                </button>
              </div>
            )}
            
            {menuItems && menuItems.length > 0 && (
              <DropdownMenu 
                items={menuItems} 
                icon={<FiMenu size={20} />}
                buttonClassName={styles.iconButton}
              />
            )}
          </div>
        </div>

        {/* Far Right - Profile/Sign-in */}
        <div className={styles.navRight}>
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}