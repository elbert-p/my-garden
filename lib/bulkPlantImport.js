// Parsing for the bulk plant upload feature.
//
// People paste plant lists straight out of Excel or Word tables. Those come in
// three shapes, all handled here:
//   1. Tab-separated  — what Excel and Word tables usually produce on copy.
//   2. Comma-separated — CSV files.
//   3. Space-separated — Word tables sometimes paste as plain text with columns
//      separated only by spaces (e.g. "Common name  Genus species  Status").
// This module turns any of those into { commonName, scientificName } rows,
// auto-detecting the delimiter, an optional header row, and — for space-
// separated text — the scientific name itself (a Latin binomial), so the common
// name and any trailing column (like a native/non-native status) split cleanly.
import { findByScientific } from './plantAutofill';

// ---- HTML entity decoding (Word/web copy often encodes ' " & etc.) ----

export const decodeEntities = (s) => (s || '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&lsquo;|&rsquo;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&');

// ---- Cell splitting (tab / comma, with basic quoted-field support) ----

const splitCells = (line, delimiter) => {
  if (!delimiter) return [line.trim()];
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map(c => c.trim());
};

/**
 * Tokenize pasted text into a grid of cells.
 * @returns {{ rows: string[][], columnCount: number, delimiter: string|null }}
 */
export const tokenizeBulkInput = (text) => {
  const lines = (text || '').split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { rows: [], columnCount: 0, delimiter: null };

  // Prefer tab (Excel/Word paste); fall back to comma (CSV); else no delimiter
  // (single column or space-separated text — handled by parseBulkInput).
  const delimiter = lines.some(l => l.includes('\t')) ? '\t'
    : lines.some(l => l.includes(',')) ? ','
    : null;

  const rows = lines.map(l => splitCells(l, delimiter));
  const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  return { rows, columnCount, delimiter };
};

// ---- Scientific-name detection ----

// A Latin binomial: capitalized genus + lowercase species epithet, allowing a
// hybrid marker (× / x), "spp.", and an optional trailing quoted cultivar (so
// "Actaea racemosa 'Black Beauty'" is captured whole and stays distinct from
// the base species). Used both to classify whole values and to locate a
// scientific name inside a space-separated line.
const BINOMIAL_SOURCE = String.raw`[A-Z][a-zë]+\s+(?:(?:×|x)\s+)?(?:[a-zë][a-zë-]+|spp\.)(?:\s+'[^']+')?`;
const BINOMIAL_GLOBAL = new RegExp(BINOMIAL_SOURCE, 'g');
const BINOMIAL_ANYWHERE = new RegExp(BINOMIAL_SOURCE);

/** True if a value looks like a scientific name (a known match or a binomial). */
export const looksScientific = (name) => {
  if (!name) return false;
  const trimmed = name.trim();
  if (findByScientific(trimmed)) return true;
  return new RegExp('^' + BINOMIAL_SOURCE).test(trimmed);
};

/**
 * Split a space-separated line into common + scientific names by locating the
 * scientific name (the last binomial in the line). Everything before it is the
 * common name; anything after it (e.g. a status column, cultivar remnant) is
 * ignored. Returns null when no scientific name is present.
 */
export const anchorByBinomial = (line) => {
  const matches = [...(line || '').matchAll(BINOMIAL_GLOBAL)];
  if (matches.length === 0) return null;
  const m = matches[matches.length - 1];
  return {
    commonName: line.slice(0, m.index).trim(),
    scientificName: m[0].trim(),
  };
};

