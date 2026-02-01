'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { IoClose, IoArrowBack } from 'react-icons/io5';
import { FiEdit, FiPlus } from 'react-icons/fi';
import localforage from 'localforage';
import imageCompression from 'browser-image-compression';
import InfoField from '@/components/InfoField';
import styles from './page.module.css';

// Options for multi-select fields
const BLOOM_TIME_OPTIONS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
const SUNLIGHT_OPTIONS = ['Full', 'Part', 'Shade'];
const MOISTURE_OPTIONS = ['Moist', 'Med', 'Dry'];

export default function PlantPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [plant, setPlant] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [tempPlant, setTempPlant] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const mainImageInputRef = useRef(null);
  const addPhotoInputRef = useRef(null);

  useEffect(() => {
    const loadPlant = async () => {
      if (typeof window !== 'undefined' && id) {
        const storedPlants = (await localforage.getItem('plants')) || [];
        const foundPlant = storedPlants.find((p) => p.id === id);
        if (foundPlant) {
          setPlant(foundPlant);
          setTempPlant({ ...foundPlant });
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
      }
    };
    if (selectedImage) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedImage]);

  const handleEdit = () => {
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

  // Auto-save function for individual field changes
  const handleFieldSave = async () => {
    const storedPlants = (await localforage.getItem('plants')) || [];
    const updatedPlants = storedPlants.map((p) => (p.id === id ? tempPlant : p));
    await localforage.setItem('plants', updatedPlants);
    setPlant(tempPlant);
  };

  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };
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
        // Auto-save the image change
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
        // Auto-save the image change
        const storedPlants = (await localforage.getItem('plants')) || [];
        const updatedPlants = storedPlants.map((p) => (p.id === id ? updatedTempPlant : p));
        await localforage.setItem('plants', updatedPlants);
        setPlant(updatedTempPlant);
      }
    }
    // Reset the input so the same file can be added again if needed
    if (addPhotoInputRef.current) {
      addPhotoInputRef.current.value = '';
    }
  };

  const handleRemoveImage = async (imageToRemove) => {
    const newImages = tempPlant.images.filter((img) => img !== imageToRemove);
    const updatedTempPlant = { ...tempPlant, images: newImages };
    setTempPlant(updatedTempPlant);
    // Auto-save the image removal
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
          <h1 className={styles.title}>{plant.commonName || 'Plant Details'}</h1>
          {isEditing ? (
            <button onClick={handleSave} className={styles.saveButton}>
              Save
            </button>
          ) : (
            <button onClick={handleEdit} className={styles.editButton}>
              Edit
            </button>
          )}
        </header>
        
        <div className={styles.details}>
          {/* Main Image with hover edit icon in top right */}
          <div 
            className={styles.mainImageContainer}
            onClick={() => mainImageInputRef.current?.click()}
          >
            <img 
              src={tempPlant.mainImage || '/placeholder-plant.jpg'} 
              alt={tempPlant.commonName} 
              className={styles.mainImage} 
            />
            <button className={styles.mainImageEditButton} aria-label="Change photo">
              <FiEdit size={18} strokeWidth={2} />
            </button>
            <input 
              ref={mainImageInputRef}
              type="file" 
              onChange={handleMainImageChange} 
              className={styles.fileInput} 
              accept="image/*" 
            />
          </div>
          
          <div className={styles.infoGridWrapper}>
            <div className={styles.infoGrid}>
              <InfoField
                label="Common Name"
                value={tempPlant.commonName}
                onChange={(val) => setTempPlant({ ...tempPlant, commonName: val })}
                onSave={handleFieldSave}
                isEditing={isEditing}
                type="text"
              />
                            
              <InfoField
                label="Scientific Name"
                value={tempPlant.scientificName}
                onChange={(val) => setTempPlant({ ...tempPlant, scientificName: val })}
                onSave={handleFieldSave}
                isEditing={isEditing}
                type="text"
              />
                            
              <InfoField
                label="Date Planted"
                value={tempPlant.datePlanted}
                onChange={(val) => setTempPlant({ ...tempPlant, datePlanted: val })}
                onSave={handleFieldSave}
                isEditing={isEditing}
                type="date"
              />
              
              <InfoField
                label="Bloom Time"
                value={tempPlant.bloomTime}
                onChange={(val) => setTempPlant({ ...tempPlant, bloomTime: val })}
                onSave={handleFieldSave}
                isEditing={isEditing}
                type="multiselect"
                options={BLOOM_TIME_OPTIONS}
                placeholder="Select months..."
              />

              <InfoField
                label="Height"
                value={tempPlant.height}
                onChange={(val) => setTempPlant({ ...tempPlant, height: val })}
                onSave={handleFieldSave}
                isEditing={isEditing}
                type="text"
                placeholder="e.g., 2-3 ft"
              />

              <InfoField
                label="Sunlight"
                value={tempPlant.sunlight}
                onChange={(val) => setTempPlant({ ...tempPlant, sunlight: val })}
                onSave={handleFieldSave}
                isEditing={isEditing}
                type="multiselect"
                options={SUNLIGHT_OPTIONS}
                placeholder="Select sunlight..."
              />
              
              <InfoField
                label="Moisture"
                value={tempPlant.moisture}
                onChange={(val) => setTempPlant({ ...tempPlant, moisture: val })}
                onSave={handleFieldSave}
                isEditing={isEditing}
                type="multiselect"
                options={MOISTURE_OPTIONS}
                placeholder="Select moisture..."
              />
              
              <InfoField
                label="Notes"
                value={tempPlant.notes}
                onChange={(val) => setTempPlant({ ...tempPlant, notes: val })}
                onSave={handleFieldSave}
                isEditing={isEditing}
                type="textarea"
                emptyText="No notes"
                size="large"
              />
            </div>
          </div>

          <div className={styles.photosSection}>
            <h2 className={styles.sectionTitle}>Additional Photos</h2>
            {tempPlant.images && tempPlant.images.length > 0 ? (
              <div className={styles.imageGrid}>
                {tempPlant.images.map((img, index) => (
                  <div key={index} className={styles.photoItem}>
                    <img 
                      src={img} 
                      alt={`Additional photo ${index + 1}`} 
                      className={styles.photo}
                      onClick={() => setSelectedImage(img)} 
                    />
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); 
                        handleRemoveImage(img);
                      }} 
                      className={styles.removeButton}
                      aria-label="Remove photo"
                    >
                      <IoClose size={16} />
                    </button>
                  </div>
                ))}
                <button 
                  className={styles.addPhotoButton}
                  onClick={() => addPhotoInputRef.current?.click()}
                  aria-label="Add photo"
                >
                  <FiPlus size={24} strokeWidth={2} />
                  <span>Add Photo</span>
                  <input 
                    ref={addPhotoInputRef}
                    type="file" 
                    onChange={handleAddImage} 
                    className={styles.fileInput} 
                    accept="image/*" 
                  />
                </button>
              </div>
            ) : (
              <div className={styles.emptyPhotosContainer}>
                <p className={styles.noPhotos}>No additional photos yet.</p>
                <div className={`${styles.emptyPhotosAddButton} ${isEditing ? styles.visible : ''}`}>
                  <button 
                    className={styles.addPhotoButton}
                    onClick={() => addPhotoInputRef.current?.click()}
                    aria-label="Add photo"
                  >
                    <FiPlus size={24} strokeWidth={2} />
                    <span>Add Photo</span>
                    <input 
                      ref={addPhotoInputRef}
                      type="file" 
                      onChange={handleAddImage} 
                      className={styles.fileInput} 
                      accept="image/*" 
                    />
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
    </>
  );
}
