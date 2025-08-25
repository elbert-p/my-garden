'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FiEdit } from 'react-icons/fi';
import localforage from 'localforage'; // 1. Import localforage
import imageCompression from 'browser-image-compression'; // 2. Import compression library
import styles from './page.module.css';

export default function PlantPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [plant, setPlant] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [tempPlant, setTempPlant] = useState(null);

  useEffect(() => {
    // This function is now async
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

  const handleEdit = () => {
    setTempPlant({ ...plant });
    setIsEditing(true);
  };

  // handleSave is now async
  const handleSave = async () => {
    const storedPlants = (await localforage.getItem('plants')) || [];
    const updatedPlants = storedPlants.map((p) => (p.id === id ? tempPlant : p));
    await localforage.setItem('plants', updatedPlants); // Use localforage
    setPlant(tempPlant);
    setIsEditing(false);
  };

  // Helper function for image compression
  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 1,          // Compress images over 1MB
      maxWidthOrHeight: 1920, // Resize images larger than 1920px
      useWebWorker: true,
    };
    try {
      const compressedFile = await imageCompression(file, options);
      // Convert the compressed file back to a Base64 string to store
      return await imageCompression.getDataUrlFromFile(compressedFile);
    } catch (error) {
      console.error('Image compression error:', error);
      return null; // Handle error appropriately
    }
  };

  // Update image handlers to use compression
  const handleMainImageChange = async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const compressedDataUrl = await compressImage(file);
      if (compressedDataUrl) {
        setTempPlant({ ...tempPlant, mainImage: compressedDataUrl });
      }
    }
  };

  const handleAddImage = async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const compressedDataUrl = await compressImage(file);
      if (compressedDataUrl) {
        const newImages = [...tempPlant.images, compressedDataUrl];
        setTempPlant({ ...tempPlant, images: newImages });
      }
    }
  };

  const handleRemoveImage = (imageToRemove) => {
    const newImages = tempPlant.images.filter((img) => img !== imageToRemove);
    setTempPlant({ ...tempPlant, images: newImages });
  };

  if (!plant) {
    return <div className={styles.loading}>Loading plant details...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button onClick={() => router.push('/')} className={styles.backButton}>
          ← Back
        </button>
        {/* Title now uses tempPlant name to update live while editing */}
        <h1 className={styles.title}>{isEditing ? tempPlant.commonName : plant.commonName}</h1>
        {isEditing ? (
          <button onClick={handleSave} className={styles.editButton}>
            Save
          </button>
        ) : (
          <button onClick={handleEdit} className={styles.editButton}>
            Edit
          </button>
        )}
      </header>
      <div className={styles.details}>
        {/* --- MODIFIED MAIN IMAGE SECTION --- */}
        {isEditing ? (
          <label className={styles.mainImageContainer}>
            <img src={tempPlant.mainImage} alt={tempPlant.commonName} className={styles.mainImage} />
            <div className={styles.mainImageEditIcon}>
              <FiEdit size={24} strokeWidth={2.5} />
            </div>
            <input type="file" onChange={handleMainImageChange} className={styles.fileInput} accept="image/*" />
          </label>
        ) : (
          <div className={styles.mainImageContainer}>
            <img src={plant.mainImage} alt={plant.commonName} className={styles.mainImage} />
          </div>
        )}
        
        <div className={styles.infoSection}>
          <label className={styles.label}>Common Name:</label>
          {isEditing ? (
            <input
              type="text"
              value={tempPlant.commonName}
              onChange={(e) => setTempPlant({ ...tempPlant, commonName: e.target.value })}
              className={styles.input}
            />
          ) : (
            <p className={styles.text}>{plant.commonName}</p>
          )}
        </div>
        <div className={styles.infoSection}>
          <label className={styles.label}>Date Planted:</label>
          {isEditing ? (
            <input
              type="date"
              value={tempPlant.datePlanted}
              onChange={(e) => setTempPlant({ ...tempPlant, datePlanted: e.target.value })}
              className={styles.input}
            />
          ) : (
            <p className={styles.text}>{plant.datePlanted || 'Not set'}</p>
          )}
        </div>
        <div className={styles.infoSection}>
          <label className={styles.label}>Notes:</label>
          {isEditing ? (
            <textarea
              value={tempPlant.notes}
              onChange={(e) => setTempPlant({ ...tempPlant, notes: e.target.value })}
              className={styles.textarea}
            />
          ) : (
            <p className={styles.text}>{plant.notes || 'No notes'}</p>
          )}
        </div>

        <div className={styles.infoSection}>
          <h2 className={styles.sectionTitle}>Photos</h2>
          <div className={styles.imageGrid}>
            {tempPlant.images && tempPlant.images.length > 0 ? (
              tempPlant.images.map((img, index) => (
                <div key={index} className={styles.photoItem}>
                  <img src={img} alt={`Additional photo ${index + 1}`} className={styles.photo} />
                  {isEditing && (
                    <button onClick={() => handleRemoveImage(img)} className={styles.removeButton}>
                      &times;
                    </button>
                  )}
                </div>
              ))
            ) : (
              !isEditing && <p className={styles.noPhotos}>No additional photos yet.</p>
            )}
            {isEditing && (
              <label className={styles.addPhotoButton}>
                + Add Photo
                <input type="file" onChange={handleAddImage} className={styles.fileInput} accept="image/*" />
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}