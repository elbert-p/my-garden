'use client'
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { FiEdit } from 'react-icons/fi';
import localforage from 'localforage'; // 1. Import localforage
import imageCompression from 'browser-image-compression'; // 2. Import compression library
import styles from './page.module.css';

export default function Home() {
  const [plants, setPlants] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantImage, setNewPlantImage] = useState(null);
  const [error, setError] = useState('');

  // 3. Update useEffect to be async and use localforage
  useEffect(() => {
    const loadPlants = async () => {
      if (typeof window !== 'undefined') {
        const storedPlants = await localforage.getItem('plants');
        if (storedPlants) {
          setPlants(storedPlants);
        }
      }
    };
    loadPlants().catch(e => console.error("Failed to load plants:", e));
  }, []);
  
  // 4. Create the image compression helper function
  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };
    try {
      console.log('Compressing image...');
      const compressedFile = await imageCompression(file, options);
      const dataUrl = await imageCompression.getDataUrlFromFile(compressedFile);
      console.log('Compression successful!');
      return dataUrl;
    } catch (error) {
      console.error("Image compression error:", error);
      setError('Could not process the image. Please try a different one.');
      return null;
    }
  };

  // 5. Update handleAddPlant to be async and use localforage/compression
  const handleAddPlant = async () => {
    if (!newPlantName || !newPlantImage) {
      setError('Please enter a name and select a valid image.');
      return;
    }

    const newPlant = {
      id: uuidv4(),
      commonName: newPlantName,
      mainImage: newPlantImage,
      datePlanted: '',
      notes: '',
      images: [],
    };

    try {
      const updatedPlants = [...plants, newPlant];
      await localforage.setItem('plants', updatedPlants); // Use localforage
      setPlants(updatedPlants);
      handleCancel(); // Use handleCancel to reset the form
    } catch (e) {
      setError('An error occurred while saving the plant.');
      console.error("Save error:", e);
    }
  };
  
  const handleCancel = () => {
    setShowModal(false);
    setNewPlantName('');
    setNewPlantImage(null);
    setError('');
  };

  // 6. Update handleImageChange to be async and use compression
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const compressedDataUrl = await compressImage(file);
      if (compressedDataUrl) {
        setNewPlantImage(compressedDataUrl);
        setError('');
      }
    } else if (file) {
      setNewPlantImage(null);
      setError('Please select a valid image file (e.g., .jpg, .png).');
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>My Garden</h1>
        <button onClick={() => { setShowModal(true); setError(''); }} className={styles.addButton}>
          + Add Plant
        </button>
      </header>

      <div className={styles.grid}>
        {plants.length > 0 ? (
          plants.map((plant) => (
            <Link key={plant.id} href={`/plants/${plant.id}`} className={styles.plantItem}>
              <div className={styles.imageContainer}>
                <img src={plant.mainImage} alt={plant.commonName} className={styles.image} />
              </div>
              <span className={styles.name}>{plant.commonName}</span>
            </Link>
          ))
        ) : (
          <p className={styles.noPlants}>No plants in your garden yet. Click &quot;Add Plant&quot; to get started!</p>
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Add New Plant</h2>
            {error && <p className={styles.errorText}>{error}</p>}
            <input
              type="text"
              placeholder="Common Name"
              value={newPlantName}
              onChange={(e) => setNewPlantName(e.target.value)}
              className={styles.input}
            />
            
            {!newPlantImage ? (
              <label className={`${styles.imageUploadArea} ${styles.imageInputLabel}`}>
                Select Main Image
                <input type="file" onChange={handleImageChange} className={styles.fileInput} accept="image/*" />
              </label>
            ) : (
              <label className={`${styles.imageUploadArea} ${styles.imagePreviewContainer}`}>
                <img src={newPlantImage} alt="Preview" className={styles.imagePreview} />
                <div className={styles.editIcon}>
                  <FiEdit size={18} strokeWidth={2.5} />
                </div>
                <input type="file" onChange={handleImageChange} className={styles.fileInput} accept="image/*" />
              </label>
            )}
            
            <div className={styles.modalButtons}>
              <button onClick={handleCancel} className={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={handleAddPlant} className={styles.saveButton}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}