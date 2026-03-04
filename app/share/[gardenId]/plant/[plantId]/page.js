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
      plantType: plant.plantType,
      hostedInsects: plant.hostedInsects,
      notes: plant.notes,
      images: plant.images,
      hasAutofilled: plant.hasAutofilled,
    });
  };

  const copyMenu = [
    { icon: <FiCopy size={16} />, label: 'Copy Plant', onClick: onCopyPlant },
  ];

  const hiddenFields = plant?.plantPrivacy?.hiddenFields || [];
  const hiddenImages = plant?.plantPrivacy?.hiddenImages || [];
  const isFieldVisible = (key) => !hiddenFields.includes(key);
  const visibleImages = (plant?.images || []).filter(img => !hiddenImages.includes(img));

  const Field = ({ label, value, fieldKey }) => {
    if (fieldKey && !isFieldVisible(fieldKey)) return null;
    if (!value || (Array.isArray(value) && value.length === 0)) return null;
    return (
      <div className={styles.field}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{Array.isArray(value) ? value.join(', ') : value}</span>
      </div>
    );
  };

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

          <div className={`${styles.infoGrid} ${!visibleImages.length ? styles.infoGridNoMargin : ''}`}>
            <Field label="Common Name" value={plant.commonName} fieldKey="commonName" />
            <Field label="Scientific Name" value={plant.scientificName} fieldKey="scientificName" />
            <Field label="Date Planted" value={formatDate(plant.datePlanted)} fieldKey="datePlanted" />
            <Field label="Bloom Time" value={plant.bloomTime} fieldKey="bloomTime" />
            <Field label="Height" value={plant.height} fieldKey="height" />
            <Field label="Sunlight" value={plant.sunlight} fieldKey="sunlight" />
            <Field label="Moisture" value={plant.moisture} fieldKey="moisture" />
            <Field label="Native Range" value={plant.nativeRange} fieldKey="nativeRange" />
            <Field label="Plant Type" value={plant.plantType} fieldKey="plantType" />
            <Field label="Hosted Insects" value={plant.hostedInsects} fieldKey="hostedInsects" />
            {isFieldVisible('notes') && plant.notes && (
              <div className={`${styles.field} ${styles.fieldLarge}`}>
                <span className={styles.label}>Notes</span>
                <div className={styles.value}><RichText content={plant.notes} /></div>
              </div>
            )}
          </div>

          {visibleImages.length > 0 && (
            <div className={styles.photosSection}>
              <h2 className={styles.sectionTitle}>Additional Photos</h2>
              <div className={styles.imageGrid}>
                {visibleImages.map((img, i) => (
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