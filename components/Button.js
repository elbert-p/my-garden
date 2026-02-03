'use client';
import styles from './Button.module.css';

/**
 * Reusable Button Component
 * @param {string} variant - 'primary' | 'secondary' | 'danger' | 'success'
 * @param {string} size - 'small' | 'medium' | 'large'
 * @param {React.ReactNode} children - Button content
 * @param {function} onClick - Click handler
 */
export default function Button({ 
  variant = 'primary',
  size = 'medium',
  children,
  onClick,
  className = '',
  ...props
}) {
  return (
    <button
      onClick={onClick}
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Back button with arrow
export function BackButton({ onClick, children = 'Back' }) {
  return (
    <button onClick={onClick} className={styles.backButton}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      <span>{children}</span>
    </button>
  );
}