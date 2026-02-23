'use client';
import { useState, useRef, useEffect } from 'react';
import { FiFilter, FiArrowUp, FiArrowDown, FiX, FiCheck } from 'react-icons/fi';
import { TbArrowsSort } from 'react-icons/tb';
import { BLOOM_OPTIONS, SUN_OPTIONS, MOISTURE_OPTIONS, NATIVE_OPTIONS } from '@/lib/plantConstants';
import styles from './SortFilterControls.module.css';

// ============ CONSTANTS ============

const SORT_OPTIONS = [
  { key: 'name', label: 'Name' },
  { key: 'datePlanted', label: 'Date Planted' },
  { key: 'height', label: 'Height' },
  { key: 'bloomTime', label: 'Earliest Bloom' },
  { key: 'sunlight', label: 'Sunlight' },
  { key: 'moisture', label: 'Moisture' },
];

const MULTI_FILTER_CATEGORIES = [
  { key: 'bloomTime', label: 'Bloom Time', options: BLOOM_OPTIONS },
  { key: 'sunlight', label: 'Sunlight', options: SUN_OPTIONS },
  { key: 'moisture', label: 'Moisture', options: MOISTURE_OPTIONS },
  { key: 'nativeRange', label: 'Native Range', options: NATIVE_OPTIONS },
];

const HEIGHT_OPS = [
  { value: 'gt', label: 'Greater than' },
  { value: 'lt', label: 'Less than' },
  { value: 'eq', label: 'Equal to' },
];

const DATE_OPS = [
  { value: 'after', label: 'After' },
  { value: 'before', label: 'Before' },
  { value: 'eq', label: 'Equal to' },
];

// ============ COMBO RANKING (sunlight / moisture) ============

function buildComboRanks(values) {
  const ranks = new Map();
  let rank = 0;

  function expand(included, startIdx) {
    const key = values.filter((_, i) => included[i]).join(', ');
    if (!ranks.has(key)) ranks.set(key, rank++);
    for (let i = startIdx; i < values.length; i++) {
      if (included[i]) continue;
      included[i] = true;
      expand(included, i + 1);
      included[i] = false;
    }
  }

  for (let m = 0; m < values.length; m++) {
    const inc = new Array(values.length).fill(false);
    inc[m] = true;
    expand(inc, m + 1);
  }

  return ranks;
}

const SUN_RANKS = buildComboRanks(SUN_OPTIONS);
const MOISTURE_RANKS = buildComboRanks(MOISTURE_OPTIONS);

function getComboRank(vals, rankMap, orderedList) {
  if (!vals?.length) return 999;
  const key = orderedList.filter(v => vals.includes(v)).join(', ');
  return rankMap.get(key) ?? 999;
}

function comboLabel(vals, orderedList) {
  if (!vals?.length) return '';
  return orderedList.filter(v => vals.includes(v)).join(', ');
}

// ============ SORT LOGIC ============

const BLOOM_ORDER = { 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11 };

function parseHeightRange(h) {
  if (!h) return null;
  const s = h.toLowerCase();
  let lo = null, hi = null;
  const ftMatch = s.match(/([\d.]+)\s*(?:-\s*([\d.]+))?\s*ft/);
  const inMatch = s.match(/([\d.]+)\s*(?:-\s*([\d.]+))?\s*in/);
  if (ftMatch) {
    lo = parseFloat(ftMatch[1]);
    hi = ftMatch[2] ? parseFloat(ftMatch[2]) : lo;
  } else if (inMatch) {
    lo = parseFloat(inMatch[1]) / 12;
    hi = inMatch[2] ? parseFloat(inMatch[2]) / 12 : lo;
  } else {
    const bare = s.match(/([\d.]+)\s*-\s*([\d.]+)/);
    if (bare) { lo = parseFloat(bare[1]); hi = parseFloat(bare[2]); }
    else { const single = parseFloat(s); if (!isNaN(single)) { lo = single; hi = single; } }
  }
  if (lo == null) return null;
  return { lo, hi, avg: (lo + hi) / 2 };
}

function parseHeight(h) {
  const range = parseHeightRange(h);
  return range ? range.avg : null;
}

function getEarliestBloom(bloomArr) {
  if (!bloomArr?.length) return 99;
  return Math.min(...bloomArr.map(b => BLOOM_ORDER[b] ?? 99));
}

