'use client';
import Link from 'next/link';
import { BackButton } from './Button';
import styles from './PageHeader.module.css';

/**
 * Page Header Component - Used for plant detail pages below NavBar
 * 
 * @param {string} title - Page title
 * @param {function} onBack - Back button click handler
 * @param {string} backHref - Back link href (alternative to onBack)
 * @param {React.ReactNode} actions - Right side actions (buttons, menus, etc.)
 */
export default function PageHeader({ 
  title, 
  onBack, 
  backHref,
  actions 
}) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {(onBack || backHref) && (
          backHref ? (
            <Link href={backHref} className={styles.backLink}>
              <BackButton as="div" />
            </Link>
          ) : (
            <BackButton onClick={onBack} />
          )
        )}
        <h1 className={styles.title}>{title}</h1>
      </div>
      {actions && (
        <div className={styles.right}>
          {actions}
        </div>
      )}
    </header>
  );
}