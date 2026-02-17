'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getProfileAboutBlocks, updateProfileAboutBlocks } from '@/lib/dataService';
import NavBar from '@/components/NavBar';
import AboutPageContent from '@/components/AboutPageContent';
import styles from './page.module.css';

export default function AboutPage() {
  const { user, isInitialized } = useAuth();
  const [blocks, setBlocks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const tabs = [
    { label: 'Gardens', href: '/', active: false },
    { label: 'About', href: '/about', active: true },
  ];

  useEffect(() => {
    if (!isInitialized) return;
    (async () => {
      if (user?.id) {
        const data = await getProfileAboutBlocks(user.id);
        setBlocks(data);
      }
      setLoaded(true);
    })();
  }, [user?.id, isInitialized]);

  const handleSave = async (updatedBlocks) => {
    await updateProfileAboutBlocks(user.id, updatedBlocks);
    setBlocks(updatedBlocks);
  };

  const defaultBlocks = [
    { id: 'default-text', type: 'text', title: 'About Me', content: '' },
  ];

  const effectiveBlocks = blocks.length > 0 ? blocks : defaultBlocks;

  return (
    <>
      <NavBar
        title="My Gardens"
        showHome={true}
        tabs={tabs}
        contentWidth="medium"
      />
      {!loaded ? (
        <div className={styles.loadingContainer}>
          <p className={styles.loading}>Loading...</p>
        </div>
      ) : (
        <AboutPageContent
          blocks={effectiveBlocks}
          onSave={user ? handleSave : null}
          userId={user?.id}
          title="About Me"
        />
      )}
    </>
  );
}