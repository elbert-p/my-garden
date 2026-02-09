'use client';
import { useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { FiPlus, FiEdit, FiTrash2, FiShare2 } from 'react-icons/fi';
import { GardenProvider, useGarden } from '@/context/GardenContext';
import NavBar from '@/components/NavBar';
import Modal, { ConfirmModal } from '@/components/Modal';
import FormInput, { ErrorMessage } from '@/components/FormInput';
import ImageUpload from '@/components/ImageUpload';
import Button from '@/components/Button';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import styles from './layout.module.css';

function GardenLayoutContent({ children }) {
  const { gardenId } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const {
    garden,
    plants,
    isLoading,
    plantsLoaded,
    isInitialized,
    user,
    searchQuery,
    setSearchQuery,
    updateGarden,
    deleteGarden,
    createPlant,
    handleShare,
    showAddPlantModal,
    setShowAddPlantModal,
    showEditGardenModal,
    setShowEditGardenModal,
    showDeleteGardenModal,
    setShowDeleteGardenModal,
    showShareModal,
    setShowShareModal,
    showSignInModal,
    setShowSignInModal,
  } = useGarden();

  // Form states
  const [newPlantName, setNewPlantName] = useState('');
  const [newScientificName, setNewScientificName] = useState('');
  const [newPlantImage, setNewPlantImage] = useState(null);
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Determine active tab and content width
  const isAboutPage = pathname.endsWith('/about');
  const isPlantPage = pathname.includes('/plant/');
  
  // Plant pages use narrower content width
  const contentWidth = isPlantPage ? 'medium' : 'large';
  
  // Plants tab is active on both garden list and plant detail pages
  const tabs = [
    { label: 'Plants', href: `/garden/${gardenId}`, active: !isAboutPage },
    { label: 'About', href: `/garden/${gardenId}/about`, active: isAboutPage },
  ];

  // Menu items
  const menuItems = [
    { icon: <FiPlus size={16} />, label: 'Add Plant', onClick: () => setShowAddPlantModal(true), variant: 'success' },
    { icon: <FiEdit size={16} />, label: 'Edit Garden', onClick: () => openEditModal() },
    { icon: <FiShare2 size={16} />, label: 'Share Garden', onClick: handleShare },
    { divider: true },
    { icon: <FiTrash2 size={16} />, label: 'Delete Garden', onClick: () => setShowDeleteGardenModal(true), danger: true },
  ];

  const openEditModal = () => {
    if (garden) {
      setEditName(garden.name);
      setEditImage(garden.image);
      setShowEditGardenModal(true);
      setError('');
    }
  };

  const handleCloseAddModal = () => {
    setShowAddPlantModal(false);
    setNewPlantName('');
    setNewScientificName('');
    setNewPlantImage(null);
    setError('');
  };

  const handleAddPlant = async () => {
    if (!newPlantName && !newScientificName) {
      setError('Please enter a name');
      return;
    }
    try {
      const newPlant = await createPlant({
        commonName: newPlantName,
        mainImage: newPlantImage,
        scientificName: newScientificName,
        datePlanted: '',
        notes: '',
        images: [],
      });
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
      await updateGarden({
        name: editName.trim(),
        image: editImage || garden.image,
      });
      setShowEditGardenModal(false);
      setError('');
    } catch (e) {
      setError('An error occurred while updating.');
    }
  };

  const handleDeleteGarden = async () => {
    await deleteGarden();
  };

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${gardenId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <NavBar
        title={garden?.name || ''}
        badge={plantsLoaded ? plants.length : null}
        showHome={true}
        tabs={tabs}
        showSearch={!isPlantPage && !isAboutPage}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search plants..."
        menuItems={menuItems}
        contentWidth={contentWidth}
      />

      {!garden || (!plantsLoaded && !isPlantPage) ? (
        <div className={styles.container}>
          <p className={styles.loading}>Loading garden...</p>
        </div>
      ) : (
        children
      )}

      {/* Add Plant Modal */}
      <Modal isOpen={showAddPlantModal} onClose={handleCloseAddModal} title="Add New Plant" size="medium">
        <ErrorMessage message={error} />
        <FormInput value={newPlantName} onChange={setNewPlantName} placeholder="Common name" />
        <FormInput value={newScientificName} onChange={setNewScientificName} placeholder="Scientific name (for autofill)" />
        <ImageUpload image={newPlantImage} onImageChange={setNewPlantImage} onError={setError} placeholder="Select Main Image" size="large" />
        <div className={styles.modalButtons}>
          <Button variant="secondary" onClick={handleCloseAddModal}>Cancel</Button>
          <Button onClick={handleAddPlant}>Save</Button>
        </div>
      </Modal>

      {/* Edit Garden Modal */}
      <Modal isOpen={showEditGardenModal} onClose={() => { setShowEditGardenModal(false); setError(''); }} title="Edit Garden Details" size="medium">
        <ErrorMessage message={error} />
        <FormInput value={editName} onChange={setEditName} placeholder="Garden name" />
        <ImageUpload image={editImage} onImageChange={setEditImage} onError={setError} placeholder="Select Image" size="large" />
        <div className={styles.modalButtons}>
          <Button variant="secondary" onClick={() => { setShowEditGardenModal(false); setError(''); }}>Cancel</Button>
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

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDeleteGardenModal}
        onClose={() => setShowDeleteGardenModal(false)}
        onConfirm={handleDeleteGarden}
        title="Delete Garden"
        message={<>Are you sure you want to delete <strong>{garden?.name}</strong> and all its plants? This cannot be undone.</>}
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
    </>
  );
}

export default function GardenLayout({ children }) {
  return (
    <GardenProvider>
      <GardenLayoutContent>
        {children}
      </GardenLayoutContent>
    </GardenProvider>
  );
}