function comparePlants(a, b, sortKey) {
  switch (sortKey) {
    case 'name': {
      const na = (a.commonName || a.scientificName || '').toLowerCase();
      const nb = (b.commonName || b.scientificName || '').toLowerCase();
      return na.trim().localeCompare(nb.trim());
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
      return getComboRank(a.sunlight, SUN_RANKS, SUN_OPTIONS) - getComboRank(b.sunlight, SUN_RANKS, SUN_OPTIONS);
    case 'moisture':
      return getComboRank(a.moisture, MOISTURE_RANKS, MOISTURE_OPTIONS) - getComboRank(b.moisture, MOISTURE_RANKS, MOISTURE_OPTIONS);
    default:
      return 0;
  }
}

// ============ FILTER LOGIC ============

function matchesHeightFilter(plant, heightFilter) {
  if (!heightFilter?.value) return true;
  const range = parseHeightRange(plant.height);
  if (!range) return false;
  const target = parseFloat(heightFilter.value);
  if (isNaN(target)) return true;
  switch (heightFilter.op) {
    case 'gt': return range.hi > target;
    case 'lt': return range.lo < target;
    case 'eq': return target >= range.lo && target <= range.hi;
    default: return true;
  }
}

function matchesDateFilter(plant, dateFilter) {
  if (!dateFilter?.value) return true;
  if (!plant.datePlanted) return false;
  switch (dateFilter.op) {
    case 'after': return plant.datePlanted > dateFilter.value;
    case 'before': return plant.datePlanted < dateFilter.value;
    case 'eq': return plant.datePlanted === dateFilter.value;
    default: return true;
  }
}

// ============ PUBLIC HELPERS ============

function isMissingField(plant, sortKey) {
  switch (sortKey) {
    case 'name': return !plant.commonName && !plant.scientificName;
    case 'datePlanted': return !plant.datePlanted;
    case 'height': return parseHeight(plant.height) == null;
    case 'bloomTime': return !plant.bloomTime?.length;
    case 'sunlight': return !plant.sunlight?.length;
    case 'moisture': return !plant.moisture?.length;
    default: return false;
  }
}

export function applySortAndFilter(plants, sort, filters) {
  let result = [...plants];

  for (const [key, values] of Object.entries(filters)) {
    if (key === '_height' || key === '_date') continue;
    if (!values?.length) continue;
    result = result.filter(p => {
      const plantVal = p[key];
      if (Array.isArray(plantVal)) return values.some(v => plantVal.includes(v));
      return values.includes(plantVal);
    });
  }

  if (filters._height) result = result.filter(p => matchesHeightFilter(p, filters._height));
  if (filters._date) result = result.filter(p => matchesDateFilter(p, filters._date));

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

export function isMissingSortField(plant, sort) {
  if (!sort?.key) return false;
  return isMissingField(plant, sort.key);
}

export function getActiveFilterCount(filters) {
  let count = Object.entries(filters).reduce((sum, [key, val]) => {
    if (key === '_height' || key === '_date') return sum;
    return sum + (val?.length || 0);
  }, 0);
  if (filters._height?.value) count++;
  if (filters._date?.value) count++;
  return count;
}

// ============ SORT GROUPS (markers) ============

const BLOOM_MONTH_NAMES = { 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June', 7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November' };
const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function groupByLabel(plants, labelFn) {
  const groups = [];
  let curLabel = null, curItems = [];
  for (const p of plants) {
    const label = labelFn(p);
    if (label !== curLabel) {
      if (curItems.length > 0) groups.push({ label: curLabel, items: curItems });
      curLabel = label;
      curItems = [p];
    } else {
      curItems.push(p);
    }
  }
  if (curItems.length > 0) groups.push({ label: curLabel, items: curItems });
  return groups;
}

function groupByDate(plants) {
  if (plants.length === 0) return [];
  const monthSet = new Set();
  for (const p of plants) {
    const [y, m] = p.datePlanted.split('-');
    monthSet.add(`${y}-${m}`);
  }
  const useMonths = monthSet.size > 1 && plants.length / monthSet.size >= 2;

  return groupByLabel(plants, (p) => {
    const [y, m] = p.datePlanted.split('-');
    return useMonths ? `${MONTH_ABBR[parseInt(m)]} ${y}` : y;
  });
}

export function getSortGroups(sortedPlants, sort) {
  if (!sort.key || sort.key === 'name') return null;

  const withField = sortedPlants.filter(p => !isMissingField(p, sort.key));
  const withoutField = sortedPlants.filter(p => isMissingField(p, sort.key));

  let groups;
  if (sort.key === 'datePlanted') {
    groups = groupByDate(withField);
  } else {
    const labelFn = {
      bloomTime: (p) => BLOOM_MONTH_NAMES[getEarliestBloom(p.bloomTime)] || 'Unknown',
      height: (p) => {
        const h = parseHeight(p.height);
        if (h == null) return 'Unknown';
        const lo = Math.floor(h);
        return `${lo}\u2013${lo + 1} ft`;
      },
      sunlight: (p) => comboLabel(p.sunlight, SUN_OPTIONS),
      moisture: (p) => comboLabel(p.moisture, MOISTURE_OPTIONS),
    }[sort.key];

    if (!labelFn) return null;
    groups = groupByLabel(withField, labelFn);
  }

  if (withoutField.length > 0) {
    groups.push({ label: 'Not set', items: withoutField });
  }

  return groups.length > 0 ? groups : null;
}

export function getActiveSortCount(plants, sort) {
  if (!sort.key || sort.key === 'name') return null;
  return plants.filter(p => !isMissingField(p, sort.key)).length;
}

// ============ COMPONENT ============

export default function SortFilterControls({ sort, onSortChange, filters, onFiltersChange }) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const sortRef = useRef(null);
  const filterRef = useRef(null);

  const filterCount = getActiveFilterCount(filters);

  useEffect(() => {
    const handle = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    const handle = (e) => {
      if (e.key === 'Escape') { setSortOpen(false); setFilterOpen(false); }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, []);

  const handleSortClick = (key) => {
    if (sort.key === key) {
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

  const updateHeightFilter = (field, value) => {
    const current = filters._height || { op: 'gt', value: '' };
    onFiltersChange({ ...filters, _height: { ...current, [field]: value } });
  };

  const clearHeightFilter = (e) => {
    e.stopPropagation();
    const updated = { ...filters };
    delete updated._height;
    onFiltersChange(updated);
  };

  const updateDateFilter = (field, value) => {
    const current = filters._date || { op: 'after', value: '' };
    onFiltersChange({ ...filters, _date: { ...current, [field]: value } });
  };

  const clearDateFilter = (e) => {
    e.stopPropagation();
    const updated = { ...filters };
    delete updated._date;
    onFiltersChange(updated);
  };

  const heightFilter = filters._height || { op: 'gt', value: '' };
  const dateFilter = filters._date || { op: 'after', value: '' };

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
          <TbArrowsSort size={20} />
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
            <div className={styles.dropdownHeader}>
              <span>Sort by</span>
              {sort.key && (
                <button className={styles.clearAllLink} onClick={(e) => { e.stopPropagation(); onSortChange({ key: null, dir: 'asc' }); setSortOpen(false); }}>Clear</button>
              )}
            </div>
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
          <FiFilter size={20} />
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

            {/* Date planted filter */}
            <div className={styles.filterCategory}>
              <div
                className={styles.categoryHeader}
                onClick={() => setExpandedCategory(expandedCategory === '_date' ? null : '_date')}
                role="button"
                tabIndex={0}
              >
                <span className={styles.categoryLabel}>
                  Date Planted
                  {dateFilter.value && <span className={styles.categoryCount}>1</span>}
                </span>
                {dateFilter.value && (
                  <span className={styles.categoryClear} onClick={clearDateFilter} role="button" tabIndex={0} aria-label="Clear date filter">
                    <FiX size={12} />
                  </span>
                )}
                <span className={`${styles.chevron} ${expandedCategory === '_date' ? styles.chevronOpen : ''}`}>›</span>
              </div>
              {expandedCategory === '_date' && (
                <div className={styles.rangeFilterContent}>
                  <div className={styles.rangeRow}>
                    <select
                      className={styles.rangeSelect}
                      value={dateFilter.op}
                      onChange={(e) => updateDateFilter('op', e.target.value)}
                    >
                      {DATE_OPS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      className={styles.dateInput}
                      value={dateFilter.value}
                      onChange={(e) => updateDateFilter('value', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Height filter */}
            <div className={styles.filterCategory}>
              <div
                className={styles.categoryHeader}
                onClick={() => setExpandedCategory(expandedCategory === '_height' ? null : '_height')}
                role="button"
                tabIndex={0}
              >
                <span className={styles.categoryLabel}>
                  Height
                  {heightFilter.value && <span className={styles.categoryCount}>1</span>}
                </span>
                {heightFilter.value && (
                  <span className={styles.categoryClear} onClick={clearHeightFilter} role="button" tabIndex={0} aria-label="Clear height filter">
                    <FiX size={12} />
                  </span>
                )}
                <span className={`${styles.chevron} ${expandedCategory === '_height' ? styles.chevronOpen : ''}`}>›</span>
              </div>
              {expandedCategory === '_height' && (
                <div className={styles.rangeFilterContent}>
                  <div className={styles.rangeRow}>
                    <select
                      className={styles.rangeSelect}
                      value={heightFilter.op}
                      onChange={(e) => updateHeightFilter('op', e.target.value)}
                    >
                      {HEIGHT_OPS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <div className={styles.rangeInputWrapper}>
                      <input
                        type="number"
                        className={styles.rangeInput}
                        value={heightFilter.value}
                        onChange={(e) => updateHeightFilter('value', e.target.value)}
                        placeholder="0"
                        min="0"
                        step="0.5"
                      />
                      <span className={styles.rangeUnit}>ft</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Multi-select categories */}
            {MULTI_FILTER_CATEGORIES.map(cat => {
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