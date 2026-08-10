'use client';
import { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import { ErrorMessage } from './FormInput';
import { parseBulkInput } from '@/lib/bulkPlantImport';
import { findData, buildAutofillUpdates } from '@/lib/plantAutofill';
import styles from './BulkUploadModal.module.css';

const EXAMPLE = 'Common Milkweed\tAsclepias syriaca\nWild Bergamot\tMonarda fistulosa\nPurple Coneflower\tEchinacea purpurea';

// A plant's identity for duplicate detection: its common + scientific name
// together (both normalized), so distinct cultivars that share a scientific
// name (e.g. "Black cohosh" vs "Black cohosh 'Black Beauty'") are kept.
const norm = (s) => (s || '').trim().toLowerCase();
const identityKey = (item) => `${norm(item.commonName)}|${norm(item.scientificName)}`;

// Empty plant scaffold matching the manual "Add Plant" flow.
const emptyPlant = (type, commonName, scientificName) => ({
  type,
  commonName,
  scientificName,
  mainImage: '',
  datePlanted: '',
  bloomTime: [],
  height: '',
  sunlight: [],
  moisture: [],
  nativeRange: [],
  plantType: [],
  hostedInsects: '',
  notes: '',
  images: [],
  hasAutofilled: false,
});

/**
 * Bulk upload plants (or wildlife) by pasting rows from a spreadsheet/table.
 * Parses the pasted text, previews the parsed rows (flagging duplicates),
 * creates the unique ones, and autofills any plants that match the reference
 * database.
 *
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {'plant'|'wildlife'} type - item type to create
 * @param {function} createPlants - context batch creator: (plantList) => Promise
 * @param {Array} existingItems - items already in the garden (for dup detection)
 */
export default function BulkUploadModal({ isOpen, onClose, type = 'plant', createPlants, existingItems = [] }) {
  const [text, setText] = useState('');
  const [orderOverride, setOrderOverride] = useState(null);       // two-column order
  const [singleTypeOverride, setSingleTypeOverride] = useState(null); // single-column type
  const [status, setStatus] = useState('idle');                   // idle | processing | done
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const isPlant = type !== 'wildlife';
  const label = isPlant ? 'plant' : 'wildlife';

  // Reset everything whenever the modal is (re)opened or closed.
  useEffect(() => {
    if (!isOpen) {
      setText('');
      setOrderOverride(null);
      setSingleTypeOverride(null);
      setStatus('idle');
      setProgress({ current: 0, total: 0 });
      setResult(null);
      setError('');
    }
  }, [isOpen]);

  const parsed = useMemo(
    () => parseBulkInput(text, { orderOverride, singleTypeOverride }),
    [text, orderOverride, singleTypeOverride]
  );

  // Preview rows enriched with an autofill-match flag (synchronous, no image
  // checks) and duplicate detection — both against the garden and within the
  // pasted list itself (only the first occurrence of a name is kept).
  const previewRows = useMemo(() => {
    const existingKeys = new Set(existingItems.map(identityKey));
    const seen = new Set();
    return parsed.importRows.map(r => {
      const key = identityKey(r);
      const dupInGarden = !!key && existingKeys.has(key);
      const dupInList = !!key && seen.has(key);
      if (key) seen.add(key);
      return {
        ...r,
        matched: isPlant && !!findData(r.scientificName, r.commonName),
        skip: dupInGarden || dupInList,
        dupReason: dupInGarden ? 'In garden' : dupInList ? 'In list' : null,
      };
    });
  }, [parsed.importRows, existingItems, isPlant]);

  const toAdd = previewRows.filter(r => !r.skip);
  const dupCount = previewRows.length - toAdd.length;
  const matchCount = toAdd.filter(r => r.matched).length;

  const showOrderToggle = parsed.mode === 'delimited';
  const showSingleTypeToggle = parsed.mode === 'single';

  const handleSubmit = async () => {
    if (toAdd.length === 0) return;
    setError('');
    setStatus('processing');
    setProgress({ current: 0, total: toAdd.length });

    let autofilled = 0;
    const toCreate = [];
    try {
      for (let i = 0; i < toAdd.length; i++) {
        const row = toAdd[i];
        const plant = emptyPlant(type, row.commonName, row.scientificName);
        if (isPlant) {
          const match = findData(row.scientificName, row.commonName);
          if (match) {
            const updates = await buildAutofillUpdates(plant, match);
            Object.assign(plant, updates);
            autofilled++;
          }
        }
        toCreate.push(plant);
        setProgress({ current: i + 1, total: toAdd.length });
      }
      await createPlants(toCreate);
      setResult({ created: toCreate.length, autofilled, skipped: dupCount });
      setStatus('done');
    } catch (e) {
      setError(`Something went wrong while adding ${label}. Please try again.`);
      setStatus('idle');
    }
  };

  const renderIdle = () => (
    <>
      <p className={styles.intro}>
        <strong>Copy and paste</strong> directly from your spreadsheet or table. A live preview table will show the data you entered.
        {isPlant && ' Information for plants found in the database will be autofilled.'}
      </p>
      <p className={styles.hint}>
        Use two columns for common and scientific names, or a single column of names. Any extra columns will be ignored automatically.
      </p>

      <textarea
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE}
        rows={8}
        spellCheck={false}
      />

      {showOrderToggle && (
        <div className={styles.controlRow}>
          <span className={styles.controlLabel}>Column order</span>
          <div className={styles.segmented}>
            <button type="button"
              className={parsed.order === 'commonFirst' ? styles.segActive : styles.seg}
              onClick={() => setOrderOverride('commonFirst')}>
              Common, Scientific
            </button>
            <button type="button"
              className={parsed.order === 'scientificFirst' ? styles.segActive : styles.seg}
              onClick={() => setOrderOverride('scientificFirst')}>
              Scientific, Common
            </button>
          </div>
        </div>
      )}

      {showSingleTypeToggle && (
        <div className={styles.controlRow}>
          <span className={styles.controlLabel}>These names are</span>
          <div className={styles.segmented}>
            <button type="button"
              className={parsed.singleType === 'common' ? styles.segActive : styles.seg}
              onClick={() => setSingleTypeOverride('common')}>
              Common
            </button>
            <button type="button"
              className={parsed.singleType === 'scientific' ? styles.segActive : styles.seg}
              onClick={() => setSingleTypeOverride('scientific')}>
              Scientific
            </button>
          </div>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className={styles.preview}>
          <div className={styles.previewHead}>
            <span>{toAdd.length} {label}{toAdd.length === 1 ? '' : 's'} to add</span>
            <span className={styles.headMeta}>
              {isPlant && matchCount > 0 && <span className={styles.matchCount}>{matchCount} will autofill</span>}
              {dupCount > 0 && <span className={styles.dupTally}>{dupCount} duplicate{dupCount === 1 ? '' : 's'} skipped</span>}
            </span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Common Name</th>
                  <th>Scientific Name</th>
                  {isPlant && <th className={styles.autofillCol}>Autofill</th>}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} className={r.skip ? styles.dupRow : undefined}>
                    <td>
                      {r.commonName || <span className={styles.empty}>—</span>}
                      {r.skip && <span className={styles.dupTag}>{r.dupReason}</span>}
                    </td>
                    <td className={styles.sci}>{r.scientificName || <span className={styles.empty}>—</span>}</td>
                    {isPlant && (
                      <td className={styles.autofillCol}>
                        {r.matched ? <span className={styles.matchYes}>✓</span> : <span className={styles.empty}>—</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ErrorMessage message={error} />

      <div className={styles.footer}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={toAdd.length === 0}>
          {toAdd.length > 0 ? `Add ${toAdd.length} ${label}${toAdd.length === 1 ? '' : 's'}` : 'Add'}
        </Button>
      </div>
    </>
  );

  const renderProcessing = () => {
    const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div className={styles.status}>
        <p className={styles.statusText}>Adding {label}… {progress.current} of {progress.total}</p>
        <div className={styles.progressTrack}>
          <div className={styles.progressBar} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  const renderDone = () => (
    <div className={styles.status}>
      <p className={styles.doneTitle}>Added {result.created} {label}{result.created === 1 ? '' : 's'}.</p>
      {isPlant && (
        <p className={styles.doneSub}>
          {result.autofilled} had information autofilled from the plant database.
        </p>
      )}
      {result.skipped > 0 && (
        <p className={styles.doneSub}>{result.skipped} duplicate{result.skipped === 1 ? '' : 's'} skipped.</p>
      )}
      <div className={styles.footer}>
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={status === 'processing' ? () => {} : onClose}
      title={`Bulk Upload ${isPlant ? 'Plants' : 'Wildlife'}`}
      size="large"
    >
      {status === 'idle' && renderIdle()}
      {status === 'processing' && renderProcessing()}
      {status === 'done' && renderDone()}
    </Modal>
  );
}
