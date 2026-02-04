'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getGardens, createGarden } from '@/lib/dataService';
import PageHeader from '@/components/PageHeader';
import ItemGrid from '@/components/ItemGrid';
import Modal from '@/components/Modal';
import FormInput, { ErrorMessage } from '@/components/FormInput';
import ImageUpload from '@/components/ImageUpload';
import Button from '@/components/Button';
import UserMenu from '@/components/UserMenu';
import styles from './page.module.css';

const DEFAULT_GARDEN_IMAGE = '/default-garden.jpg';

export default function Home() {
  const { user, isInitialized, isMigrating } = useAuth();
  const [gardens, setGardens] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newGardenName, setNewGardenName] = useState('');
  const [newGardenImage, setNewGardenImage] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadGardens = async () => {
      // Don't load until initialized and migration is complete
      if (!isInitialized || isMigrating) return;
      
      try {
        const result = await getGardens(user?.id);
        
        // If a default garden was just created, redirect to it
        if (result.createdDefault) {
          router.push(`/garden/${result.gardens[0].id}`);
          return;
        }
        
        setGardens(result.gardens);
      } catch (e) {
        console.error('Failed to load gardens:', e);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadGardens();
  }, [user?.id, isInitialized, isMigrating, router]);

  const handleAddGarden = async () => {
    if (!newGardenName.trim()) {
      setError('Please enter a garden name.');
      return;
    }

    try {
      const newGarden = await createGarden({
        name: newGardenName.trim(),
        image: newGardenImage || DEFAULT_GARDEN_IMAGE,
      }, user?.id);

      setGardens([...gardens, newGarden]);
      handleCloseModal();
      router.push(`/garden/${newGarden.id}`);
    } catch (e) {
      setError('An error occurred while saving the garden.');
      console.error('Save error:', e);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setNewGardenName('');
    setNewGardenImage(null);
    setError('');
  };

  const showLoading = !isInitialized || isMigrating || isLoading;

  return (
    <div className={styles.container}>
      <PageHeader
        title="My Gardens"
        titleAlign="left"
        actions={
          <div className={styles.headerActions}>
            <UserMenu />
            <Button size="small" onClick={() => setShowModal(true)}>+ New Garden</Button>
          </div>
        }
      />

      {showLoading ? (
        <p className={styles.loading}>
          {isMigrating ? 'Migrating your gardens...' : 'Loading...'}
        </p>
      ) : (
        <ItemGrid
          items={gardens}
          emptyMessage='No gardens yet. Click "+ New Garden" to get started!'
          linkPrefix="/garden"
          getItemId={(g) => g.id}
          getItemImage={(g) => g.image || DEFAULT_GARDEN_IMAGE}
          getItemName={(g) => g.name}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title="Add New Garden"
        size="medium"
      >
        <ErrorMessage message={error} />
        <FormInput
          value={newGardenName}
          onChange={setNewGardenName}
          placeholder="Garden name"
        />
        <ImageUpload
          image={newGardenImage}
          onImageChange={setNewGardenImage}
          onError={setError}
          placeholder="Select Image"
          size="large"
        />
        <div className={styles.modalButtons}>
          <Button variant="secondary" onClick={handleCloseModal}>
            Cancel
          </Button>
          <Button onClick={handleAddGarden}>
            Save
          </Button>
        </div>
      </Modal>
    </div>
  );
}