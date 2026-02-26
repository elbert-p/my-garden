'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { IoClose } from 'react-icons/io5';
import { FiCopy } from 'react-icons/fi';
import { useSharedGarden } from '@/context/SharedGardenContext';
import { getSharedPlant } from '@/lib/dataService';
import { setCopiedPlant } from '@/lib/clipboardStorage';
import PageHeader from '@/components/PageHeader';
import DropdownMenu from '@/components/DropdownMenu';
import RichText from '@/components/RichText';
import styles from './page.module.css';

export default function SharedPlantPage() {
  const { gardenId, plantId } = useParams();
  const { plants, plantsLoaded } = useSharedGarden();
  
  const [plant, setPlant] = useState(null);
  const [selImg, setSelImg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (plantsLoaded) {
      const cached = plants.find(p => p.id === plantId);
      if (cached) {
        setPlant(cached);
        setLoading(false);
        return;
      }
    }

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
  }, [plantId, plantsLoaded, plants]);

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

  const onCopyPlant = () => {
    if (!plant) return;
    setCopiedPlant({
      commonName: plant.commonName,
      scientificName: plant.scientificName,
      mainImage: plant.mainImage,
      datePlanted: plant.datePlanted,
      bloomTime: plant.bloomTime,
      height: plant.height,
      sunlight: plant.sunlight,
      moisture: plant.moisture,
      nativeRange: plant.nativeRange,
      notes: plant.notes,
      images: plant.images,
      hasAutofilled: plant.hasAutofilled,
    });
  };

  const copyMenu = [
    { icon: <FiCopy size={16} />, label: 'Copy Plant', onClick: onCopyPlant },
  ];

  const Field = ({ label, value }) => value && (Array.isArray(value) ? value.length > 0 : true) ? (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{Array.isArray(value) ? value.join(', ') : value}</span>
    </div>
  ) : null;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading plant...</div>
      </div>
    );
  }

  if (!plant) {
    return (
      <div className={styles.container}>
        <p className={styles.loading}>Plant not found.</p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.container}>
        <PageHeader
          title={plant.commonName || plant.scientificName || 'Plant'}
          backHref={`/share/${gardenId}`}
          actions={<DropdownMenu items={copyMenu} />}
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
            {plant.notes && (
              <div className={`${styles.field} ${styles.fieldLarge}`}>
                <span className={styles.label}>Notes</span>
                <div className={styles.value}><RichText content={plant.notes} /></div>
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