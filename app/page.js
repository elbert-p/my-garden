'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { getGardens, createGarden, getPlants } from '@/lib/dataService';
import NavBar from '@/components/NavBar';
import ItemGrid from '@/components/ItemGrid';
import Modal from '@/components/Modal';
import FormInput, { ErrorMessage } from '@/components/FormInput';
import ImageUpload from '@/components/ImageUpload';
import Button from '@/components/Button';
import styles from './page.module.css';

const DEFAULT_GARDEN_IMAGE = '/default-garden.jpg';

export default function Home() {
  const { user, isInitialized, isMigrating } = useAuth();
  const [gardens, setGardens] = useState([]);
  const [plantCounts, setPlantCounts] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [newGardenName, setNewGardenName] = useState('');
  const [newGardenImage, setNewGardenImage] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const loadGardens = async () => {
      if (!isInitialized || isMigrating) return;
      
      try {
        const result = await getGardens(user?.id);
        
        if (result.createdDefault) {
          router.push(`/garden/${result.gardens[0].id}`);
          return;
        }
        
        setGardens(result.gardens);
        setIsLoading(false);

        // Load plant counts in background
        const counts = {};
        for (const garden of result.gardens) {
          try {
            const plants = await getPlants(garden.id, user?.id);
            counts[garden.id] = plants.length;
          } catch {
            // Skip on error
          }
        }
        setPlantCounts(counts);
      } catch (e) {
        console.error('Failed to load gardens:', e);
        setIsLoading(false);
      }
    };
    
    loadGardens();
  }, [user?.id, isInitialized, isMigrating, router]);

  // Filter gardens based on search query
  const filteredGardens = useMemo(() => {
    if (!searchQuery.trim()) return gardens;
    const query = searchQuery.toLowerCase();
    return gardens.filter(garden => 
      garden.name.toLowerCase().includes(query)
    );
  }, [gardens, searchQuery]);

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

  const tabs = [
    { label: 'Gardens', href: '/', active: true },
    { label: 'About', href: '/about', active: false },
  ];

  const menuItems = [
    { icon: <FiPlus size={16} />, label: 'New Garden', onClick: () => setShowModal(true), variant: 'success' },
  ];

  return (
    <>
      <NavBar
        title="My Gardens"
        showHome={true}
        tabs={tabs}
        showSearch={true}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search gardens..."
        menuItems={menuItems}
      />
      
      <div className={styles.container}>
        {showLoading ? (
          <p className={styles.loading}>
            {isMigrating ? 'Migrating your gardens...' : 'Loading...'}
          </p>
        ) : (
          <ItemGrid
            items={filteredGardens}
            emptyMessage={searchQuery ? 'No gardens match your search.' : 'No gardens yet. Click the menu to add one!'}
            linkPrefix="/garden"
            getItemId={(g) => g.id}
            getItemImage={(g) => g.image || DEFAULT_GARDEN_IMAGE}
            getItemName={(g) => g.name}
            getItemBadge={(g) => plantCounts[g.id] != null ? plantCounts[g.id] : null}
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
    </>
  );
}