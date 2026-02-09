'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { IoClose } from 'react-icons/io5';
import { useSharedGarden } from '@/context/SharedGardenContext';
import { getSharedPlant } from '@/lib/dataService';
import PageHeader from '@/components/PageHeader';
import styles from './page.module.css';

export default function SharedPlantPage() {
  const { gardenId, plantId } = useParams();
  const { plants } = useSharedGarden();
  
  const [plant, setPlant] = useState(null);
  const [selImg, setSelImg] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get plant name from context for immediate header display
  const contextPlant = plants.find(p => p.id === plantId);
  const displayName = plant?.commonName || plant?.scientificName || contextPlant?.commonName || contextPlant?.scientificName || 'Plant';

  // Try to get plant from context first (already loaded), otherwise fetch
  useEffect(() => {
    const cachedPlant = plants.find(p => p.id === plantId);
    
    if (cachedPlant) {
      setPlant(cachedPlant);
      setLoading(false);
    } else {
      // Fetch if not in context
      (async () => {
        try {
          const data = await getSharedPlant(plantId);
          if (data) setPlant(data.plant);
        } catch (e) {
          console.error('Failed to load plant:', e);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [plantId, plants]);

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') setSelImg(null); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, []);

  const formatDate = (d) => {
    if (!d) return null;
    const [year, month, day] = d.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const Field = ({ label, value }) => value && (Array.isArray(value) ? value.length > 0 : true) ? (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{Array.isArray(value) ? value.join(', ') : value}</span>
    </div>
  ) : null;

  return (
    <>
      <div className={styles.container}>
        <PageHeader
          title={displayName}
          backHref={`/share/${gardenId}`}
        />

        {loading ? (
          <div className={styles.loading}>Loading plant...</div>
        ) : !plant ? (
          <p className={styles.loading}>Plant not found.</p>
        ) : (
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
              {plant.notes && (
                <div className={`${styles.field} ${styles.fieldLarge}`}>
                  <span className={styles.label}>Notes</span>
                  <span className={styles.value}>{plant.notes}</span>
                </div>
              )}
            </div>

            {plant.images?.length > 0 && (
              <div className={styles.photosSection}>
                <h2 className={styles.sectionTitle}>Additional Photos</h2>
                <div className={styles.imageGrid}>
                  {plant.images.map((img, i) => (
                    <div key={i} className={styles.photoItem} onClick={() => setSelImg(img)}>
                      <img src={img} alt="" className={styles.photo} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selImg && (
        <div className={styles.photoModalOverlay} onClick={() => setSelImg(null)}>
          <div className={styles.photoModalContent} onClick={e => e.stopPropagation()}>
            <img src={selImg} alt="" className={styles.photoModalImage} />
            <button className={styles.photoModalCloseButton} onClick={() => setSelImg(null)}>
              <IoClose size={24} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}