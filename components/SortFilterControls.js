'use client';
import { useState, useRef, useEffect } from 'react';
import { FiFilter, FiArrowUp, FiArrowDown, FiX, FiCheck } from 'react-icons/fi';
import { TbArrowsSort } from 'react-icons/tb';
import styles from './SortFilterControls.module.css';

const SORT_OPTIONS = [
  { key: 'name', label: 'Name' },
  { key: 'datePlanted', label: 'Date Planted' },
  { key: 'height', label: 'Height' },
  { key: 'bloomTime', label: 'Earliest Bloom' },
  { key: 'sunlight', label: 'Sunlight' },
  { key: 'moisture', label: 'Moisture' },
];

const FILTER_CATEGORIES = [
  {
    key: 'bloomTime',
    label: 'Bloom Time',
    options: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
  },
  {
    key: 'sunlight',
    label: 'Sunlight',
    options: ['Sun', 'Part Sun', 'Part Shade', 'Shade'],
  },
  {
    key: 'moisture',
    label: 'Moisture',
    options: ['Wet', 'Medium', 'Dry'],
  },
  {
    key: 'nativeRange',
    label: 'Native Range',
    options: ['Northern US', 'Northeastern US', 'Southern US', 'Southeastern US', 'Eastern US', 'East Coast US', 'Mid-Atlantic US', 'Western US', 'Midwestern US', 'Central US', 'US Native', 'MA Native', 'Cultivar', 'Nativar', 'Europe', 'Asia', 'South America', 'Africa', 'Other'],
  },
];

// ============ SORT LOGIC ============

const BLOOM_ORDER = { 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11 };
const SUN_ORDER = { 'Sun': 4, 'Part Sun': 3, 'Part Shade': 2, 'Shade': 1 };
const MOISTURE_ORDER = { 'Dry': 1, 'Medium': 2, 'Wet': 3 };

function parseHeight(h) {
  if (!h) return null;
  const s = h.toLowerCase();
  const nums = [];
  // Match patterns like "4-6 ft", "12 in", "2 ft"
  const ftMatch = s.match(/([\d.]+)\s*(?:-\s*([\d.]+))?\s*ft/);
  const inMatch = s.match(/([\d.]+)\s*(?:-\s*([\d.]+))?\s*in/);
  if (ftMatch) {
    const lo = parseFloat(ftMatch[1]);
    const hi = ftMatch[2] ? parseFloat(ftMatch[2]) : lo;
    nums.push((lo + hi) / 2);
  }
  if (inMatch) {
    const lo = parseFloat(inMatch[1]);
    const hi = inMatch[2] ? parseFloat(inMatch[2]) : lo;
    nums.push((lo + hi) / 2 / 12);
  }
  if (nums.length === 0) {
    // Try bare numbers as feet
    const bare = s.match(/([\d.]+)\s*-\s*([\d.]+)/);
    if (bare) return (parseFloat(bare[1]) + parseFloat(bare[2])) / 2;
    const single = parseFloat(s);
    if (!isNaN(single)) return single;
    return null;
  }
  return nums[0];
}

function getEarliestBloom(bloomArr) {
  if (!bloomArr?.length) return 99;
  return Math.min(...bloomArr.map(b => BLOOM_ORDER[b] ?? 99));
}

function getMaxSun(sunArr) {
  if (!sunArr?.length) return 0;
  return Math.max(...sunArr.map(s => SUN_ORDER[s] ?? 0));
}

function getMaxMoisture(moistArr) {
  if (!moistArr?.length) return 0;
  return Math.max(...moistArr.map(m => MOISTURE_ORDER[m] ?? 0));
}

function comparePlants(a, b, sortKey) {
  switch (sortKey) {
    case 'name': {
      const na = (a.commonName || a.scientificName || '').toLowerCase();
      const nb = (b.commonName || b.scientificName || '').toLowerCase();
      return na.localeCompare(nb);
    }
    case 'datePlanted': {
      const da = a.datePlanted || '';
      const db = b.datePlanted || '';
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db);
    }
    case 'height': {
      const ha = parseHeight(a.height);
      const hb = parseHeight(b.height);
      if (ha == null && hb == null) return 0;
      if (ha == null) return 1;
      if (hb == null) return -1;
      return ha - hb;
    }
    case 'bloomTime':
      return getEarliestBloom(a.bloomTime) - getEarliestBloom(b.bloomTime);
    case 'sunlight':
      return getMaxSun(a.sunlight) - getMaxSun(b.sunlight);
    case 'moisture':
      return getMaxMoisture(a.moisture) - getMaxMoisture(b.moisture);
    default:
      return 0;
  }
}

// ============ PUBLIC HELPERS ============

export function applySortAndFilter(plants, sort, filters) {
  let result = [...plants];

  // Apply filters
  for (const [key, values] of Object.entries(filters)) {
    if (!values?.length) continue;
    result = result.filter(p => {
      const plantVal = p[key];
      if (Array.isArray(plantVal)) {
        return values.some(v => plantVal.includes(v));
      }
      return values.includes(plantVal);
    });
  }

  // Apply sort — plants missing the sort field always go to the bottom
  if (sort.key) {
    result.sort((a, b) => {
      const aNull = isMissingField(a, sort.key);
      const bNull = isMissingField(b, sort.key);
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      const cmp = comparePlants(a, b, sort.key);
      return sort.dir === 'desc' ? -cmp : cmp;
    });
  }

  return result;
}

