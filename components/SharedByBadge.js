'use client';
import { useState, useRef, useEffect } from 'react';
import { FiUser } from 'react-icons/fi';
import styles from './SharedByBadge.module.css';

export default function SharedByBadge({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const displayName = user?.display_name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = user?.avatar_url;

  return (
    <div className={styles.container} ref={menuRef}>
      <button className={styles.badge} onClick={() => setIsOpen(!isOpen)}>
        <span className={styles.label}>Shared by:</span>
        <div className={styles.avatar}>
          {avatarUrl && !imgError ? (
            <img src={avatarUrl} alt="" onError={() => setImgError(true)} />
          ) : (
            <FiUser size={16} />
          )}
        </div>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{displayName}</div>
            {user?.email && <div className={styles.userEmail}>{user.email}</div>}
          </div>
          <div className={styles.divider} />
          <button className={styles.menuItem} disabled>
            <FiUser size={16} />
            <span>Profile</span>
          </button>
        </div>
      )}
    </div>
  );
}