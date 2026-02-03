'use client';
import styles from './FormInput.module.css';

/**
 * Reusable Form Input Component
 * @param {string} type - Input type
 * @param {string} value - Input value
 * @param {function} onChange - Change handler
 * @param {string} placeholder - Placeholder text
 * @param {string} error - Error message
 */
export default function FormInput({ 
  type = 'text',
  value, 
  onChange, 
  placeholder,
  error,
  ...props
}) {
  return (
    <div className={styles.container}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${styles.input} ${error ? styles.inputError : ''}`}
        {...props}
      />
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

export function ErrorMessage({ message }) {
  if (!message) return null;
  return <p className={styles.errorBox}>{message}</p>;
}