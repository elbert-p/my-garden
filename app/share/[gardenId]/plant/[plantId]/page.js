'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IoClose } from 'react-icons/io5';
import { getSharedPlant } from '@/lib/dataService';
import PageHeader from '@/components/PageHeader';
import SharedByBadge from '@/components/SharedByBadge';
import styles from './page.module.css';

export default function SharedPlantPage() {
  const { gardenId, plantId } = useParams();
  const router = useRouter();
  const [plant, setPlant] = useState(null);
  const [owner, setOwner] = useState(null);
  const [selImg, setSelImg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromGarden, setFromGarden] = useState(false);

  // Check if user navigated from the shared garden page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFromGarden(params.get('from') === 'garden');
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSharedPlant(plantId);
        setPlant(data.plant);
        setOwner(data.owner);
      } catch (e) {
        console.error('Failed to load shared plant:', e);
        setError('Plant not found.');
      } finally {
        setLoading(false);
      }
    })();
  }, [plantId]);

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') setSelImg(null); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, []);

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.container}><p className={styles.loading}>{error}</p></div>;
  if (!plant) return null;

  const formatDate = (d) => {
    if (!d) return null;
    const [year, month, day] = d.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const Field = ({ label, value }) => value && (Array.isArray(value) ? value.length > 0 : true) ? (
    <div className={styles.field}><span className={styles.label}>{label}</span><span className={styles.value}>{Array.isArray(value) ? value.join(', ') : value}</span></div>
  ) : null;

  return (
    <>
      <div className={styles.container}>
        <PageHeader 
          title={plant.commonName || plant.scientificName || 'Plant'} 
          showHomeLink={!fromGarden}
          backHref={fromGarden ? `/share/${gardenId}` : undefined}
          actions={<SharedByBadge user={owner} />} 
        />
        <div className={styles.details}>
          <div className={styles.mainImageContainer}>
            <img src={plant.mainImage || '/placeholder-plant.jpg'} alt="" className={styles.mainImage} />
          </div>
          <div className={`${styles.infoGrid} ${!plant.images?.length ? styles.infoGridNoMargin : ''}`}>
            <Field label="Common Name" value={plant.commonName} />
            <Field label="Scientific Name" value={plant.scientificName} />
            <Field label="Date Planted" value={formatDate(plant.datePlanted)} />
            <Field label="Bloom Time" value={plant.bloomTime} />
            <Field label="Height" value={plant.height} />
            <Field label="Sunlight" value={plant.sunlight} />
            <Field label="Moisture" value={plant.moisture} />
            <Field label="Native Range" value={plant.nativeRange} />
            {plant.notes && <div className={`${styles.field} ${styles.fieldLarge}`}><span className={styles.label}>Notes</span><span className={styles.value}>{plant.notes}</span></div>}
          </div>
          {plant.images?.length > 0 && (
            <div className={styles.photosSection}>
              <h2 className={styles.sectionTitle}>Additional Photos</h2>
              <div className={styles.imageGrid}>
                {plant.images.map((img, i) => (<div key={i} className={styles.photoItem} onClick={() => setSelImg(img)}><img src={img} alt="" className={styles.photo} /></div>))}
              </div>
            </div>
          )}
        </div>
      </div>
      {selImg && <div className={styles.photoModalOverlay} onClick={() => setSelImg(null)}><div className={styles.photoModalContent} onClick={e => e.stopPropagation()}><img src={selImg} alt="" className={styles.photoModalImage} /><button className={styles.photoModalCloseButton} onClick={() => setSelImg(null)}><IoClose size={24} /></button></div></div>}
    </>
  );
}