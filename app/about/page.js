'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiShare2, FiEdit, FiEye, FiCheck } from 'react-icons/fi';
import { useAuth, SHARE_INTENT_KEY } from '@/context/AuthContext';
import {
  getProfileAboutBlocks, updateProfileAboutBlocks,
  getProfileVisibility, updateProfileVisibility, createGarden,
} from '@/lib/dataService';
import { uploadImage } from '@/lib/imageStorage';
import NavBar from '@/components/NavBar';
import AboutPageContent from '@/components/AboutPageContent';
import DropdownMenu from '@/components/DropdownMenu';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import RichText from '@/components/RichText';
import Modal from '@/components/Modal';
import FormInput, { ErrorMessage } from '@/components/FormInput';
import ImageUpload from '@/components/ImageUpload';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import styles from './page.module.css';

const DEFAULT_GARDEN_IMAGE = '/default-garden.jpg';

export default function AboutPage() {
  const { user, isInitialized, isMigrating, isAuthenticated } = useAuth();
  const router = useRouter();

  const [blocks, setBlocks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Privacy (which about blocks are visible on the shared profile)
  const [profileVisibility, setProfileVisibility] = useState(null);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [hiddenBlockIdsDraft, setHiddenBlockIdsDraft] = useState(new Set());

  // New Garden modal
  const [showModal, setShowModal] = useState(false);
  const [newGardenName, setNewGardenName] = useState('');
  const [newGardenImage, setNewGardenImage] = useState(null);
  const [error, setError] = useState('');

  // Share modals
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const tabs = [
    { label: 'Gardens', href: '/', active: false },
    { label: 'About', href: '/about', active: true },
  ];

  useEffect(() => {
    if (!isInitialized) return;
    (async () => {
      const [data, vis] = await Promise.all([
        getProfileAboutBlocks(user?.id),
        getProfileVisibility(user?.id),
      ]);
      setBlocks(data);
      setProfileVisibility(vis);
      setLoaded(true);
    })();
  }, [user?.id, isInitialized]);

  // After signing in via the "Share Profile" prompt, reopen the share modal.
  useEffect(() => {
    if (!isInitialized || isMigrating || !user) return;
    const raw = localStorage.getItem(SHARE_INTENT_KEY);
    if (!raw) return;
    try {
      const intent = JSON.parse(raw);
      if (intent?.type === 'profile') {
        localStorage.removeItem(SHARE_INTENT_KEY);
        setShowShareModal(true);
        setCopied(false);
      }
    } catch {
      localStorage.removeItem(SHARE_INTENT_KEY);
    }
  }, [isInitialized, isMigrating, user]);

  const handleSave = async (updatedBlocks) => {
    await updateProfileAboutBlocks(user?.id, updatedBlocks);
    setBlocks(updatedBlocks);
  };

  const defaultBlocks = [
    { id: 'default-text', type: 'text', title: 'My Gardens', content: '' },
  ];

  const effectiveBlocks = blocks.length > 0 ? blocks : defaultBlocks;
  const hiddenAboutBlockIds = profileVisibility?.hiddenAboutBlockIds || [];

  // ---- Privacy mode handlers ----
  const startPrivacy = () => {
    setHiddenBlockIdsDraft(new Set(hiddenAboutBlockIds));
    setPrivacyMode(true);
  };

  const cancelPrivacy = () => {
    setPrivacyMode(false);
    setHiddenBlockIdsDraft(new Set());
  };

  const savePrivacy = async () => {
    const newVis = { ...profileVisibility, hiddenAboutBlockIds: Array.from(hiddenBlockIdsDraft) };
    await updateProfileVisibility(user?.id, newVis);
    setProfileVisibility(newVis);
    setPrivacyMode(false);
    setHiddenBlockIdsDraft(new Set());
  };

  const toggleBlock = (blockId) => {
    setHiddenBlockIdsDraft(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  // ---- New Garden ----
  const handleCloseModal = () => {
    setShowModal(false);
    setNewGardenName('');
    setNewGardenImage(null);
    setError('');
  };

  const handleAddGarden = async () => {
    if (!newGardenName.trim()) {
      setError('Please enter a garden name.');
      return;
    }
    try {
      let imageUrl = newGardenImage;
      if (imageUrl && user?.id) {
        imageUrl = await uploadImage(imageUrl, user.id, 'gardens');
      }
      const newGarden = await createGarden({
        name: newGardenName.trim(),
        image: imageUrl || DEFAULT_GARDEN_IMAGE,
      }, user?.id);
      handleCloseModal();
      router.push(`/garden/${newGarden.id}`);
    } catch (e) {
      setError('An error occurred while saving the garden.');
      console.error('Save error:', e);
    }
  };

  // ---- Share Profile ----
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

  const menuItems = [
    { icon: <FiPlus size={16} />, label: 'New Garden', onClick: () => setShowModal(true), variant: 'success' },
    { divider: true },
    { icon: <FiShare2 size={16} />, label: 'Share Profile', onClick: handleShare, variant: 'share' },
  ];

  const showLoading = !isInitialized || isMigrating || !loaded;

  return (
    <>
      <NavBar
        title="My Gardens"
        showHome={true}
        tabs={tabs}
        contentWidth="medium"
        menuItems={!privacyMode ? menuItems : undefined}
      />

      {showLoading ? (
        <div className={styles.loadingContainer}>
          <p className={styles.loading}>Loading...</p>
        </div>
      ) : privacyMode ? (
        <PrivacyView
          blocks={effectiveBlocks}
          hiddenBlockIdsDraft={hiddenBlockIdsDraft}
          onToggle={toggleBlock}
          onCancel={cancelPrivacy}
          onSave={savePrivacy}
        />
      ) : (
        <AboutPageContent
          blocks={effectiveBlocks}
          onSave={handleSave}
          userId={user?.id}
          title="About Me"
          headerActions={(startEditAll) => (
            <DropdownMenu items={[
              { icon: <FiEdit size={16} />, label: 'Edit Page', onClick: startEditAll },
              { icon: <FiEye size={16} />, label: 'Edit Privacy', onClick: startPrivacy },
            ]} />
          )}
        />
      )}

      {/* New Garden Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title="Add New Garden" size="medium">
        <ErrorMessage message={error} />
        <FormInput value={newGardenName} onChange={setNewGardenName} placeholder="Garden name" />
        <ImageUpload
          image={newGardenImage}
          onImageChange={setNewGardenImage}
          onError={setError}
          placeholder="Select Image"
          size="large"
        />
        <div className={styles.modalButtons}>
          <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
          <Button onClick={handleAddGarden}>Save</Button>
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
          <Button variant="secondary" onClick={() => setShowSignInModal(false)}>Close</Button>
          <GoogleSignInButton variant="primary" shareIntent={{ type: 'profile' }} />
        </div>
      </Modal>
    </>
  );
}

// Privacy mode view — mirrors the garden about page: pick which blocks are
// visible on the shared profile. Checked = visible.
function PrivacyView({ blocks, hiddenBlockIdsDraft, onToggle, onCancel, onSave }) {
  const contentBlocks = blocks.filter(b => b.content || b.title);

  return (
    <div className={styles.privacyContainer}>
      <PageHeader
        title="About Me"
        actions={
          <div className={styles.privacyActions}>
            <Button variant="secondary" size="small" onClick={onCancel}>Cancel</Button>
            <Button size="small" onClick={onSave}>Save</Button>
          </div>
        }
      />
      <div className={styles.privacyBanner}>
        Select which blocks are visible on your shared profile. Checked blocks will be shown to others.
      </div>
      <div className={styles.privacyBlocks}>
        {contentBlocks.length > 0 ? contentBlocks.map(block => {
          const isHidden = hiddenBlockIdsDraft.has(block.id);
          return (
            <div
              key={block.id}
              className={`${styles.privacyBlock} ${isHidden ? styles.privacyBlockDimmed : ''}`}
              onClick={() => onToggle(block.id)}
            >
              {block.type === 'text' && (
                <>
                  {block.title && <h2 className={styles.privacyBlockTitle}>{block.title}</h2>}
                  {block.content && <RichText content={block.content} />}
                </>
              )}
              {block.type === 'image' && (
                <>
                  <div className={styles.privacyImageWrapper}>
                    <img src={block.content} alt={block.title || ''} className={styles.privacyImage} />
                  </div>
                  {block.title && <p className={styles.privacyCaption}>{block.title}</p>}
                </>
              )}
              <div className={`${styles.privacyCheckbox} ${!isHidden ? styles.privacyChecked : ''}`}>
                {!isHidden && <FiCheck size={12} strokeWidth={3.5} />}
              </div>
            </div>
          );
        }) : (
          <p className={styles.emptyMessage}>No content blocks to configure.</p>
        )}
      </div>
    </div>
  );
}
