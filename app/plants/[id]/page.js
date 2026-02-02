'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { IoClose, IoArrowBack, IoEllipsisHorizontal } from 'react-icons/io5';
import { FiEdit, FiPlus, FiTrash2, FiDatabase } from 'react-icons/fi';
import localforage from 'localforage';
import imageCompression from 'browser-image-compression';
import InfoField from '@/components/InfoField';
import plantsData from '@/plants.json';
import styles from './page.module.css';

const BLOOM_TIME_OPTIONS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
const SUNLIGHT_OPTIONS = ['Sun', 'Part Sun', 'Part Shade', 'Shade'];
const MOISTURE_OPTIONS = ['Wet', 'Medium', 'Dry'];
const NATIVE_RANGE_OPTIONS = ['Northern US', 'Northeastern US', 'Southern US', 'Southeastern US', 'Eastern US', 'East Coast US', 'Mid-Atlantic US', 'Western US', 'Midwestern US', 'Central US', 'Nativar', 'Europe', 'Asia', 'Africa', 'Other'];

const mapSunlight = (sunlightArr) => {
  if (!sunlightArr) return [];
  const mapping = { 'Full': 'Sun', 'Part': 'Part Sun', 'Shade': 'Shade' };
  return sunlightArr.map(s => mapping[s] || s).filter(Boolean);
};

// Case-insensitive lookup helper
const findPlantData = (scientificName) => {
  if (!scientificName) return null;
  const lowerName = scientificName.toLowerCase();
  const key = Object.keys(plantsData).find(k => k.toLowerCase() === lowerName);
  return key ? plantsData[key] : null;
};

