'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { FiPlus, FiEdit, FiTrash2, FiShare2, FiSliders } from 'react-icons/fi';
import { GardenProvider, useGarden } from '@/context/GardenContext';
import { uploadImage, isDataUrl } from '@/lib/imageStorage';
import { getActiveFilterCount, getActiveSortCount } from '@/components/SortFilterControls';
import NavBar from '@/components/NavBar';
import SortFilterControls from '@/components/SortFilterControls';
import Modal, { ConfirmModal } from '@/components/Modal';
import FormInput, { ErrorMessage } from '@/components/FormInput';
import ImageUpload from '@/components/ImageUpload';
import Button from '@/components/Button';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import styles from './layout.module.css';

const DEFAULT_CUSTOMIZATION = { columns: 4, bgColor: '#f4f4f9' };

const SUGGESTED_COLORS = [
  '#f4f4f9',
  '#f0f7f0',
  '#f5f0eb',
  '#eef2f7',
  '#faf5f0',
  '#f0f0f0',
  '#fff8f0',
  '#f5f5dc',
];

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
};

const clampColumns = (val) => Math.min(6, Math.max(1, parseInt(val) || DEFAULT_CUSTOMIZATION.columns));

function GardenLayoutContent({ children }) {
  const { gardenId } = useParams();
  const router = useRouter();
  const pathname = usePathname();

  const {
    garden,
    plants,
    filteredPlants,
    isLoading,
    plantsLoaded,
    isInitialized,
    user,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    filters,
    setFilters,
    updateGarden,
    deleteGarden,
    createPlant,
    handleShare,
    updateGardenCustomization,
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
    showCustomizeModal,
    setShowCustomizeModal,
    previewCustomization,
    setPreviewCustomization,
  } = useGarden();

  // Form states
  const [newPlantName, setNewPlantName] = useState('');
  const [newScientificName, setNewScientificName] = useState('');
  const [newPlantImage, setNewPlantImage] = useState(null);
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Customize form state — columns is a string so user can clear & retype
  const [customizeColumnsStr, setCustomizeColumnsStr] = useState('');
  const [customizeBgColor, setCustomizeBgColor] = useState(DEFAULT_CUSTOMIZATION.bgColor);

  // Page state
  const isAboutPage = pathname.endsWith('/about');
  const isTodoPage = pathname.endsWith('/todo');
  const isPlantPage = pathname.includes('/plant/');
  const isSubPage = isPlantPage || isAboutPage || isTodoPage;
  const contentWidth = isSubPage ? 'medium' : 'large';

  // Saved customization (with defaults)
  const customization = { ...DEFAULT_CUSTOMIZATION, ...garden?.customization };

  // Numeric value for preview: only update grid when input is a valid number
  const previewColumns = (() => {
    const n = parseInt(customizeColumnsStr);
    return (!isNaN(n) && n >= 1 && n <= 6) ? n : null;
  })();

  // Sync form state to previewCustomization in context while modal is open
  useEffect(() => {
    if (showCustomizeModal) {
      setPreviewCustomization({
        columns: previewColumns ?? customization.columns,
        bgColor: customizeBgColor,
      });
    }
  }, [showCustomizeModal, previewColumns, customizeBgColor, setPreviewCustomization, customization.columns]);

  // Applied values: preview when modal open, otherwise saved
  const appliedBgColor = previewCustomization?.bgColor ?? customization.bgColor;

  const isCustomDefault =
    clampColumns(customizeColumnsStr) === DEFAULT_CUSTOMIZATION.columns &&
    customizeBgColor === DEFAULT_CUSTOMIZATION.bgColor;

  const tabs = [
    { label: 'Plants', href: `/garden/${gardenId}`, active: !isAboutPage && !isTodoPage },
    { label: 'About', href: `/garden/${gardenId}/about`, active: isAboutPage },
    { label: 'To-Do', href: `/garden/${gardenId}/todo`, active: isTodoPage },
  ];

  const menuItems = [
    { icon: <FiPlus size={16} />, label: 'Add Plant', onClick: () => setShowAddPlantModal(true), variant: 'success' },
    { icon: <FiEdit size={16} />, label: 'Edit Details', onClick: () => openEditModal() },
    { icon: <FiSliders size={16} />, label: 'Customize', onClick: () => openCustomizeModal() },
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

  const openCustomizeModal = () => {
    setCustomizeColumnsStr(String(customization.columns));
    setCustomizeBgColor(customization.bgColor);
    setShowCustomizeModal(true);
  };

  const closeCustomizeModal = () => {
    setShowCustomizeModal(false);
    setPreviewCustomization(null);
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
      let imageUrl = newPlantImage;
      if (imageUrl && user?.id) {
        imageUrl = await uploadImage(imageUrl, user.id, 'plants');
      }
      const newPlant = await createPlant({
        commonName: newPlantName.trim(),
        mainImage: imageUrl,
        scientificName: newScientificName.trim(),
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
      let imageUrl = editImage;
      if (imageUrl && isDataUrl(imageUrl) && user?.id) {
        imageUrl = await uploadImage(imageUrl, user.id, 'gardens');
      }
      await updateGarden({ name: editName.trim(), image: imageUrl || garden.image });
      setShowEditGardenModal(false);
      setError('');
    } catch (e) {
      setError('An error occurred while updating.');
    }
  };

  const handleDeleteGarden = async () => { await deleteGarden(); };

  const handleSaveCustomization = async () => {
    const clamped = clampColumns(customizeColumnsStr);
    setCustomizeColumnsStr(String(clamped));
    try {
      await updateGardenCustomization({ columns: clamped, bgColor: customizeBgColor });
      setShowCustomizeModal(false);
      setPreviewCustomization(null);
    } catch (e) {
      console.error('Failed to save customization:', e);
    }
  };

  const handleColumnsBlur = () => {
    setCustomizeColumnsStr(String(clampColumns(customizeColumnsStr)));
  };

  const resetCustomization = () => {
    setCustomizeColumnsStr(String(DEFAULT_CUSTOMIZATION.columns));
    setCustomizeBgColor(DEFAULT_CUSTOMIZATION.bgColor);
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
        badge={plantsLoaded ? (() => {
          const filterCount = getActiveFilterCount(filters);
          const hasFilters = filterCount > 0 || !!searchQuery;
          if (hasFilters) return `${filteredPlants.length} / ${plants.length}`;
          const sortCount = getActiveSortCount(plants, sort);
          if (sortCount !== null && sortCount < plants.length) return `${sortCount} / ${plants.length}`;
          return plants.length;
        })() : null}
        showHome={true}
        tabs={tabs}
        showSearch={!isSubPage}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search plants..."
        extraActions={!isSubPage ? (
          <SortFilterControls sort={sort} onSortChange={setSort} filters={filters} onFiltersChange={setFilters} />
        ) : null}
        menuItems={menuItems}
        contentWidth={contentWidth}
      />

      {!garden || (!plantsLoaded && !isSubPage) ? (
        <div className={styles.container}>
          <p className={styles.loading}>Loading garden...</p>
        </div>
      ) : (
        <div className={styles.gardenBackground} style={{ backgroundColor: appliedBgColor }}>
          {children}
        </div>
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

      {/* Customize Garden Modal */}
      <Modal isOpen={showCustomizeModal} onClose={closeCustomizeModal} title="Customize Garden" size="medium">
        <div className={styles.customizeField}>
          <label className={styles.customizeLabel}>Number of Columns</label>
          <div className={styles.columnsRow}>
            <input
              type="number"
              min={1}
              max={6}
              step={1}
              value={customizeColumnsStr}
              onChange={e => setCustomizeColumnsStr(e.target.value)}
              onBlur={handleColumnsBlur}
              className={styles.columnsInput}
            />
            <span className={styles.columnsText}>columns</span>
          </div>
        </div>

        <div className={`${styles.customizeField} ${styles.customizeFieldSpaced}`}>
          <label className={styles.customizeLabel}>Background Color</label>
          <div className={styles.colorRow}>
            <label className={styles.colorSwatch} style={{ backgroundColor: customizeBgColor }}>
              <input
                type="color"
                value={customizeBgColor}
                onChange={e => setCustomizeBgColor(e.target.value)}
                className={styles.colorInputHidden}
              />
            </label>
            <div className={styles.colorInfo}>
              <span className={styles.colorHex}>{customizeBgColor}</span>
              <span className={styles.colorRgb}>rgb({hexToRgb(customizeBgColor)})</span>
            </div>
          </div>
          <div className={styles.suggestedColors}>
            {SUGGESTED_COLORS.map(color => (
              <button
                key={color}
                className={`${styles.colorOption} ${customizeBgColor.toLowerCase() === color.toLowerCase() ? styles.colorOptionActive : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setCustomizeBgColor(color)}
                title={color}
                type="button"
              />
            ))}
          </div>
        </div>

        <button
          onClick={resetCustomization}
          className={`${styles.resetButton} ${isCustomDefault ? styles.resetButtonDisabled : ''}`}
          type="button"
          disabled={isCustomDefault}
        >
          Reset to Defaults
        </button>
        <div className={styles.modalButtons}>
          <Button variant="secondary" onClick={closeCustomizeModal}>Cancel</Button>
          <Button onClick={handleSaveCustomization}>Save</Button>
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
      <GardenLayoutContent>{children}</GardenLayoutContent>
    </GardenProvider>
  );
}