function isMissingField(plant, sortKey) {
  switch (sortKey) {
    case 'name':
      return !plant.commonName && !plant.scientificName;
    case 'datePlanted':
      return !plant.datePlanted;
    case 'height':
      return parseHeight(plant.height) == null;
    case 'bloomTime':
      return !plant.bloomTime?.length;
    case 'sunlight':
      return !plant.sunlight?.length;
    case 'moisture':
      return !plant.moisture?.length;
    default:
      return false;
  }
}

/**
 * Returns true if a plant is missing data for the active sort field
 */
export function isMissingSortField(plant, sort) {
  if (!sort?.key) return false;
  return isMissingField(plant, sort.key);
}

export function getActiveFilterCount(filters) {
  return Object.values(filters).reduce((sum, arr) => sum + (arr?.length || 0), 0);
}

// ============ COMPONENT ============

export default function SortFilterControls({ sort, onSortChange, filters, onFiltersChange }) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const sortRef = useRef(null);
  const filterRef = useRef(null);

  const filterCount = getActiveFilterCount(filters);

  // Close on outside click
  useEffect(() => {
    const handle = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Close on escape
  useEffect(() => {
    const handle = (e) => {
      if (e.key === 'Escape') { setSortOpen(false); setFilterOpen(false); }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, []);

  const handleSortClick = (key) => {
    if (sort.key === key) {
      // Toggle direction
      onSortChange({ key, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ key, dir: 'asc' });
    }
  };

  const clearSort = (e) => {
    e.stopPropagation();
    onSortChange({ key: null, dir: 'asc' });
  };

  const toggleFilter = (categoryKey, value) => {
    const current = filters[categoryKey] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [categoryKey]: updated });
  };

  const clearFilters = (e) => {
    e.stopPropagation();
    onFiltersChange({});
  };

  const clearCategoryFilters = (categoryKey, e) => {
    e.stopPropagation();
    const updated = { ...filters };
    delete updated[categoryKey];
    onFiltersChange(updated);
  };

  return (
    <>
      {/* Sort Button */}
      <div className={styles.container} ref={sortRef}>
        <div
          className={`${styles.controlButton} ${sort.key ? styles.active : ''}`}
          onClick={() => { setSortOpen(!sortOpen); setFilterOpen(false); }}
          role="button"
          tabIndex={0}
          aria-label="Sort"
        >
          <TbArrowsSort size={18} />
          {sort.key && (
            <>
              <span className={styles.activeLabel}>
                {SORT_OPTIONS.find(o => o.key === sort.key)?.label}
              </span>
              {sort.dir === 'asc' ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />}
              <span className={styles.clearButton} onClick={clearSort} role="button" tabIndex={0} aria-label="Clear sort">
                <FiX size={14} />
              </span>
            </>
          )}
        </div>

        {sortOpen && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>Sort by</div>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                className={`${styles.dropdownItem} ${sort.key === opt.key ? styles.dropdownItemActive : ''}`}
                onClick={() => handleSortClick(opt.key)}
              >
                <span>{opt.label}</span>
                {sort.key === opt.key && (
                  <span className={styles.dirIndicator}>
                    {sort.dir === 'asc' ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter Button */}
      <div className={styles.container} ref={filterRef}>
        <div
          className={`${styles.controlButton} ${filterCount > 0 ? styles.active : ''}`}
          onClick={() => { setFilterOpen(!filterOpen); setSortOpen(false); }}
          role="button"
          tabIndex={0}
          aria-label="Filter"
        >
          <FiFilter size={17} />
          {filterCount > 0 && (
            <>
              <span className={styles.filterBadge}>{filterCount}</span>
              <span className={styles.clearButton} onClick={clearFilters} role="button" tabIndex={0} aria-label="Clear filters">
                <FiX size={14} />
              </span>
            </>
          )}
        </div>

        {filterOpen && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              <span>Filter by</span>
              {filterCount > 0 && (
                <button className={styles.clearAllLink} onClick={clearFilters}>Clear all</button>
              )}
            </div>
            {FILTER_CATEGORIES.map(cat => {
              const activeValues = filters[cat.key] || [];
              const isExpanded = expandedCategory === cat.key;
              return (
                <div key={cat.key} className={styles.filterCategory}>
                  <div
                    className={styles.categoryHeader}
                    onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className={styles.categoryLabel}>
                      {cat.label}
                      {activeValues.length > 0 && (
                        <span className={styles.categoryCount}>{activeValues.length}</span>
                      )}
                    </span>
                    {activeValues.length > 0 && (
                      <span
                        className={styles.categoryClear}
                        onClick={(e) => clearCategoryFilters(cat.key, e)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Clear ${cat.label} filters`}
                      >
                        <FiX size={12} />
                      </span>
                    )}
                    <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>›</span>
                  </div>
                  {isExpanded && (
                    <div className={styles.filterOptions}>
                      {cat.options.map(opt => (
                        <button
                          key={opt}
                          className={`${styles.filterOption} ${activeValues.includes(opt) ? styles.filterOptionActive : ''}`}
                          onClick={() => toggleFilter(cat.key, opt)}
                        >
                          <span className={styles.checkbox}>
                            {activeValues.includes(opt) && <FiCheck size={12} />}
                          </span>
                          <span>{opt}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}