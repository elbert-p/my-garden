'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IoClose } from 'react-icons/io5';
import { FiCopy, FiShare2 } from 'react-icons/fi';
import { useSharedGarden } from '@/context/SharedGardenContext';
import { getSharedPlant } from '@/lib/dataService';
import { setCopiedPlant } from '@/lib/clipboardStorage';
import PageHeader from '@/components/PageHeader';
import DropdownMenu from '@/components/DropdownMenu';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import RichText from '@/components/RichText';
import PlantBadges from '@/components/PlantBadges';
import styles from './page.module.css';

export default function SharedPlantPage() {
  const { gardenId, plantId } = useParams();
  const router = useRouter();
  const { garden, plants, plantsLoaded } = useSharedGarden();
  const hadContextOnMount = useRef(plantsLoaded);
  
  const [plant, setPlant] = useState(null);
  const [selImg, setSelImg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

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
    const esc = (e) => { if (e.key === 'Escape') { setSelImg(null); setShowShareModal(false); } };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, []);

  const formatDate = (d) => {
    if (!d) return null;
    const [year, month, day] = d.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleBack = () => {
    if (hadContextOnMount.current) {
      router.back();
    } else {
      router.push(`/share/${gardenId}`);
    }
  };

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${gardenId}/plant/${plantId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const menuItems = [
    { icon: <FiCopy size={16} />, label: 'Copy Plant', onClick: onCopyPlant },
    { icon: <FiShare2 size={16} />, label: 'Share Plant', onClick: () => { setShowShareModal(true); setCopied(false); } },
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
          onBack={handleBack}
          actions={<DropdownMenu items={menuItems} />}
        />

        <div className={styles.details}>
          <div className={styles.mainImageContainer} onClick={() => setSelImg(plant.mainImage || '/placeholder-plant.jpg')}>
            <img src={plant.mainImage || '/placeholder-plant.jpg'} alt="" className={styles.mainImage} />
            {!garden?.customization?.hideBadges && <PlantBadges commonName={plant.commonName} scientificName={plant.scientificName} size="large" />}
          </div>

          <div className={`${styles.infoGrid} ${!visibleImages.length ? styles.infoGridNoMargin : ''}`}>
            <Field label="Common Name" value={plant.commonName} fieldKey="commonName" />
            <Field label="Scientific Name" value={plant.scientificName} fieldKey="scientificName" />
            <Field label="Date Planted" value={formatDate(plant.datePlanted)} fieldKey="datePlanted" />
            <Field label="Bloom Time" value={plant.bloomTime} fieldKey="bloomTime" />
            <Field label="Height" value={plant.height} fieldKey="height" />
            <Field label="Sunlight" value={plant.sunlight} fieldKey="sunlight" />
            <Field label="Moisture" value={plant.moisture} fieldKey="moisture" />
            <Field label="Plant Type" value={plant.plantType} fieldKey="plantType" />
            <Field label="Native Range" value={plant.nativeRange} fieldKey="nativeRange" />
            {isFieldVisible('hostedInsects') && plant.hostedInsects && (
              <div className={styles.field}>
                <span className={styles.label}>Hosted Butterflies and Moths</span>
                <div className={styles.value} style={{ maxHeight: '195px', overflowY: 'auto' }}>
                  <RichText content={plant.hostedInsects} />
                </div>
              </div>
            )}
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

      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Plant" size="small">
        <p className={styles.shareText}>Anyone with this link can view this plant:</p>
        <div className={styles.shareLink}>
          <code>{`${typeof window !== 'undefined' ? window.location.origin : ''}/share/${gardenId}/plant/${plantId}`}</code>
        </div>
        <div className={styles.shareButtons}>
          <Button variant="secondary" onClick={() => setShowShareModal(false)}>Close</Button>
          <Button onClick={copyShareLink}>{copied ? 'Copied!' : 'Copy Link'}</Button>
        </div>
      </Modal>
    </>
  );
}