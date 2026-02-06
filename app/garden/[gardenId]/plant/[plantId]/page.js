'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { IoClose } from 'react-icons/io5';
import { FiEdit, FiPlus, FiTrash2, FiDatabase, FiShare2 } from 'react-icons/fi';
import imageCompression from 'browser-image-compression';
import { useGarden } from '@/context/GardenContext';
import { getPlant, updatePlant, deletePlant } from '@/lib/dataService';
import PageHeader from '@/components/PageHeader';
import DropdownMenu from '@/components/DropdownMenu';
import Modal, { ConfirmModal } from '@/components/Modal';
import Button from '@/components/Button';
import InfoField from '@/components/InfoField';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import plantsData from '@/plants.json';
import styles from './page.module.css';

const BLOOM_OPTIONS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
const SUN_OPTIONS = ['Sun', 'Part Sun', 'Part Shade', 'Shade'];
const MOISTURE_OPTIONS = ['Wet', 'Medium', 'Dry'];
const NATIVE_OPTIONS = ['Northern US', 'Northeastern US', 'Southern US', 'Southeastern US', 'Eastern US', 'East Coast US', 'Mid-Atlantic US', 'Western US', 'Midwestern US', 'Central US', 'Cultivar', 'Nativar', 'Europe', 'Asia', 'South America', 'Africa', 'Other'];

const mapSun = (arr) => arr ? arr.map(s => ({ 'Full': 'Sun', 'Part': 'Part Sun', 'Shade': 'Shade' }[s] || s)).filter(Boolean) : [];
const findData = (name) => { if (!name) return null; const key = Object.keys(plantsData).find(k => k.toLowerCase() === name.toLowerCase()); return key ? plantsData[key] : null; };
const formatDateDisplay = (dateStr) => { if (!dateStr) return ''; const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); };

