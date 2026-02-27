'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiShare2, FiEye, FiMenu } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import {
  getGardens, createGarden, getPlants, getSavedGardens,
  getRecentlyViewedGardens, getProfileVisibility, updateProfileVisibility,
  copyGardenWithPlants,
} from '@/lib/dataService';
import { uploadImage } from '@/lib/imageStorage';
import {
  getLocalSavedGardens, getLocalRecentlyViewed,
  getCopyGardenSource, clearCopyGardenSource,
} from '@/lib/clipboardStorage';
import { getSharedGardenInfo, getSharedGardenPlants } from '@/lib/dataService';
import NavBar from '@/components/NavBar';
import ItemGrid, { ItemGridSection } from '@/components/ItemGrid';
import Modal from '@/components/Modal';
import FormInput, { ErrorMessage } from '@/components/FormInput';
import ImageUpload from '@/components/ImageUpload';
import Button from '@/components/Button';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import styles from './page.module.css';

const DEFAULT_GARDEN_IMAGE = '/default-garden.jpg';

export default function Home() {
  const { user, isInitialized, isMigrating, isAuthenticated } = useAuth();
  const router = useRouter();

  // Data
  const [gardens, setGardens] = useState([]);
  const [savedGardens, setSavedGardens] = useState([]);
  const [recentGardens, setRecentGardens] = useState([]);
  const [plantCounts, setPlantCounts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Visibility / privacy
  const [profileVisibility, setProfileVisibility] = useState({
    hiddenCreatedIds: [], visibleSavedIds: [], visibleRecentIds: [],
  });
  const [privacyMode, setPrivacyMode] = useState(false);
  const [privacyDraft, setPrivacyDraft] = useState(null);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [newGardenName, setNewGardenName] = useState('');
  const [newGardenImage, setNewGardenImage] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Copy-garden state (for "Make a Copy" flow)
  const [copySource, setCopySource] = useState(null);
  const [isCopying, setIsCopying] = useState(false);

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      if (!isInitialized || isMigrating) return;

      try {
        // Load created gardens
        const result = await getGardens(user?.id);
        setGardens(result);

        // If user was redirected to create a default, don't auto-redirect anymore
        // Just show the empty state

        // Load saved gardens
        let loadedSaved = [];
        if (user?.id) {
          loadedSaved = await getSavedGardens(user.id);
          setSavedGardens(loadedSaved);
        } else {
          // For non-logged-in, load from localStorage and fetch garden info
          const localSavedIds = getLocalSavedGardens();
          for (const id of localSavedIds) {
            try {
              const info = await getSharedGardenInfo(id);
              if (info?.garden) loadedSaved.push(info.garden);
            } catch { /* skip */ }
          }
          setSavedGardens(loadedSaved);
        }

        // Load recently viewed
        let loadedRecent = [];
        if (user?.id) {
          loadedRecent = await getRecentlyViewedGardens(user.id);
          setRecentGardens(loadedRecent);
        } else {
          const localRecent = getLocalRecentlyViewed();
          for (const entry of localRecent.slice(0, 10)) {
            try {
              const info = await getSharedGardenInfo(entry.id);
              if (info?.garden) loadedRecent.push(info.garden);
            } catch { /* skip */ }
          }
          setRecentGardens(loadedRecent);
        }

        // Load visibility settings
        if (user?.id) {
          const vis = await getProfileVisibility(user.id);
          setProfileVisibility(vis);
        }

        setIsLoading(false);

        // Load plant counts in background for all sections
        const counts = {};
        for (const garden of result) {
          try {
            const plants = await getPlants(garden.id, user?.id);
            counts[garden.id] = plants.length;
          } catch { /* skip */ }
        }
        setPlantCounts({ ...counts });

        // Load counts for saved & recently viewed gardens (shared endpoint)
        const sharedIds = new Set();
        [...loadedSaved, ...loadedRecent].forEach(g => {
          if (!counts[g.id]) sharedIds.add(g.id);
        });
        const sharedCounts = {};
        for (const id of sharedIds) {
          try {
            const plants = await getSharedGardenPlants(id);
            sharedCounts[id] = plants.length;
          } catch { /* skip */ }
        }
        if (Object.keys(sharedCounts).length > 0) {
          setPlantCounts(prev => ({ ...prev, ...sharedCounts }));
        }
      } catch (e) {
        console.error('Failed to load:', e);
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.id, isInitialized, isMigrating]);

  // Check for copy-garden source on mount
  useEffect(() => {
    if (!isInitialized || isLoading) return;
    const source = getCopyGardenSource();
    if (source) {
      setCopySource(source);
      setNewGardenName(`Copy of ${source.name}`);
      setNewGardenImage(source.image);
      setShowModal(true);
    }
  }, [isInitialized, isLoading]);

  // Filter gardens across all sections
  const filterBySearch = useCallback((list) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(g => g.name.toLowerCase().includes(q));
  }, [searchQuery]);

  const filteredCreated = useMemo(() => filterBySearch(gardens), [gardens, filterBySearch]);
  const filteredSaved = useMemo(() => filterBySearch(savedGardens), [savedGardens, filterBySearch]);
  const filteredRecent = useMemo(() => filterBySearch(recentGardens), [recentGardens, filterBySearch]);

  // Privacy mode helpers
  const startPrivacyMode = () => {
    setPrivacyDraft({ ...profileVisibility });
    setPrivacyMode(true);
  };

  const cancelPrivacyMode = () => {
    setPrivacyDraft(null);
    setPrivacyMode(false);
  };

  const savePrivacyMode = async () => {
    if (user?.id && privacyDraft) {
      await updateProfileVisibility(user.id, privacyDraft);
      setProfileVisibility(privacyDraft);
    }
    setPrivacyDraft(null);
    setPrivacyMode(false);
  };

  // Build per-section selected IDs for privacy mode
  // Each section is independent so the same garden can be checked in Created but unchecked in Saved
  const createdSelectedIds = useMemo(() => {
    if (!privacyMode || !privacyDraft) return new Set();
    const selected = new Set();
    gardens.forEach(g => {
      if (!privacyDraft.hiddenCreatedIds.includes(g.id)) selected.add(g.id);
    });
    return selected;
  }, [privacyMode, privacyDraft, gardens]);

  const savedSelectedIds = useMemo(() => {
    if (!privacyMode || !privacyDraft) return new Set();
    const selected = new Set();
    savedGardens.forEach(g => {
      if (privacyDraft.visibleSavedIds.includes(g.id)) selected.add(g.id);
    });
    return selected;
  }, [privacyMode, privacyDraft, savedGardens]);

  const recentSelectedIds = useMemo(() => {
    if (!privacyMode || !privacyDraft) return new Set();
    const selected = new Set();
    recentGardens.forEach(g => {
      if (privacyDraft.visibleRecentIds.includes(g.id)) selected.add(g.id);
    });
    return selected;
  }, [privacyMode, privacyDraft, recentGardens]);

  const togglePrivacySelection = (gardenId, section) => {
    if (!privacyDraft) return;
    setPrivacyDraft(prev => {
      const draft = { ...prev };
      if (section === 'created') {
        draft.hiddenCreatedIds = draft.hiddenCreatedIds.includes(gardenId)
          ? draft.hiddenCreatedIds.filter(id => id !== gardenId)
          : [...draft.hiddenCreatedIds, gardenId];
      } else if (section === 'saved') {
        draft.visibleSavedIds = draft.visibleSavedIds.includes(gardenId)
          ? draft.visibleSavedIds.filter(id => id !== gardenId)
          : [...draft.visibleSavedIds, gardenId];
      } else if (section === 'recent') {
        draft.visibleRecentIds = draft.visibleRecentIds.includes(gardenId)
          ? draft.visibleRecentIds.filter(id => id !== gardenId)
          : [...draft.visibleRecentIds, gardenId];
      }
      return draft;
    });
  };

  // Modal handlers
  const handleCloseModal = () => {
    setShowModal(false);
    setNewGardenName('');
    setNewGardenImage(null);
    setError('');
    if (copySource) {
      clearCopyGardenSource();
      setCopySource(null);
    }
  };

  const handleAddGarden = async () => {
    if (!newGardenName.trim()) {
      setError('Please enter a garden name.');
      return;
    }

    try {
      // If this is a copy operation
      if (copySource) {
        setIsCopying(true);
        let imageUrl = newGardenImage;
        if (imageUrl && user?.id && imageUrl.startsWith('data:')) {
          imageUrl = await uploadImage(imageUrl, user.id, 'gardens');
        }
        const newGarden = await copyGardenWithPlants(
          copySource.gardenId,
          newGardenName.trim(),
          imageUrl || copySource.image,
          user?.id,
          copySource.isShared
        );
        setGardens(prev => [...prev, newGarden]);
        handleCloseModal();
        setIsCopying(false);
        router.push(`/garden/${newGarden.id}`);
        return;
      }

      // Normal create
      let imageUrl = newGardenImage;
      if (imageUrl && user?.id) {
        imageUrl = await uploadImage(imageUrl, user.id, 'gardens');
      }
      const newGarden = await createGarden({
        name: newGardenName.trim(),
        image: imageUrl || DEFAULT_GARDEN_IMAGE,
      }, user?.id);
      setGardens(prev => [...prev, newGarden]);
      handleCloseModal();
      router.push(`/garden/${newGarden.id}`);
    } catch (e) {
      setError('An error occurred while saving the garden.');
      setIsCopying(false);
      console.error('Save error:', e);
    }
  };

  const handleShare = () => {
    if (!isAuthenticated) {
      setShowSignInModal(true);
      return;
    }
    setShowShareModal(true);
    setCopied(false);
  };

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/share/user/${user.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showLoading = !isInitialized || isMigrating || isLoading;

  const tabs = [
    { label: 'Gardens', href: '/', active: true },
    { label: 'About', href: '/about', active: false },
  ];

  const menuItems = [
    { icon: <FiPlus size={16} />, label: 'New Garden', onClick: () => setShowModal(true), variant: 'success' },
    { divider: true },
    { icon: <FiEye size={16} />, label: 'Edit Privacy', onClick: startPrivacyMode, visible: isAuthenticated },
    { icon: <FiShare2 size={16} />, label: 'Share Profile', onClick: handleShare, variant: 'share' },
  ];

  return (
    <>
      <NavBar
        title="My Gardens"
        showHome={true}
        tabs={tabs}
        showSearch={!privacyMode}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search gardens..."
        menuItems={!privacyMode ? menuItems : undefined}
        extraActions={privacyMode ? (
          <div className={styles.privacyActions}>
            <Button variant="secondary" size="small" onClick={cancelPrivacyMode}>Cancel</Button>
            <Button size="small" onClick={savePrivacyMode}>Save</Button>
          </div>
        ) : undefined}
      />

      <div className={styles.container}>
        {privacyMode && (
          <div className={styles.privacyBanner}>
            Select which gardens are visible on your shared profile. Checked gardens will be shown to others.
          </div>
        )}

        {showLoading ? (
          <p className={styles.loading}>
            {isMigrating ? 'Migrating your gardens...' : 'Loading...'}
          </p>
        ) : (
          <div className={styles.sections}>
            {/* Created Gardens */}
            <ItemGridSection title="Created">
              {filteredCreated.length > 0 ? (
                <ItemGrid
                  items={filteredCreated}
                  linkPrefix="/garden"
                  getItemId={(g) => g.id}
                  getItemImage={(g) => g.image || DEFAULT_GARDEN_IMAGE}
                  getItemName={(g) => g.name}
                  getItemBadge={!privacyMode ? (g) => plantCounts[g.id] != null ? plantCounts[g.id] : null : undefined}
                  selectionMode={privacyMode}
                  selectedIds={createdSelectedIds}
                  onToggleSelection={(id) => togglePrivacySelection(id, 'created')}
                />
              ) : (
                <p className={styles.sectionEmpty}>
                  {searchQuery
                    ? 'No gardens match your search.'
                    : <>No gardens yet. Click the menu <FiMenu size={16} style={{ verticalAlign: 'text-bottom', display: 'inline-block', margin: '0 2px' }} /> to create one!</>
                  }
                </p>
              )}
            </ItemGridSection>

            {/* Saved Gardens */}
            <ItemGridSection title="Saved">
              {filteredSaved.length > 0 ? (
                <ItemGrid
                  items={filteredSaved}
                  linkPrefix="/share"
                  getItemId={(g) => g.id}
                  getItemImage={(g) => g.image || DEFAULT_GARDEN_IMAGE}
                  getItemName={(g) => g.name}
                  getItemBadge={!privacyMode ? (g) => plantCounts[g.id] != null ? plantCounts[g.id] : null : undefined}
                  selectionMode={privacyMode}
                  selectedIds={savedSelectedIds}
                  onToggleSelection={(id) => togglePrivacySelection(id, 'saved')}
                />
              ) : (
                <p className={styles.sectionEmpty}>
                  {searchQuery ? 'No saved gardens match your search.' : 'No saved gardens.'}
                </p>
              )}
            </ItemGridSection>

            {/* Recently Viewed */}
            <ItemGridSection title="Recently Viewed">
              {filteredRecent.length > 0 ? (
                <ItemGrid
                  items={filteredRecent}
                  linkPrefix="/share"
                  getItemId={(g) => g.id}
                  getItemImage={(g) => g.image || DEFAULT_GARDEN_IMAGE}
                  getItemName={(g) => g.name}
                  getItemBadge={!privacyMode ? (g) => plantCounts[g.id] != null ? plantCounts[g.id] : null : undefined}
                  selectionMode={privacyMode}
                  selectedIds={recentSelectedIds}
                  onToggleSelection={(id) => togglePrivacySelection(id, 'recent')}
                />
              ) : (
                <p className={styles.sectionEmpty}>
                  {searchQuery ? 'No recently viewed gardens match your search.' : 'No recently viewed gardens.'}
                </p>
              )}
            </ItemGridSection>
          </div>
        )}
      </div>

      {/* Add / Copy Garden Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={copySource ? 'Copy Garden' : 'Add New Garden'}
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
          <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
          <Button onClick={handleAddGarden} disabled={isCopying}>
            {isCopying ? 'Copying...' : 'Save'}
          </Button>
        </div>
      </Modal>

      {/* Share Modal */}
      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Profile" size="small">
        <p className={styles.shareText}>Anyone with this link can view your shared gardens:</p>
        <div className={styles.shareLink}>
          <code>{`${typeof window !== 'undefined' ? window.location.origin : ''}/share/user/${user?.id}`}</code>
        </div>
        <div className={styles.modalButtons}>
          <Button variant="secondary" onClick={() => setShowShareModal(false)}>Close</Button>
          <Button onClick={copyShareLink}>{copied ? 'Copied!' : 'Copy Link'}</Button>
        </div>
      </Modal>

      {/* Sign In Modal */}
      <Modal isOpen={showSignInModal} onClose={() => setShowSignInModal(false)} title="Sign in to Share" size="small">
        <p className={styles.shareText}>Sign in with Google to share your profile with others.</p>
        <div className={styles.signInButtons}>
          <Button variant="secondary" onClick={() => setShowSignInModal(false)}>No thanks</Button>
          <GoogleSignInButton />
        </div>
      </Modal>
    </>
  );
}