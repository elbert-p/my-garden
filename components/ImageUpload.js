'use client';
import { useRef } from 'react';
import { FiEdit } from 'react-icons/fi';
import imageCompression from 'browser-image-compression';
import styles from './ImageUpload.module.css';

/**
 * Reusable Image Upload Component
 * @param {string} image - Current image data URL
 * @param {function} onImageChange - Callback when image changes
 * @param {function} onError - Callback for errors
 * @param {string} placeholder - Placeholder text
 * @param {string} size - 'small' | 'medium' | 'large'
 */
export default function ImageUpload({ 
  image, 
  onImageChange, 
  onError,
  placeholder = 'Select Image',
  size = 'large'
}) {
  const inputRef = useRef(null);

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
      if (onError) onError('Could not process the image. Please try a different one.');
      return null;
    }
  };

  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const compressedDataUrl = await compressImage(file);
      if (compressedDataUrl) {
        onImageChange(compressedDataUrl);
      }
    } else if (file) {
      if (onError) onError('Select a valid image file (.jpg, .png).');
    }
    // Reset input
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <label className={`${styles.container} ${styles[size]} ${image ? styles.hasImage : ''}`}>
      {image ? (
        <>
          <img src={image} alt="Preview" className={styles.preview} />
          <div className={styles.editIcon}>
            <FiEdit size={18} strokeWidth={2.5} />
          </div>
        </>
      ) : (
        <span className={styles.placeholder}>{placeholder}</span>
      )}
      <input 
        ref={inputRef}
        type="file" 
        onChange={handleChange} 
        className={styles.input} 
        accept="image/*" 
      />
    </label>
  );
}