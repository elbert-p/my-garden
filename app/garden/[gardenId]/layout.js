'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { FiPlus, FiEdit, FiTrash2, FiShare2, FiSliders, FiBookmark, FiCopy, FiClipboard, FiEye } from 'react-icons/fi';
import { GardenProvider, useGarden } from '@/context/GardenContext';
import { uploadImage, isDataUrl } from '@/lib/imageStorage';
import { getActiveFilterCount, getActiveSortCount } from '@/components/SortFilterControls';
import { getCopiedPlant, setCopyGardenSource } from '@/lib/clipboardStorage';
import { addLocalSavedGarden, removeLocalSavedGarden, isLocalGardenSaved } from '@/lib/clipboardStorage';
import {
  saveGarden as saveGardenDb, unsaveGarden as unsaveGardenDb,
  isGardenSaved as isGardenSavedDb,
} from '@/lib/dataService';
import NavBar from '@/components/NavBar';
import SortFilterControls from '@/components/SortFilterControls';
import ItemGrid from '@/components/ItemGrid';
import Modal, { ConfirmModal } from '@/components/Modal';
import FormInput, { ErrorMessage } from '@/components/FormInput';
import ImageUpload from '@/components/ImageUpload';
import Button from '@/components/Button';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import styles from './layout.module.css';

const DEFAULT_CUSTOMIZATION = { columns: 4, bgColor: '#f4f4f9' };

