'use client';
import Modal from './Modal';
import Button from './Button';
import styles from './AutofillPromptModal.module.css';

/**
 * Prompts the user to autofill plants already in the garden that now match
 * newly added reference-database information. Purely presentational — the
 * caller supplies the candidate plants and the accept/dismiss handlers, both of
 * which resolve these plants so they are never prompted again.
 *
 * @param {boolean} isOpen
 * @param {function} onDismiss - "No thanks": mark candidates handled, no fill
 * @param {function} onAutofill - "Autofill": fill matched details
 * @param {Array} candidates - plants to be autofilled
 * @param {boolean} processing
 */
export default function AutofillPromptModal({ isOpen, onDismiss, onAutofill, candidates = [], processing = false }) {
  const count = candidates.length;
  return (
    <Modal isOpen={isOpen} onClose={processing ? () => {} : onDismiss} title="New Plant Data Available" size="medium">
      <p className={styles.intro}>
        {count === 1
          ? '1 plant in this garden has'
          : `${count} plants in this garden have`}{' '}
        new or updated information in the plant database. Would you like to autofill their updated information?
      </p>

      <div className={styles.list}>
        {candidates.map(p => (
          <div key={p.id} className={styles.row}>
            <span className={styles.common}>{p.commonName || p.scientificName}</span>
            {p.commonName && p.scientificName && <span className={styles.sci}>{p.scientificName}</span>}
          </div>
        ))}
      </div>

      <p className={styles.note}>Uploaded photos and notes will be kept. You can always autofill anytime from the plant page.</p>

      <div className={styles.footer}>
        <Button variant="secondary" onClick={onDismiss} disabled={processing}>No thanks</Button>
        <Button onClick={onAutofill} disabled={processing}>
          {processing ? 'Autofilling…' : `Autofill ${count} plant${count === 1 ? '' : 's'}`}
        </Button>
      </div>
    </Modal>
  );
}