// When a table cell is too wide it wraps onto the next physical line(s). Such a
// continuation always starts with a lowercase letter (a species epithet like
// "cinnamomeum") or a quote (a cultivar like 'Nigrescens') — never a
// capitalized common name or a status word. Join those fragments back onto the
// row they belong to so the scientific name (and cultivar) stays intact.
const CONTINUATION_START = /^\s*(?:\p{Ll}|['"‘’“”(])/u;
const mergeWrappedLines = (lines) => {
  const out = [];
  for (const line of lines) {
    if (out.length > 0 && CONTINUATION_START.test(line)) {
      out[out.length - 1] += ' ' + line.trim();
    } else {
      out.push(line);
    }
  }
  return out;
};

// Recognized values of a trailing "status" column (native/non-native/…). When
// present at the end of a line they mark the end of a logical row, which lets
// us stitch word-wrapped rows back together even when a wrapped common name or
// cultivar fragment starts with a capital letter (which the lowercase/quote
// heuristic above can't catch).
const STATUS_END = /(?:^|\s)(?:non[-\s]?native|native|invasive|introduced|naturalized|endemic|exotic|cultivated|ornamental)\s*$/i;
const hasStatusColumn = (lines) => lines.filter(l => STATUS_END.test(l)).length >= 2;

// Reassemble rows using a trailing status column as the row terminator. Best
// for 3-column data: it stitches wrapped rows together even when a wrapped
// common name or cultivar fragment starts with a capital letter. Returns import
// rows ({ commonName, scientificName }).
const reassembleByStatus = (lines) => {
  const rows = [];
  let buf = '';
  const flush = () => {
    const a = buf && anchorByBinomial(buf);
    if (a?.scientificName) rows.push({ commonName: a.commonName, scientificName: a.scientificName });
    buf = '';
  };
  for (const line of lines) {
    const t = line.trim();
    if (buf) {
      // If the buffer already holds a scientific name and this line is itself a
      // full "common + scientific" row, the buffer was a row that simply lacked
      // a trailing status — emit it rather than merging two rows together.
      const bufA = anchorByBinomial(buf);
      const lineA = anchorByBinomial(t);
      if (bufA?.scientificName && lineA?.scientificName && lineA.commonName) {
        flush();
        buf = t;
      } else {
        buf += ' ' + t;
      }
    } else {
      buf = t;
    }
    if (STATUS_END.test(buf)) flush();
  }
  flush();
  return rows;
};

// Reassemble two-column data (common + scientific) without needing a status
// column, using the columns' roles: a line that is only a scientific name
// belongs to the preceding common-only line, and consecutive common-only
// fragments are a wrapped common name. Returns import rows.
const reassembleTwoColumn = (lines) => {
  const rows = [];
  // First join obvious lowercase/quote continuations (wrapped species epithet or
  // cultivar), then resolve common/scientific roles line by line.
  for (const line of mergeWrappedLines(lines)) {
    const a = anchorByBinomial(line);
    const prev = rows[rows.length - 1];
    const prevNeedsSci = prev && prev.commonName && !prev.scientificName;
    if (a?.scientificName) {
      if (!a.commonName && prevNeedsSci) {
        prev.scientificName = a.scientificName; // completes the common-only row
      } else {
        rows.push({ commonName: a.commonName, scientificName: a.scientificName });
      }
    } else if (prevNeedsSci) {
      prev.commonName += ' ' + line.trim();      // wrapped common name continues
    } else {
      rows.push({ commonName: line.trim(), scientificName: '' });
    }
  }
  return rows.filter(r => r.scientificName);
};

// ---- Header detection ----

// Matches only header-ish phrases, not real names like "Common Milkweed".
const classifyHeaderCell = (cell) => {
  const c = cell.trim().toLowerCase();
  if (/^(scientific|latin|botanical)(\s+name)?$/.test(c) || c === 'species' || c === 'genus') return 'scientific';
  if (/^common(\s+name)?$/.test(c) || c === 'name') return 'common';
  return null;
};

/**
 * If the first row (delimited cells) looks like a header, return the column
 * mapping { commonIdx, scientificIdx } (either may be -1); otherwise null.
 */
export const detectHeader = (cells) => {
  if (!cells || cells.length === 0) return null;
  // A real value that looks scientific means this is a data row, not a header.
  if (cells.some(looksScientific)) return null;

  let commonIdx = -1;
  let scientificIdx = -1;
  cells.forEach((cell, i) => {
    const kind = classifyHeaderCell(cell);
    if (kind === 'common' && commonIdx === -1) commonIdx = i;
    if (kind === 'scientific' && scientificIdx === -1) scientificIdx = i;
  });
  if (commonIdx === -1 && scientificIdx === -1) return null;
  return { commonIdx, scientificIdx };
};

// A space-separated header line, e.g. "Common Name Scientific Name Status".
const looksLikeSpaceHeader = (line) => {
  if (!line || BINOMIAL_ANYWHERE.test(line)) return false;
  const l = line.toLowerCase();
  return /\bcommon\b/.test(l) && /\b(scientific|latin|botanical)\b/.test(l);
};

// ---- Column-role auto-detection (for delimited input without a header) ----

/** Guess the order of a two-column table: 'commonFirst' or 'scientificFirst'. */
export const suggestColumnOrder = (rows) => {
  let col0 = 0;
  let col1 = 0;
  for (const r of rows) {
    if (looksScientific(r[0])) col0++;
    if (looksScientific(r[1])) col1++;
  }
  return col0 > col1 ? 'scientificFirst' : 'commonFirst';
};

/** Guess whether a single column holds 'scientific' or 'common' names. */
export const suggestSingleType = (rows) => {
  let sci = 0;
  let total = 0;
  for (const r of rows) {
    const v = r[0];
    if (!v) continue;
    total++;
    if (looksScientific(v)) sci++;
  }
  return total > 0 && sci >= total / 2 ? 'scientific' : 'common';
};

// ---- Mapping delimited grids to import rows ----

/**
 * Map a tokenized (tab/comma) grid to [{ commonName, scientificName }], applying
 * the chosen column roles and dropping fully-empty rows.
 */
export const buildImportRows = ({ rows, columnCount, header, order, singleType }) => {
  const dataRows = header ? rows.slice(1) : rows;
  const out = [];
  for (const cells of dataRows) {
    let commonName = '';
    let scientificName = '';

    if (header) {
      commonName = header.commonIdx >= 0 ? (cells[header.commonIdx] || '') : '';
      scientificName = header.scientificIdx >= 0 ? (cells[header.scientificIdx] || '') : '';
    } else if (columnCount >= 2) {
      const a = cells[0] || '';
      const b = cells[1] || '';
      if (order === 'scientificFirst') { scientificName = a; commonName = b; }
      else { commonName = a; scientificName = b; }
    } else {
      const v = cells[0] || '';
      if (singleType === 'scientific') scientificName = v;
      else commonName = v;
    }

    commonName = commonName.trim();
    scientificName = scientificName.trim();
    if (commonName || scientificName) out.push({ commonName, scientificName });
  }
  return out;
};

// ---- Unified entry point ----

/**
 * Parse pasted text into import rows, auto-detecting the layout.
 *
 * @param {string} text
 * @param {object} [opts] - { orderOverride, singleTypeOverride } from UI toggles
 * @returns {{
 *   mode: 'empty'|'delimited'|'single'|'space',
 *   importRows: {commonName:string, scientificName:string}[],
 *   columnCount: number,
 *   order: 'commonFirst'|'scientificFirst',
 *   singleType: 'common'|'scientific',
 *   header: boolean,
 * }}
 */
export const parseBulkInput = (text, opts = {}) => {
  const decoded = decodeEntities(text);
  const { rows, columnCount, delimiter } = tokenizeBulkInput(decoded);
  const base = { columnCount, order: 'commonFirst', singleType: 'common', header: false };

  if (rows.length === 0) return { ...base, mode: 'empty', importRows: [] };

  // Tab/comma delimited — the reliable, explicit case.
  if (delimiter) {
    const header = detectHeader(rows[0]);
    const order = opts.orderOverride ?? suggestColumnOrder(rows);
    const singleType = opts.singleTypeOverride ?? suggestSingleType(rows);
    const importRows = buildImportRows({ rows, columnCount, header, order, singleType });
    return {
      mode: columnCount >= 2 ? 'delimited' : 'single',
      importRows, columnCount, order, singleType, header: !!header,
    };
  }

  // No delimiter: could be space-separated columns or a single column of names.
  let lines = rows.map(r => r[0]);
  let hadHeader = false;
  if (looksLikeSpaceHeader(lines[0])) { hadHeader = true; lines = lines.slice(1); }

  // Space-separated table: most lines contain a scientific name, and at least
  // one has a common-name prefix in front of it. Anchoring on the binomial lets
  // us keep multi-word names intact and drop trailing columns / wrap fragments.
  const anchored = lines.map(anchorByBinomial);
  const withSci = anchored.filter(a => a && a.scientificName).length;
  const withPrefix = anchored.filter(a => a && a.commonName).length;
  // A space-separated table: a solid majority of lines carry a scientific name,
  // and most of those also have a common-name prefix (which distinguishes a real
  // two-column table from a single column of names that merely look binomial).
  const isSpaceTable = lines.length > 0
    && withSci >= Math.ceil(lines.length * 0.5)
    && withPrefix >= 1
    && withPrefix * 2 >= withSci;
  if (isSpaceTable) {
    // Reassemble word-wrapped rows so a scientific name, common name, or cultivar
    // split across lines is put back together. A trailing status column gives the
    // most reliable row boundaries (best for 3-column data); otherwise we use the
    // columns' own roles, which handles the common two-column case.
    const importRows = hasStatusColumn(lines)
      ? reassembleByStatus(lines)
      : reassembleTwoColumn(lines);
    return { mode: 'space', importRows, columnCount: 3, order: 'commonFirst', singleType: 'common', header: hadHeader };
  }

  // Otherwise a single column of names.
  const dataRows = lines.map(l => [l]);
  const singleType = opts.singleTypeOverride ?? suggestSingleType(dataRows);
  const importRows = buildImportRows({ rows: dataRows, columnCount: 1, header: null, order: 'commonFirst', singleType });
  return { mode: 'single', importRows, columnCount: 1, order: 'commonFirst', singleType, header: hadHeader };
};
