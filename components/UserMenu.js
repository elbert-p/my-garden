'use client';
import { useState, useRef, useEffect } from 'react';
import { FiLogOut, FiUser } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import GoogleSignInButton from './GoogleSignInButton';
import styles from './UserMenu.module.css';

export default function UserMenu() {
  const { user, isAuthenticated, signOut, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (loading) {
    return <div className={styles.skeleton} />;
  }

  if (!isAuthenticated) {
    return <GoogleSignInButton />;
  }

  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <div className={styles.container} ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={styles.avatarButton}
        aria-label="User menu"
      >
        {avatarUrl && !imgError ? (
          <img src={avatarUrl} alt="" className={styles.avatar} onError={() => setImgError(true)} />
        ) : (
          <FiUser size={22} className={styles.avatarIcon} />
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.userInfo}>
            <div className={styles.userName}>
              {user?.user_metadata?.full_name || 'User'}
            </div>
            <div className={styles.userEmail}>{user?.email}</div>
          </div>
          <div className={styles.divider} />
          <button onClick={signOut} className={styles.menuItem}>
            <FiLogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}