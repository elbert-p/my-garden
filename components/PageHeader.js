'use client';
import Link from 'next/link';
import { IoLeaf } from 'react-icons/io5';
import { BackButton } from './Button';
import styles from './PageHeader.module.css';

/**
 * Reusable Page Header Component
 * @param {string} title - Page title
 * @param {function} onBack - Back button handler (if provided, shows back button)
 * @param {string} backHref - Back link href (alternative to onBack)
 * @param {boolean} showHomeLink - Show leaf icon linking to home
 * @param {string} titleAlign - 'left' | 'center' (default: 'center')
 * @param {React.ReactNode} actions - Right side actions (buttons, menus, etc.)
 */
export default function PageHeader({ 
  title, 
  onBack, 
  backHref,
  showHomeLink = false,
  titleAlign = 'center',
  actions 
}) {
  const isLeftAligned = titleAlign === 'left';

  return (
    <header className={`${styles.header} ${isLeftAligned ? styles.headerLeft : ''}`}>
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
        {showHomeLink && (
          <Link href="/" className={styles.homeLink}>
            <IoLeaf size={24} />
          </Link>
        )}
        {isLeftAligned && <h1 className={styles.titleLeft}>{title}</h1>}
      </div>
      {!isLeftAligned && <h1 className={styles.title}>{title}</h1>}
      <div className={styles.right}>
        {actions}
      </div>
    </header>
  );
}