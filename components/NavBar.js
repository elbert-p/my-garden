'use client';
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import Link from 'next/link';
import { IoLeaf, IoClose } from 'react-icons/io5';
import { FiMenu, FiSearch } from 'react-icons/fi';
import UserMenu from './UserMenu';
import DropdownMenu from './DropdownMenu';
import SharedByBadge from './SharedByBadge';
import styles from './NavBar.module.css';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Pixels of extra space required before switching OUT of a mode.
// Prevents oscillation at the boundary where measurements differ
// between the two DOM structures (single-row vs double-bar).
const HYSTERESIS = 20;

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
  const [layoutMode, setLayoutMode] = useState('balanced');
  const [doubleCentered, setDoubleCentered] = useState(true);

  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const titleGroupRef = useRef(null);
  const tabsRef = useRef(null);
  const actionsRef = useRef(null);

  // Synchronous ref for current layout mode — avoids stale closures in
  // ResizeObserver and lets hysteresis compare against the true current mode.
  const layoutModeRef = useRef('balanced');

  const isSearchOpenRef = useRef(false);
  isSearchOpenRef.current = isSearchOpen;

  const actionsWidthCache = useRef(0);

  const hasActions = !!(extraActions || showSearch || (menuItems && menuItems.length > 0));
  const hasTabs = tabs.length > 0;
  const hasSecondRow = hasTabs || hasActions;
  const isDouble = layoutMode === 'double';
  const isCompact = layoutMode !== 'balanced';
  const hasActiveSearch = !!searchValue;
  const hasBadgeChildren = badge != null || !!sharedBy;

  // ---- Layout mode detection ----
  const updateLayout = useCallback(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    const titleGroup = titleGroupRef.current;
    if (!left || !right) return;

    const vw = window.innerWidth;

    const rootStyles = getComputedStyle(document.documentElement);
    const rootFontSize = parseFloat(rootStyles.fontSize) || 16;
    const rawPadding = rootStyles.getPropertyValue('--page-padding-inline').trim();
    const pagePadding = rawPadding.endsWith('rem')
      ? parseFloat(rawPadding) * rootFontSize
      : (parseFloat(rawPadding) || 32);

    let pageMaxWidth;
    if (contentWidth === 'medium') {
      pageMaxWidth = 800;
    } else {
      pageMaxWidth = Math.max(1200, vw - 300);
    }
    const cmw = pageMaxWidth - pagePadding * 2;

    left.style.minWidth = '';
    right.style.minWidth = '';

    const leftW = left.offsetWidth;
    const rightW = right.offsetWidth;
    const navContentEl = left.parentElement;
    const navPad = navContentEl
      ? parseFloat(getComputedStyle(navContentEl).paddingLeft)
        + parseFloat(getComputedStyle(navContentEl).paddingRight)
      : 32;

    // Measure titleGroup: compute ideal (unconstrained) width by summing
    // each child's natural width. We can't rely on the group's scrollWidth
    // because when the group is flex-squeezed, its children's overflow:hidden
    // causes scrollWidth to report the constrained size.
    const titleEl = titleGroup?.querySelector('h1');
    const titleTextW = titleEl?.scrollWidth || 0;

    let idealGroupW = 0;
    if (titleGroup) {
      const groupGap = parseFloat(getComputedStyle(titleGroup).gap) || 0;
      let visibleCount = 0;
      for (const child of titleGroup.children) {
        const childW = child === titleEl ? titleTextW : child.offsetWidth;
        if (childW > 0) {
          idealGroupW += childW;
          visibleCount++;
        }
      }
      if (visibleCount > 1) {
        idealGroupW += groupGap * (visibleCount - 1);
      }
    }

    // For the single-row threshold: the title text can truncate (overflow:
    // hidden + ellipsis), so cap its contribution at 60px. Badges and other
    // title-group children are flex-shrink: 0 and keep their full width.
    // This prevents badge width changes (e.g. "12" → "5 / 12") from
    // triggering a mode switch when the title is already being truncated.
    const nonTitleW = Math.max(0, idealGroupW - titleTextW);
    const titleW = (titleTextW > 0 ? Math.min(titleTextW, 60) : 0) + nonTitleW;

    const tabsW = tabsRef.current?.scrollWidth || 0;
    if (!isSearchOpenRef.current && actionsRef.current) {
      actionsWidthCache.current = actionsRef.current.scrollWidth;
    }
    const actionsW = actionsWidthCache.current || (actionsRef.current?.scrollWidth || 0);

    const gap = vw > 1024 ? 24 : 16;
    const parts = [titleW, tabsW, actionsW].filter(w => w > 0);
    const gapsTotal = Math.max(0, parts.length - 1) * gap;
    // The spacer div between titleGroup and tabs/actions adds one more
    // flex-gap slot that the parts count doesn't capture.
    const spacerGap = (tabsW > 0 || actionsW > 0) ? gap : 0;
    const minCenterW = titleW + tabsW + actionsW + gapsTotal + spacerGap;

    const singleRowNeeded = leftW + rightW + navPad + minCenterW;

    // ---- Hysteresis ----
    // When currently in double-bar mode, require HYSTERESIS extra pixels
    // of viewport width before switching back to single-row. This prevents
    // oscillation: measurements taken in double-bar mode (where tabs/actions
    // live in a different DOM parent) may differ slightly from single-row
    // measurements, causing the threshold to flip back and forth.
    const currentMode = layoutModeRef.current;
    const singleRowThreshold = currentMode === 'double'
      ? singleRowNeeded + HYSTERESIS
      : singleRowNeeded;

    let mode;
    if (vw < singleRowThreshold) {
      mode = 'double';
    } else {
      const balancedSide = Math.max(leftW, rightW);
      const balancedNeeded = cmw + balancedSide * 2 + navPad;

      if (vw >= balancedNeeded) {
        mode = 'balanced';
        left.style.minWidth = `${balancedSide}px`;
        right.style.minWidth = `${balancedSide}px`;
      } else {
        mode = 'unbalanced';
      }
    }

    // Double-bar: decide if title can be absolutely centered.
    let centered = true;
    if (mode === 'double' && titleGroup) {
      const naturalTitleW = titleTextW;
      const extraW = Math.max(0, idealGroupW - naturalTitleW);

      centered = naturalTitleW === 0 || (vw / 2 >= naturalTitleW / 2 + extraW + rightW);

      titleGroup.style.setProperty('--title-extra', `${extraW}px`);
    }

    // Update ref synchronously so the next callback sees the right mode
    layoutModeRef.current = mode;
    setLayoutMode(mode);
    setDoubleCentered(centered);
  }, [contentWidth, hasBadgeChildren]);

  useIsomorphicLayoutEffect(() => {
    updateLayout();

    // Debounce ResizeObserver with requestAnimationFrame — coalesces
    // rapid-fire callbacks (from DOM restructuring during a mode switch)
    // into a single layout pass per frame.
    let rafId = null;
    const debouncedUpdate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateLayout();
      });
    };

    const ro = new ResizeObserver(debouncedUpdate);
    [leftRef, rightRef, titleGroupRef, tabsRef, actionsRef].forEach(r => {
      if (r.current) ro.observe(r.current);
    });
    window.addEventListener('resize', debouncedUpdate);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', debouncedUpdate);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [updateLayout]);

  // ---- Search focus ----
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // ---- Search close handlers ----
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
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target)
      ) {
        if (isCompact) {
          setIsSearchOpen(false);
        } else {
          if (!searchValue) setIsSearchOpen(false);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isSearchOpen, searchValue, onSearchChange, isCompact]);

  const handleSearchToggle = () => setIsSearchOpen(true);
  const handleSearchClose = () => {
    setIsSearchOpen(false);
    onSearchChange?.('');
  };

  const centerStyle = layoutMode === 'balanced'
    ? {
        maxWidth: contentWidth === 'medium'
          ? 'var(--content-max-width-medium)'
          : 'var(--content-max-width-large)',
        margin: '0 auto',
      }
    : {};

  const showTabsVisually = !(isCompact && isSearchOpen);

  // ---- Sub-trees ----
  const titleGroupContent = (
    <div
      className={`${styles.titleGroup} ${
        isDouble && doubleCentered ? styles.titleGroupCentered : ''
      }`}
      ref={titleGroupRef}
    >
      <h1 className={styles.title}>{title}</h1>
      {badge != null && <span className={styles.badge}>{badge}</span>}
      {sharedBy && <SharedByBadge user={sharedBy} compact={isCompact} />}
    </div>
  );

  const tabsContent = hasTabs ? (
    <div
      className={`${styles.tabs} ${!showTabsVisually ? styles.tabsHidden : ''}`}
      ref={tabsRef}
    >
      {tabs.map((tab) =>
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
        ),
      )}
    </div>
  ) : null;

  const searchContent = showSearch ? (
    <div className={styles.searchContainer} ref={searchContainerRef}>
      {isSearchOpen ? (
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
      ) : (
        <button
          className={`${styles.iconButton} ${
            hasActiveSearch && isCompact ? styles.iconButtonSearchActive : ''
          }`}
          onClick={handleSearchToggle}
          aria-label="Open search"
        >
          <FiSearch size={20} />
        </button>
      )}
    </div>
  ) : null;

  const actionsContent = hasActions ? (
    <div className={styles.actions} ref={actionsRef}>
      {extraActions}
      {searchContent}
      {menuItems && menuItems.length > 0 && (
        <DropdownMenu
          items={menuItems}
          icon={<FiMenu size={20} />}
          buttonClassName={styles.iconButton}
        />
      )}
    </div>
  ) : null;

  return (
    <nav
      className={`${styles.navbar} ${isDouble ? styles.navbarDouble : ''}`}
      data-layout={layoutMode}
    >
      {/* ---- Primary row ---- */}
      <div
        className={`${styles.navContent} ${isDouble ? styles.navContentDouble : ''}`}
      >
        <div className={styles.navLeft} ref={leftRef}>
          {showHome && (
            <Link href="/" className={styles.homeButton}>
              <IoLeaf size={22} />
            </Link>
          )}
        </div>

        {isDouble ? (
          <div className={`${styles.navCenterDouble} ${
            !doubleCentered ? styles.navCenterDoubleLeft : ''
          }`}>
            {titleGroupContent}
          </div>
        ) : (
          <div className={styles.navCenter} style={centerStyle}>
            {titleGroupContent}
            <div className={styles.spacer} />
            {tabsContent}
            {actionsContent}
          </div>
        )}

        <div className={styles.navRight} ref={rightRef}>
          <UserMenu />
        </div>
      </div>

      {/* ---- Second row (double-bar only) ---- */}
      {isDouble && hasSecondRow && (
        <div className={styles.secondRow}>
          <div
            className={`${styles.secondRowContent} ${
              contentWidth === 'medium'
                ? styles.secondRowMedium
                : styles.secondRowLarge
            }`}
          >
            {tabsContent}
            <div className={styles.spacer} />
            {actionsContent}
          </div>
        </div>
      )}
    </nav>
  );
}