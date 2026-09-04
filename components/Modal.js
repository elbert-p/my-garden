'use client';
import { useEffect, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import styles from './Modal.module.css';

/**
 * Reusable Modal Component
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {function} onClose - Function to call when closing
 * @param {string} title - Modal title
 * @param {React.ReactNode} children - Modal content
 * @param {string} size - 'small' | 'medium' | 'large'
 * @param {boolean} showCloseButton - Whether to show X button
 */
export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'medium',
  showCloseButton = false 
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div 
        className={`${styles.content} ${styles[size]}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <button className={styles.closeButton} onClick={onClose}>
            <IoClose size={24} />
          </button>
        )}
        {title && <h2 className={styles.title}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

// Confirmation Modal - for delete, autofill confirmations, etc.
// `confirmDelaySeconds` locks the confirm button for a few seconds after the
// modal opens (with a countdown + progress bar) so destructive actions can't be
// triggered by a reflexive click on the wrong menu item.
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary', // 'primary' | 'danger'
  confirmDelaySeconds = 0
}) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!isOpen || !confirmDelaySeconds) {
      setSecondsLeft(0);
      return;
    }
    setSecondsLeft(confirmDelaySeconds);
    const openedAt = Date.now();
    const interval = setInterval(() => {
      const remaining = Math.ceil((confirmDelaySeconds * 1000 - (Date.now() - openedAt)) / 1000);
      setSecondsLeft(remaining > 0 ? remaining : 0);
    }, 100);
    return () => clearInterval(interval);
  }, [isOpen, confirmDelaySeconds]);

  const locked = secondsLeft > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="small">
      <p className={styles.message}>{message}</p>
      {confirmDelaySeconds > 0 && (
        <div className={`${styles.countdownTrack} ${locked ? '' : styles.countdownDone}`}>
          <div
            className={styles.countdownFill}
            style={{ animationDuration: `${confirmDelaySeconds}s` }}
          />
        </div>
      )}
      <div className={styles.buttons}>
        {cancelText && (
          <button onClick={onClose} className={styles.cancelButton}>
            {cancelText}
          </button>
        )}
        <button
          onClick={onConfirm}
          disabled={locked}
          className={variant === 'danger' ? styles.deleteButton : styles.confirmButton}
        >
          {locked ? `${confirmText} (${secondsLeft})` : confirmText}
        </button>
      </div>
    </Modal>
  );
}