export default function PlantPage() {
  const router = useRouter();
  const { plantId } = useParams();
  const { gardenId, user, isInitialized, garden } = useGarden();

  const [plant, setPlant] = useState(null);
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAutofillModal, setShowAutofillModal] = useState(false);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autofillData, setAutofillData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const mainRef = useRef(null);
  const addRef = useRef(null);

  // Load plant data
  useEffect(() => {
    if (!isInitialized || !plantId || !garden) return;
    
    (async () => {
      try {
        const p = await getPlant(plantId, user?.id);
        if (p) {
          setPlant(p);
          setTemp({ ...p });
        } else {
          router.push(`/garden/${gardenId}`);
        }
      } catch {
        router.push(`/garden/${gardenId}`);
      }
      setIsLoading(false);
    })();
  }, [plantId, gardenId, user?.id, isInitialized, garden, router]);

  // Auto-show autofill modal
  useEffect(() => {
    if (plant?.scientificName && !plant.hasAutofilled) {
      const d = findData(plant.scientificName);
      if (d) {
        setAutofillData(d);
        setShowAutofillModal(true);
      }
    }
  }, [plant?.scientificName, plant?.hasAutofilled]);

  // Escape key handler
  useEffect(() => {
    const esc = (e) => {
      if (e.key === 'Escape') {
        setSelectedImage(null);
        setShowAutofillModal(false);
        setShowNotFoundModal(false);
        setShowDeleteModal(false);
        setShowShareModal(false);
        setShowSignInModal(false);
      }
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, []);

  const save = async (p) => {
    const u = await updatePlant(plantId, p, user?.id);
    setPlant(u);
    setTemp(u);
  };

  const compress = async (f) => {
    try {
      const c = await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
      return await imageCompression.getDataUrlFromFile(c);
    } catch {
      return null;
    }
  };

  const onMain = async (e) => {
    const f = e.target.files[0];
    if (f?.type.startsWith('image/')) {
      const u = await compress(f);
      if (u) await save({ ...temp, mainImage: u });
    }
  };

  const onAdd = async (e) => {
    const f = e.target.files[0];
    if (f?.type.startsWith('image/')) {
      const u = await compress(f);
      if (u) await save({ ...temp, images: [...(temp.images || []), u] });
    }
    if (addRef.current) addRef.current.value = '';
  };

  const onRemove = async (i) => await save({ ...temp, images: temp.images.filter(x => x !== i) });

  const handleShare = () => {
    if (!user) {
      setShowSignInModal(true);
      return;
    }
    setShowShareModal(true);
    setCopied(false);
  };

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${gardenId}/plant/${plantId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onAutofillClick = () => {
    const d = findData(temp.scientificName);
    d ? (setAutofillData(d), setShowAutofillModal(true)) : setShowNotFoundModal(true);
  };

  const onAutofill = async () => {
    if (!autofillData) return;
    await save({
      ...temp,
      commonName: autofillData['Common name'] || temp.commonName,
      bloomTime: autofillData['Bloom time'] || temp.bloomTime,
      height: autofillData['Height'] || temp.height,
      sunlight: mapSun(autofillData['Sunlight']) || temp.sunlight,
      moisture: autofillData['Moisture'] || temp.moisture,
      hasAutofilled: true
    });
    setShowAutofillModal(false);
  };

  const onDelete = async () => {
    await deletePlant(plantId, user?.id);
    router.push(`/garden/${gardenId}`);
  };

  // Plant-level menu items
  const plantMenu = [
    { icon: <FiEdit size={16} />, label: 'Edit', onClick: () => { setTemp({ ...plant }); setEditing(true); }},
    { icon: <FiDatabase size={16} />, label: 'Autofill', onClick: onAutofillClick },
    { icon: <FiShare2 size={16} />, label: 'Share Plant', onClick: handleShare },
    { divider: true },
    { icon: <FiTrash2 size={16} />, label: 'Delete', onClick: () => setShowDeleteModal(true), danger: true },
  ];

  if (isLoading || !plant) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading plant...</div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.container}>
        <PageHeader
          title={plant.commonName || plant.scientificName || 'Plant'}
          onBack={() => router.push(`/garden/${gardenId}`)}
          actions={
            editing ? (
              <Button variant="success" onClick={async () => { await save(temp); setEditing(false); }}>
                Save
              </Button>
            ) : (
              <DropdownMenu items={plantMenu} />
            )
          }
        />

        <div className={styles.details}>
          <div className={styles.mainImageContainer} onClick={() => mainRef.current?.click()}>
            <img src={temp.mainImage || '/placeholder-plant.jpg'} alt="" className={styles.mainImage} />
            <button className={styles.mainImageEditButton}><FiEdit size={18} /></button>
            <input ref={mainRef} type="file" onChange={onMain} className={styles.fileInput} accept="image/*" />
          </div>

          <div className={styles.infoGridWrapper}>
            <div className={styles.infoGrid}>
              <InfoField label="Common Name" value={temp.commonName} onChange={v => setTemp({ ...temp, commonName: v })} onSave={() => save(temp)} isEditing={editing} type="text" />
              <InfoField label="Scientific Name" value={temp.scientificName} onChange={v => setTemp({ ...temp, scientificName: v })} onSave={() => save(temp)} isEditing={editing} type="text" />
              <InfoField label="Date Planted" value={temp.datePlanted} onChange={v => setTemp({ ...temp, datePlanted: v })} onSave={() => save(temp)} isEditing={editing} type="date" formatDisplay={formatDateDisplay} />
              <InfoField label="Bloom Time" value={temp.bloomTime} onChange={v => setTemp({ ...temp, bloomTime: v })} onSave={() => save(temp)} isEditing={editing} type="multiselect" options={BLOOM_OPTIONS} />
              <InfoField label="Height" value={temp.height} onChange={v => setTemp({ ...temp, height: v })} onSave={() => save(temp)} isEditing={editing} type="text" placeholder="e.g., 2-3 ft" />
              <InfoField label="Sunlight" value={temp.sunlight} onChange={v => setTemp({ ...temp, sunlight: v })} onSave={() => save(temp)} isEditing={editing} type="multiselect" options={SUN_OPTIONS} />
              <InfoField label="Moisture" value={temp.moisture} onChange={v => setTemp({ ...temp, moisture: v })} onSave={() => save(temp)} isEditing={editing} type="multiselect" options={MOISTURE_OPTIONS} />
              <InfoField label="Native Range" value={temp.nativeRange} onChange={v => setTemp({ ...temp, nativeRange: v })} onSave={() => save(temp)} isEditing={editing} type="multiselect" options={NATIVE_OPTIONS} />
              <InfoField label="Notes" value={temp.notes} onChange={v => setTemp({ ...temp, notes: v })} onSave={() => save(temp)} isEditing={editing} type="textarea" emptyText="No notes" size="large" />
            </div>
          </div>

          <div className={styles.photosSection}>
            <h2 className={styles.sectionTitle}>Additional Photos</h2>
            {temp.images?.length > 0 ? (
              <div className={styles.imageGrid}>
                {temp.images.map((img, i) => (
                  <div key={i} className={styles.photoItem}>
                    <img src={img} alt="" className={styles.photo} onClick={() => setSelectedImage(img)} />
                    <button onClick={e => { e.stopPropagation(); onRemove(img); }} className={styles.removeButton}>
                      <IoClose size={16} />
                    </button>
                  </div>
                ))}
                <button className={styles.addPhotoButton} onClick={() => addRef.current?.click()}>
                  <FiPlus size={24} />
                  <span>Add Photo</span>
                  <input ref={addRef} type="file" onChange={onAdd} className={styles.fileInput} accept="image/*" />
                </button>
              </div>
            ) : (
              <div className={styles.emptyPhotosContainer}>
                <p className={styles.noPhotos}>No additional photos yet.</p>
                <div className={`${styles.emptyPhotosAddButton} ${editing ? styles.visible : ''}`}>
                  <button className={styles.addPhotoButton} onClick={() => addRef.current?.click()}>
                    <FiPlus size={24} />
                    <span>Add Photo</span>
                    <input ref={addRef} type="file" onChange={onAdd} className={styles.fileInput} accept="image/*" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedImage && (
        <div className={styles.photoModalOverlay} onClick={() => setSelectedImage(null)}>
          <div className={styles.photoModalContent} onClick={e => e.stopPropagation()}>
            <img src={selectedImage} alt="" className={styles.photoModalImage} />
            <button className={styles.photoModalCloseButton} onClick={() => setSelectedImage(null)}>
              <IoClose size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Plant-specific Modals */}
      <ConfirmModal
        isOpen={showAutofillModal}
        onClose={() => setShowAutofillModal(false)}
        onConfirm={onAutofill}
        title="Autofill Plant Data"
        message={<>Found <strong>{autofillData?.['Latin name']}</strong> in database. Would you like to autofill?</>}
        confirmText="Yes"
        cancelText="No"
      />

      <ConfirmModal
        isOpen={showNotFoundModal}
        onClose={() => setShowNotFoundModal(false)}
        onConfirm={() => setShowNotFoundModal(false)}
        title="Autofill not available"
        message={<><strong>{temp?.scientificName || 'Plant'}</strong> has not been added to the database.</>}
        confirmText="OK"
        cancelText={null}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={onDelete}
        title="Delete Plant"
        message={<>Delete <strong>{plant.commonName || plant.scientificName}</strong>?</>}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

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

      <Modal isOpen={showSignInModal} onClose={() => setShowSignInModal(false)} title="Sign in to Share" size="small">
        <p className={styles.shareText}>Sign in with Google to share your plants with others.</p>
        <div className={styles.signInButtons}>
          <Button variant="secondary" onClick={() => setShowSignInModal(false)}>No thanks</Button>
          <GoogleSignInButton />
        </div>
      </Modal>
    </>
  );
}