const SUGGESTED_COLORS = [
  '#f4f4f9', '#f0f7f0', '#f5f0eb', '#eef2f7',
  '#faf5f0', '#f0f0f0', '#fff8f0', '#f5f5dc',
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
    garden, plants, filteredPlants, isLoading, plantsLoaded, isInitialized, user,
    searchQuery, setSearchQuery, sort, setSort, filters, setFilters,
    updateGarden, deleteGarden, createPlant, handleShare,
    updateGardenCustomization,
    showAddPlantModal, setShowAddPlantModal,
    showEditGardenModal, setShowEditGardenModal,
    showDeleteGardenModal, setShowDeleteGardenModal,
    showShareModal, setShowShareModal,
    showSignInModal, setShowSignInModal,
    showCustomizeModal, setShowCustomizeModal,
    previewCustomization, setPreviewCustomization,
  } = useGarden();

  // Form states
  const [newPlantName, setNewPlantName] = useState('');
  const [newScientificName, setNewScientificName] = useState('');
  const [newPlantImage, setNewPlantImage] = useState(null);
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Customize form state
  const [customizeColumnsStr, setCustomizeColumnsStr] = useState('');
  const [customizeBgColor, setCustomizeBgColor] = useState(DEFAULT_CUSTOMIZATION.bgColor);

  // Privacy mode
  const [privacyMode, setPrivacyMode] = useState(false);
  const [hiddenPlantIdsDraft, setHiddenPlantIdsDraft] = useState(new Set());

  // Paste plant state
  const [hasCopiedPlant, setHasCopiedPlant] = useState(false);
  const [pasteData, setPasteData] = useState(null);

  // Save state
  const [isSaved, setIsSaved] = useState(false);

  // Page state
  const isAboutPage = pathname.endsWith('/about');
  const isTodoPage = pathname.endsWith('/todo');
  const isPlantPage = pathname.includes('/plant/');
  const isSubPage = isPlantPage || isAboutPage || isTodoPage;
  const contentWidth = isSubPage ? 'medium' : 'large';

  const customization = { ...DEFAULT_CUSTOMIZATION, ...garden?.customization };

  const previewColumns = (() => {
    const n = parseInt(customizeColumnsStr);
    return (!isNaN(n) && n >= 1 && n <= 6) ? n : null;
  })();

  useEffect(() => {
    if (showCustomizeModal) {
      setPreviewCustomization({
        columns: previewColumns ?? customization.columns,
        bgColor: customizeBgColor,
      });
    }
  }, [showCustomizeModal, previewColumns, customizeBgColor, setPreviewCustomization, customization.columns]);

  const appliedBgColor = previewCustomization?.bgColor ?? customization.bgColor;

  const isCustomDefault =
    clampColumns(customizeColumnsStr) === DEFAULT_CUSTOMIZATION.columns &&
    customizeBgColor === DEFAULT_CUSTOMIZATION.bgColor;

  // Check for copied plant periodically
  useEffect(() => {
    const check = () => setHasCopiedPlant(!!getCopiedPlant());
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  // Check saved status
  useEffect(() => {
    if (!garden) return;
    if (user?.id) {
      isGardenSavedDb(gardenId, user.id).then(setIsSaved);
    } else {
      setIsSaved(isLocalGardenSaved(gardenId));
    }
  }, [garden, gardenId, user?.id]);

  const handleToggleSave = async () => {
    if (isSaved) {
      if (user?.id) await unsaveGardenDb(gardenId, user.id);
      else removeLocalSavedGarden(gardenId);
      setIsSaved(false);
    } else {
      if (user?.id) await saveGardenDb(gardenId, user.id);
      else addLocalSavedGarden(gardenId);
      setIsSaved(true);
    }
  };

  const tabs = [
    { label: 'Plants', href: `/garden/${gardenId}`, active: !isAboutPage && !isTodoPage },
    { label: 'About', href: `/garden/${gardenId}/about`, active: isAboutPage },
    { label: 'To-Do', href: `/garden/${gardenId}/todo`, active: isTodoPage },
  ];

  const handlePastePlant = () => {
    const data = getCopiedPlant();
    if (data) {
      setPasteData(data);
      setNewPlantName(data.commonName || '');
      setNewScientificName(data.scientificName || '');
      setNewPlantImage(data.mainImage || null);
      setShowAddPlantModal(true);
    }
  };

  const handleCopyGarden = () => {
    if (!garden) return;
    setCopyGardenSource({
      gardenId: garden.id,
      name: garden.name,
      image: garden.image,
      isShared: false,
    });
    router.push('/');
  };

  const startPrivacyMode = () => {
    const currentHidden = garden?.customization?.hiddenPlantIds || [];
    setHiddenPlantIdsDraft(new Set(currentHidden));
    setPrivacyMode(true);
  };

  const cancelPrivacyMode = () => {
    setPrivacyMode(false);
    setHiddenPlantIdsDraft(new Set());
  };

  const savePrivacyMode = async () => {
    const hiddenArr = Array.from(hiddenPlantIdsDraft);
    const existing = garden?.customization || {};
    await updateGardenCustomization({ ...existing, hiddenPlantIds: hiddenArr });
    setPrivacyMode(false);
    setHiddenPlantIdsDraft(new Set());
  };

  const togglePlantVisibility = (plantId) => {
    setHiddenPlantIdsDraft(prev => {
      const next = new Set(prev);
      if (next.has(plantId)) next.delete(plantId);
      else next.add(plantId);
      return next;
    });
  };

  // Build selected IDs for privacy mode (selected = visible = NOT hidden)
  const privacySelectedIds = (() => {
    if (!privacyMode) return null;
    const selected = new Set();
    plants.forEach(p => {
      if (!hiddenPlantIdsDraft.has(p.id)) selected.add(p.id);
    });
    return selected;
  })();

  const menuItems = [
    { icon: <FiPlus size={16} />, label: 'Add Plant', onClick: () => setShowAddPlantModal(true), variant: 'success' },
    { icon: <FiEdit size={16} />, label: 'Edit Details', onClick: () => openEditModal() },
    { icon: <FiSliders size={16} />, label: 'Customize', onClick: () => openCustomizeModal() },
    { icon: <FiEye size={16} />, label: 'Edit Privacy', onClick: startPrivacyMode, visible: !isSubPage },
    { divider: true },
    { icon: <FiClipboard size={16} />, label: 'Paste Plant', onClick: handlePastePlant, variant: 'success', visible: hasCopiedPlant },
    { icon: <FiShare2 size={16} />, label: 'Share Garden', onClick: handleShare, variant: 'share' },
    { icon: <FiBookmark size={16} />, label: isSaved ? 'Unsave' : 'Save', onClick: handleToggleSave, variant: 'save' },
    { icon: <FiCopy size={16} />, label: 'Make a copy', onClick: handleCopyGarden },
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
    setPasteData(null);
  };

  const handleAddPlant = async () => {
    if (!newPlantName && !newScientificName) {
      setError('Please enter a name');
      return;
    }
    try {
      let imageUrl = newPlantImage;
      if (imageUrl && user?.id && isDataUrl(imageUrl)) {
        imageUrl = await uploadImage(imageUrl, user.id, 'plants');
      }

      // If pasting, include all the extra data
      const plantData = {
        commonName: newPlantName.trim(),
        mainImage: imageUrl,
        scientificName: newScientificName.trim(),
        datePlanted: pasteData?.datePlanted || '',
        bloomTime: pasteData?.bloomTime || [],
        height: pasteData?.height || '',
        sunlight: pasteData?.sunlight || [],
        moisture: pasteData?.moisture || [],
        nativeRange: pasteData?.nativeRange || [],
        notes: pasteData?.notes || '',
        images: pasteData?.images || [],
        hasAutofilled: pasteData?.hasAutofilled || false,
      };

      const newPlant = await createPlant(plantData);
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
      const existing = garden?.customization || {};
      await updateGardenCustomization({ ...existing, columns: clamped, bgColor: customizeBgColor });
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
        badge={plantsLoaded && !privacyMode ? (() => {
          const filterCount = getActiveFilterCount(filters);
          const hasFilters = filterCount > 0 || !!searchQuery;
          if (hasFilters) return `${filteredPlants.length} / ${plants.length}`;
          const sortCount = getActiveSortCount(plants, sort);
          if (sortCount !== null && sortCount < plants.length) return `${sortCount} / ${plants.length}`;
          return plants.length;
        })() : null}
        showHome={true}
        tabs={tabs}
        showSearch={!isSubPage && !privacyMode}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search plants..."
        extraActions={privacyMode ? (
          <div className={styles.privacyActions}>
            <Button variant="secondary" size="small" onClick={cancelPrivacyMode}>Cancel</Button>
            <Button size="small" onClick={savePrivacyMode}>Save</Button>
          </div>
        ) : !isSubPage ? (
          <SortFilterControls sort={sort} onSortChange={setSort} filters={filters} onFiltersChange={setFilters} />
        ) : null}
        menuItems={!privacyMode ? menuItems : undefined}
        contentWidth={contentWidth}
      />

      {!garden || (!plantsLoaded && !isSubPage) ? (
        <div className={styles.container}>
          <p className={styles.loading}>Loading garden...</p>
        </div>
      ) : (
        <div className={styles.gardenBackground} style={{ backgroundColor: appliedBgColor }}>
          {privacyMode ? (
            <div className={styles.privacyContent}>
              <div className={styles.privacyBanner}>
                Select which plants are visible when this garden is shared. Checked plants will be visible to viewers.
              </div>
              <ItemGrid
                items={plants}
                linkPrefix={`/garden/${gardenId}/plant`}
                getItemId={(p) => p.id}
                getItemImage={(p) => p.mainImage || '/placeholder-plant.jpg'}
                getItemName={(p) => p.commonName || p.scientificName}
                getItemStyle={(p) => ({ fontStyle: p.commonName ? 'normal' : 'italic' })}
                columns={garden?.customization?.columns}
                selectionMode={true}
                selectedIds={privacySelectedIds}
                onToggleSelection={togglePlantVisibility}
              />
            </div>
          ) : children}
        </div>
      )}

      {/* Add Plant Modal */}
      <Modal isOpen={showAddPlantModal} onClose={handleCloseAddModal} title={pasteData ? 'Paste Plant' : 'Add New Plant'} size="medium">
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
            <input type="number" min={1} max={6} step={1} value={customizeColumnsStr}
              onChange={e => setCustomizeColumnsStr(e.target.value)} onBlur={handleColumnsBlur}
              className={styles.columnsInput} />
            <span className={styles.columnsText}>columns</span>
          </div>
        </div>
        <div className={`${styles.customizeField} ${styles.customizeFieldSpaced}`}>
          <label className={styles.customizeLabel}>Background Color</label>
          <div className={styles.colorRow}>
            <label className={styles.colorSwatch} style={{ backgroundColor: customizeBgColor }}>
              <input type="color" value={customizeBgColor} onChange={e => setCustomizeBgColor(e.target.value)} className={styles.colorInputHidden} />
            </label>
            <div className={styles.colorInfo}>
              <span className={styles.colorHex}>{customizeBgColor}</span>
              <span className={styles.colorRgb}>rgb({hexToRgb(customizeBgColor)})</span>
            </div>
          </div>
          <div className={styles.suggestedColors}>
            {SUGGESTED_COLORS.map(color => (
              <button key={color} className={`${styles.colorOption} ${customizeBgColor.toLowerCase() === color.toLowerCase() ? styles.colorOptionActive : ''}`}
                style={{ backgroundColor: color }} onClick={() => setCustomizeBgColor(color)} title={color} type="button" />
            ))}
          </div>
        </div>
        <button onClick={resetCustomization} className={styles.resetButton} type="button" disabled={isCustomDefault}>Reset to Defaults</button>
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
      <ConfirmModal isOpen={showDeleteGardenModal} onClose={() => setShowDeleteGardenModal(false)}
        onConfirm={handleDeleteGarden} title="Delete Garden"
        message={<>Are you sure you want to delete <strong>{garden?.name}</strong> and all its plants? This cannot be undone.</>}
        confirmText="Delete" cancelText="Cancel" variant="danger" />

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