export default function PlantPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [plant, setPlant] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [tempPlant, setTempPlant] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAutofillModal, setShowAutofillModal] = useState(false);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [autofillData, setAutofillData] = useState(null);
  const mainImageInputRef = useRef(null);
  const addPhotoInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const loadPlant = async () => {
      if (typeof window !== 'undefined' && id) {
        const storedPlants = (await localforage.getItem('plants')) || [];
        const foundPlant = storedPlants.find((p) => p.id === id);
        if (foundPlant) {
          setPlant(foundPlant);
          setTempPlant({ ...foundPlant });
          
          // Check if scientific name exists in JSON and hasn't been autofilled yet
          const foundData = findPlantData(foundPlant.scientificName);
          if (foundPlant.scientificName && foundData && !foundPlant.hasAutofilled) {
            setAutofillData(foundData);
            setShowAutofillModal(true);
          }
        } else {
          router.push('/');
        }
      }
    };
    loadPlant();
  }, [id, router]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedImage(null);
        setShowAutofillModal(false);
        setShowNotFoundModal(false);
        setShowDeleteModal(false);
        setShowMenu(false);
      }
    };
    if (selectedImage || showAutofillModal || showNotFoundModal || showDeleteModal) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, showAutofillModal, showNotFoundModal, showDeleteModal]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleAutofillClick = () => {
    setShowMenu(false);
    const foundData = findPlantData(tempPlant.scientificName);
    if (foundData) {
      setAutofillData(foundData);
      setShowAutofillModal(true);
    } else {
      setShowNotFoundModal(true);
    }
  };

  const handleAutofill = async () => {
    if (!autofillData) return;
    
    const updatedPlant = {
      ...tempPlant,
      commonName: autofillData['Common name'] || tempPlant.commonName,
      bloomTime: autofillData['Bloom time'] || tempPlant.bloomTime,
      height: autofillData['Height'] || tempPlant.height,
      sunlight: mapSunlight(autofillData['Sunlight']) || tempPlant.sunlight,
      moisture: autofillData['Moisture'] || tempPlant.moisture,
      hasAutofilled: true,
    };
    
    setTempPlant(updatedPlant);
    const storedPlants = (await localforage.getItem('plants')) || [];
    const updatedPlants = storedPlants.map((p) => (p.id === id ? updatedPlant : p));
    await localforage.setItem('plants', updatedPlants);
    setPlant(updatedPlant);
    setShowAutofillModal(false);
  };

  const handleDelete = async () => {
    const storedPlants = (await localforage.getItem('plants')) || [];
    const updatedPlants = storedPlants.filter((p) => p.id !== id);
    await localforage.setItem('plants', updatedPlants);
    router.push('/');
  };

  const handleEdit = () => {
    setShowMenu(false);
    setTempPlant({ ...plant });
    setIsEditing(true);
  };

  const handleSave = async () => {
    const storedPlants = (await localforage.getItem('plants')) || [];
    const updatedPlants = storedPlants.map((p) => (p.id === id ? tempPlant : p));
    await localforage.setItem('plants', updatedPlants);
    setPlant(tempPlant);
    setIsEditing(false);
  };

  const handleFieldSave = async () => {
    const storedPlants = (await localforage.getItem('plants')) || [];
    const updatedPlants = storedPlants.map((p) => (p.id === id ? tempPlant : p));
    await localforage.setItem('plants', updatedPlants);
    setPlant(tempPlant);
  };

  const compressImage = async (file) => {
    const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
    try {
      const compressedFile = await imageCompression(file, options);
      return await imageCompression.getDataUrlFromFile(compressedFile);
    } catch (error) {
      console.error('Image compression error:', error);
      return null;
    }
  };

  const handleMainImageChange = async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const compressedDataUrl = await compressImage(file);
      if (compressedDataUrl) {
        const updatedTempPlant = { ...tempPlant, mainImage: compressedDataUrl };
        setTempPlant(updatedTempPlant);
        const storedPlants = (await localforage.getItem('plants')) || [];
        const updatedPlants = storedPlants.map((p) => (p.id === id ? updatedTempPlant : p));
        await localforage.setItem('plants', updatedPlants);
        setPlant(updatedTempPlant);
      }
    }
  };

  const handleAddImage = async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const compressedDataUrl = await compressImage(file);
      if (compressedDataUrl) {
        const newImages = [...(tempPlant.images || []), compressedDataUrl];
        const updatedTempPlant = { ...tempPlant, images: newImages };
        setTempPlant(updatedTempPlant);
        const storedPlants = (await localforage.getItem('plants')) || [];
        const updatedPlants = storedPlants.map((p) => (p.id === id ? updatedTempPlant : p));
        await localforage.setItem('plants', updatedPlants);
        setPlant(updatedTempPlant);
      }
    }
    if (addPhotoInputRef.current) addPhotoInputRef.current.value = '';
  };

  const handleRemoveImage = async (imageToRemove) => {
    const newImages = tempPlant.images.filter((img) => img !== imageToRemove);
    const updatedTempPlant = { ...tempPlant, images: newImages };
    setTempPlant(updatedTempPlant);
    const storedPlants = (await localforage.getItem('plants')) || [];
    const updatedPlants = storedPlants.map((p) => (p.id === id ? updatedTempPlant : p));
    await localforage.setItem('plants', updatedPlants);
    setPlant(updatedTempPlant);
  };

  if (!plant) {
    return <div className={styles.loading}>Loading plant details...</div>;
  }

  return (
    <>
      <div className={styles.container}>
        <header className={styles.header}>
          <button onClick={() => router.push('/')} className={styles.backButton}>
            <IoArrowBack size={18} />
            <span>Back</span>
          </button>
          <h1 className={styles.title}>{plant.commonName || plant.scientificName || 'Plant Details'}</h1>
          {isEditing ? (
            <button onClick={handleSave} className={styles.saveButton}>Save</button>
          ) : (
            <div className={styles.menuContainer} ref={menuRef}>
              <button onClick={() => setShowMenu(!showMenu)} className={styles.menuButton} aria-label="Menu">
                <IoEllipsisHorizontal size={20} />
              </button>
              {showMenu && (
                <div className={styles.dropdownMenu}>
                  <button onClick={handleEdit} className={styles.dropdownItem}>
                    <FiEdit size={16} />
                    <span>Edit</span>
                  </button>
                  <button onClick={handleAutofillClick} className={styles.dropdownItem}>
                    <FiDatabase size={16} />
                    <span>Autofill</span>
                  </button>
                  <button onClick={() => { setShowMenu(false); setShowDeleteModal(true); }} className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}>
                    <FiTrash2 size={16} />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </header>
        
        <div className={styles.details}>
          <div className={styles.mainImageContainer} onClick={() => mainImageInputRef.current?.click()}>
            <img src={tempPlant.mainImage || '/placeholder-plant.jpg'} alt={tempPlant.commonName} className={styles.mainImage} />
            <button className={styles.mainImageEditButton} aria-label="Change photo">
              <FiEdit size={18} strokeWidth={2} />
            </button>
            <input ref={mainImageInputRef} type="file" onChange={handleMainImageChange} className={styles.fileInput} accept="image/*" />
          </div>
          
          <div className={styles.infoGridWrapper}>
            <div className={styles.infoGrid}>
              <InfoField label="Common Name" value={tempPlant.commonName} onChange={(val) => setTempPlant({ ...tempPlant, commonName: val })} onSave={handleFieldSave} isEditing={isEditing} type="text" />
              <InfoField label="Scientific Name" value={tempPlant.scientificName} onChange={(val) => setTempPlant({ ...tempPlant, scientificName: val })} onSave={handleFieldSave} isEditing={isEditing} type="text" />
              <InfoField label="Date Planted" value={tempPlant.datePlanted} onChange={(val) => setTempPlant({ ...tempPlant, datePlanted: val })} onSave={handleFieldSave} isEditing={isEditing} type="date" />
              <InfoField label="Bloom Time" value={tempPlant.bloomTime} onChange={(val) => setTempPlant({ ...tempPlant, bloomTime: val })} onSave={handleFieldSave} isEditing={isEditing} type="multiselect" options={BLOOM_TIME_OPTIONS} placeholder="Select months..." />
              <InfoField label="Height" value={tempPlant.height} onChange={(val) => setTempPlant({ ...tempPlant, height: val })} onSave={handleFieldSave} isEditing={isEditing} type="text" placeholder="e.g., 2-3 ft" />
              <InfoField label="Sunlight" value={tempPlant.sunlight} onChange={(val) => setTempPlant({ ...tempPlant, sunlight: val })} onSave={handleFieldSave} isEditing={isEditing} type="multiselect" options={SUNLIGHT_OPTIONS} placeholder="Select sunlight..." />
              <InfoField label="Moisture" value={tempPlant.moisture} onChange={(val) => setTempPlant({ ...tempPlant, moisture: val })} onSave={handleFieldSave} isEditing={isEditing} type="multiselect" options={MOISTURE_OPTIONS} placeholder="Select moisture..." />
              <InfoField label="Native Range" value={tempPlant.nativeRange} onChange={(val) => setTempPlant({ ...tempPlant, nativeRange: val })} onSave={handleFieldSave} isEditing={isEditing} type="multiselect" options={NATIVE_RANGE_OPTIONS} placeholder="Select native range..." />
              <InfoField label="Notes" value={tempPlant.notes} onChange={(val) => setTempPlant({ ...tempPlant, notes: val })} onSave={handleFieldSave} isEditing={isEditing} type="textarea" emptyText="No notes" size="large" />
            </div>
          </div>

          <div className={styles.photosSection}>
            <h2 className={styles.sectionTitle}>Additional Photos</h2>
            {tempPlant.images && tempPlant.images.length > 0 ? (
              <div className={styles.imageGrid}>
                {tempPlant.images.map((img, index) => (
                  <div key={index} className={styles.photoItem}>
                    <img src={img} alt={`Additional photo ${index + 1}`} className={styles.photo} onClick={() => setSelectedImage(img)} />
                    <button onClick={(e) => { e.stopPropagation(); handleRemoveImage(img); }} className={styles.removeButton} aria-label="Remove photo">
                      <IoClose size={16} />
                    </button>
                  </div>
                ))}
                <button className={styles.addPhotoButton} onClick={() => addPhotoInputRef.current?.click()} aria-label="Add photo">
                  <FiPlus size={24} strokeWidth={2} />
                  <span>Add Photo</span>
                  <input ref={addPhotoInputRef} type="file" onChange={handleAddImage} className={styles.fileInput} accept="image/*" />
                </button>
              </div>
            ) : (
              <div className={styles.emptyPhotosContainer}>
                <p className={styles.noPhotos}>No additional photos yet.</p>
                <div className={`${styles.emptyPhotosAddButton} ${isEditing ? styles.visible : ''}`}>
                  <button className={styles.addPhotoButton} onClick={() => addPhotoInputRef.current?.click()} aria-label="Add photo">
                    <FiPlus size={24} strokeWidth={2} />
                    <span>Add Photo</span>
                    <input ref={addPhotoInputRef} type="file" onChange={handleAddImage} className={styles.fileInput} accept="image/*" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {selectedImage && (
        <div className={styles.photoModalOverlay} onClick={() => setSelectedImage(null)}>
          <div className={styles.photoModalContent} onClick={(e) => e.stopPropagation()}>
            <img src={selectedImage} alt="Expanded view" className={styles.photoModalImage} />
            <button className={styles.photoModalCloseButton} onClick={() => setSelectedImage(null)}>
              <IoClose size={24} />
            </button>
          </div>
        </div>
      )}
      
      {showAutofillModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAutofillModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Autofill Plant Data</h2>
            <p className={styles.modalText}>
              We found <strong>{autofillData?.['Latin name']}</strong> in our database. Would you like to autofill the plant data?
            </p>
            <div className={styles.modalButtons}>
              <button onClick={() => setShowAutofillModal(false)} className={styles.modalCancelButton}>No, thanks</button>
              <button onClick={handleAutofill} className={styles.modalConfirmButton}>Yes, autofill</button>
            </div>
          </div>
        </div>
      )}

      {showNotFoundModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNotFoundModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Autofill not available</h2>
            <p className={styles.modalText}>
              <strong>{tempPlant.scientificName || 'This plant'}</strong> has not been added to the database.
            </p>
            <div className={styles.modalButtons}>
              <button onClick={() => setShowNotFoundModal(false)} className={styles.modalConfirmButton}>OK</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Delete Plant</h2>
            <p className={styles.modalText}>
              Are you sure you want to delete <strong>{plant.commonName || plant.scientificName || 'this plant'}</strong>? This action cannot be undone.
            </p>
            <div className={styles.modalButtons}>
              <button onClick={() => setShowDeleteModal(false)} className={styles.modalCancelButton}>Cancel</button>
              <button onClick={handleDelete} className={styles.modalDeleteButton}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}