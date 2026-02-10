'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { IoLeaf, IoClose } from 'react-icons/io5';
import { FiMenu, FiSearch } from 'react-icons/fi';
import UserMenu from './UserMenu';
import DropdownMenu from './DropdownMenu';
import SharedByBadge from './SharedByBadge';
import styles from './NavBar.module.css';

export default function NavBar({
  title,
  badge,
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
  const searchContainerRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const maxWidth = contentWidth === 'medium' ? '800px' : '1200px';

  const hasActions = !!(extraActions || showSearch || (menuItems && menuItems.length > 0));

  // Balance navLeft and navRight widths so margin: 0 auto centers correctly.
  // Uses ResizeObserver to react whenever either side changes size.
  // Measures scrollWidth to get natural content width without needing to
  // reset minWidth, avoiding a visible flash of misalignment.
  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;

    const balance = () => {
      const leftW = left.scrollWidth;
      const rightW = right.scrollWidth;
      const max = Math.max(leftW, rightW);
      left.style.minWidth = `${max}px`;
      right.style.minWidth = `${max}px`;
    };

    const observer = new ResizeObserver(balance);
    observer.observe(left);
    observer.observe(right);

    return () => observer.disconnect();
  }, []);

  // Focus input when search opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Close search on escape, and on outside click when empty
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        onSearchChange?.('');
      }
    };
    const handleClickOutside = (e) => {
      if (
        isSearchOpen &&
        !searchValue &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);
    // Use click so that user clicking on another button goes through before layout changes
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isSearchOpen, searchValue, onSearchChange]);

  const handleSearchToggle = () => {
    setIsSearchOpen(true);
  };

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    onSearchChange?.('');
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContent}>
        {/* Far Left - Home Button */}
        <div className={styles.navLeft} ref={leftRef}>
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
            {badge != null && <span className={styles.badge}>{badge}</span>}
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

          {/* Actions - only render if there's content */}
          {hasActions && (
            <div className={styles.actions}>
              {extraActions}
              
              {showSearch && (
                <div
                  className={styles.searchContainer}
                  ref={searchContainerRef}
                >
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
                      <button 
                        className={styles.searchClearButton}
                        onClick={handleSearchClose}
                        aria-label="Close search"
                      >
                        <IoClose size={16} />
                      </button>
                    </div>
                  )}
                  {!isSearchOpen && (
                    <button 
                      className={styles.iconButton} 
                      onClick={handleSearchToggle}
                      aria-label="Open search"
                    >
                      <FiSearch size={20} />
                    </button>
                  )}
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
          )}
        </div>

        {/* Far Right - Profile/Sign-in */}
        <div className={styles.navRight} ref={rightRef}>
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}