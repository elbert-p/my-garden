'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FiPlus, FiEdit, FiTrash2, FiShare2 } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { getGarden, updateGarden, deleteGarden, getPlants, createPlant } from '@/lib/dataService';
import PageHeader from '@/components/PageHeader';
import ItemGrid from '@/components/ItemGrid';
import DropdownMenu from '@/components/DropdownMenu';
import Modal, { ConfirmModal } from '@/components/Modal';
import FormInput, { ErrorMessage } from '@/components/FormInput';
import ImageUpload from '@/components/ImageUpload';
import Button from '@/components/Button';
import UserMenu from '@/components/UserMenu';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import styles from './page.module.css';

export default function GardenPage() {
  const router = useRouter();
  const { gardenId } = useParams();
  const { user, isInitialized } = useAuth();

  const [garden, setGarden] = useState(null);
  const [plants, setPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPlantName, setNewPlantName] = useState('');
  const [newScientificName, setNewScientificName] = useState('');
  const [newPlantImage, setNewPlantImage] = useState(null);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState(null);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!isInitialized || !gardenId) return;
      try {
        const gardenData = await getGarden(gardenId, user?.id);
        if (gardenData) {
          setGarden(gardenData);
          const plantsData = await getPlants(gardenId, user?.id);
          setPlants(plantsData);
        } else {
          router.push('/');
        }
      } catch (e) {
        console.error('Failed to load garden:', e);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [gardenId, user?.id, isInitialized, router]);

  const handleAddPlant = async () => {
    if (!newPlantName && !newScientificName) { //|| !newPlantImage
      setError('Please enter a name');
      return;
    }
    try {
      const newPlant = await createPlant({
        gardenId, commonName: newPlantName, mainImage: newPlantImage,
        scientificName: newScientificName, datePlanted: '', notes: '', images: [],
      }, user?.id);
      setPlants([...plants, newPlant]);
      handleCloseAddModal();
      router.push(`/garden/${gardenId}/plant/${newPlant.id}`);
    } catch (e) {
      setError('An error occurred while saving the plant.');
    }
  };

  const handleEditGarden = async () => {
    if (!editName.trim()) {
      setError('Please enter a garden name.');
      return;
    }
    try {
      const updated = await updateGarden(gardenId, { 
        name: editName.trim(), 
        image: editImage || garden.image 
      }, user?.id);
      setGarden(updated);
      setShowEditModal(false);
      setError('');
    } catch (e) {
      setError('An error occurred while updating.');
    }
  };

  const handleDeleteGarden = async () => {
    await deleteGarden(gardenId, user?.id);
    router.push('/');
  };

  const handleShare = () => {
    if (!user) {
      setShowSignInModal(true);
      return;
    }
    setShowShareModal(true);
    setCopied(false);
  };

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${gardenId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setNewPlantName('');
    setNewScientificName('');
    setNewPlantImage(null);
    setError('');
  };

  const openEditModal = () => {
    setEditName(garden.name);
    setEditImage(garden.image);
    setShowEditModal(true);
    setError('');
  };

  const menuItems = [
    { icon: <FiPlus size={16} />, label: 'Add Plant', onClick: () => setShowAddModal(true), variant: 'success' },
    { icon: <FiEdit size={16} />, label: 'Edit Garden Details', onClick: openEditModal },
    { icon: <FiShare2 size={16} />, label: 'Share Garden', onClick: handleShare },
    { icon: <FiTrash2 size={16} />, label: 'Delete Garden', onClick: () => setShowDeleteModal(true), danger: true },
  ];

  if (!isInitialized || isLoading) return <div className={styles.container}><p className={styles.loading}>Loading garden...</p></div>;
  if (!garden) return null;

  return (
    <div className={styles.container}>
      <PageHeader
        title={garden.name}
        showHomeLink={true}
        titleAlign="left"
        actions={<div className={styles.headerActions}><UserMenu /><DropdownMenu items={menuItems} /></div>}
      />

      <ItemGrid
        items={plants}
        emptyMessage='No plants in this garden yet. Click the three dots menu to add one!'
        linkPrefix={`/garden/${gardenId}/plant`}
        getItemId={(p) => p.id}
        getItemImage={(p) => p.mainImage || '/placeholder-plant.jpg'}
        getItemName={(p) => p.commonName || p.scientificName}
        getItemStyle={(p) => ({ fontStyle: p.commonName ? 'normal' : 'italic' })}
      />

      {/* Add Plant Modal */}
      <Modal isOpen={showAddModal} onClose={handleCloseAddModal} title="Add New Plant" size="medium">
        <ErrorMessage message={error} />
        <FormInput value={newPlantName} onChange={setNewPlantName} placeholder="Common name" />
        <FormInput value={newScientificName} onChange={setNewScientificName} placeholder="Scientific name (for autofill)" />
        <ImageUpload image={newPlantImage} onImageChange={setNewPlantImage} onError={setError} placeholder="Select Main Image" size="large" />
        <div className={styles.modalButtons}>
          <Button variant="secondary" onClick={handleCloseAddModal}>Cancel</Button>
          <Button onClick={handleAddPlant}>Save</Button>
        </div>
      </Modal>

      {/* Edit Garden Details Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setError(''); }} title="Edit Garden Details" size="medium">
        <ErrorMessage message={error} />
        <FormInput value={editName} onChange={setEditName} placeholder="Garden name" />
        <ImageUpload image={editImage} onImageChange={setEditImage} onError={setError} placeholder="Select Image" size="large" />
        <div className={styles.modalButtons}>
          <Button variant="secondary" onClick={() => { setShowEditModal(false); setError(''); }}>Cancel</Button>
          <Button onClick={handleEditGarden}>Save</Button>
        </div>
      </Modal>

      {/* Share Modal */}
      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Garden" size="small">
        <p className={styles.shareText}>Anyone with this link can view your garden:</p>
        <div className={styles.shareLink}>
          <code>{`${typeof window !== 'undefined' ? window.location.origin : ''}/share/${gardenId}`}</code>
        </div>
        <div className={styles.modalButtons}>
          <Button variant="secondary" onClick={() => setShowShareModal(false)}>Close</Button>
          <Button onClick={copyShareLink}>{copied ? 'Copied!' : 'Copy Link'}</Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteGarden}
        title="Delete Garden"
        message={<>Are you sure you want to delete <strong>{garden.name}</strong> and all its plants? This cannot be undone.</>}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Sign In Modal */}
      <Modal isOpen={showSignInModal} onClose={() => setShowSignInModal(false)} title="Sign in to Share" size="small">
        <p className={styles.shareText}>Sign in with Google to share your garden with others.</p>
        <div className={styles.signInButtons}>
          <Button variant="secondary" onClick={() => setShowSignInModal(false)}>No thanks</Button>
          <GoogleSignInButton />
        </div>
      </Modal>
    </div>
  );
}