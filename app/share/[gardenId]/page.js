'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSharedGarden } from '@/lib/dataService';
import PageHeader from '@/components/PageHeader';
import ItemGrid from '@/components/ItemGrid';
import SharedByBadge from '@/components/SharedByBadge';
import styles from './page.module.css';

export default function SharedGardenPage() {
  const { gardenId } = useParams();
  const [garden, setGarden] = useState(null);
  const [plants, setPlants] = useState([]);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const loadData = async () => {
      try {
        const data = await getSharedGarden(gardenId, abortController.signal);
        
        if (!isMounted) return;
        
        setGarden(data.garden);
        setPlants(data.plants);
        setOwner(data.owner);
      } catch (e) {
        // Ignore abort errors - they're expected on unmount
        if (e.name === 'AbortError') return;
        
        if (!isMounted) return;
        
        console.error('Failed to load shared garden:', e);
        setError('Garden not found or no longer available.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [gardenId]);

  if (loading) return <div className={styles.container}><p className={styles.message}>Loading...</p></div>;
  if (error) return <div className={styles.container}><p className={styles.message}>{error}</p><Link href="/" className={styles.homeLink}>Go to My Gardens</Link></div>;

  return (
    <div className={styles.container}>
      <PageHeader 
        title={garden.name} 
        titleAlign="left" 
        showHomeLink={true}
        actions={<SharedByBadge user={owner} />} 
      />
      <ItemGrid
        items={plants}
        emptyMessage="This garden has no plants yet."
        linkPrefix={`/share/${gardenId}/plant`}
        linkSuffix="?from=garden"
        getItemId={(p) => p.id}
        getItemImage={(p) => p.mainImage || '/placeholder-plant.jpg'}
        getItemName={(p) => p.commonName || p.scientificName}
        getItemStyle={(p) => ({ fontStyle: p.commonName ? 'normal' : 'italic' })}
      />
    </div>
  );
}