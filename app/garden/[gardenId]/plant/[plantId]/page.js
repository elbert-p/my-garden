'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { IoClose } from 'react-icons/io5';
import { FiEdit, FiPlus, FiTrash2, FiDatabase, FiShare2, FiCopy, FiEye, FiCheck } from 'react-icons/fi';
import imageCompression from 'browser-image-compression';
import { setCopiedPlant } from '@/lib/clipboardStorage';
import { useGarden } from '@/context/GardenContext';
import { SHARE_INTENT_KEY } from '@/context/AuthContext';
import { getPlant, updatePlant, deletePlant } from '@/lib/dataService';
import { uploadImage, deleteImage, tileUrl, tileSrcSet, IMAGE_COMPRESSION_OPTIONS } from '@/lib/imageStorage';
import { getImageCredit } from '@/lib/autofillImages';
import { findData, buildAutofillUpdates } from '@/lib/plantAutofill';
import { entrySignature } from '@/lib/autofillDb';
import { BLOOM_OPTIONS, SUN_OPTIONS, MOISTURE_OPTIONS, NATIVE_OPTIONS, PLANT_TYPE_OPTIONS } from '@/lib/plantConstants';
import PageHeader from '@/components/PageHeader';
import DropdownMenu from '@/components/DropdownMenu';
import Modal, { ConfirmModal } from '@/components/Modal';
import Button from '@/components/Button';
import InfoField from '@/components/InfoField';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import PlantBadges from '@/components/PlantBadges';
import LazyImage from '@/components/LazyImage';
import styles from './page.module.css';

// Additional Photos tiles are square, minmax(100px, 1fr), dropping to 80px
// under 480px. At 3x that asks for ~360px, so srcset picks the 400 rendition.
const PHOTO_TILE_SIZES = '(max-width: 480px) 90px, 120px';

const formatDateDisplay = (dateStr) => { if (!dateStr) return ''; const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); };

export default function PlantPage() {
  const router = useRouter();
  const { plantId } = useParams();
  const { gardenId, user, isInitialized, garden, wildlife, updatePlantInContext, removePlantFromContext } = useGarden();

  const [plant, setPlant] = useState(null);
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAutofillModal, setShowAutofillModal] = useState(false);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  // Image removal confirmation: null | { kind: 'main' } | { kind: 'additional', url }
  const [imageToRemove, setImageToRemove] = useState(null);
  const [copied, setCopied] = useState(false);
  const [autofillData, setAutofillData] = useState(null);
  const [autofillMatchedBy, setAutofillMatchedBy] = useState(null);
  const [autofillDisplayName, setAutofillDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Privacy mode
  const [privacyMode, setPrivacyMode] = useState(false);
  const [hiddenFieldsDraft, setHiddenFieldsDraft] = useState(new Set());
  const [hiddenImagesDraft, setHiddenImagesDraft] = useState(new Set());

  const mainRef = useRef(null);
  const addRef = useRef(null);

  // Wildlife are stored in the plants table with type='wildlife'. They reuse this
  // detail page but show only name/notes/photos (no autofill or plant attributes).
  const isWildlife = plant?.type === 'wildlife';

  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Load plant data
  useEffect(() => {
    if (!isInitialized || !plantId || !garden) return;

    (async () => {
      try {
        const p = await getPlant(plantId, user?.id);
        if (p) {
          setPlant(p);
          setTemp({ ...p });
        } else {
          router.push(`/garden/${gardenId}`);
        }
      } catch {
        router.push(`/garden/${gardenId}`);
      }
      setIsLoading(false);
    })();
  }, [plantId, gardenId, user?.id, isInitialized, garden, router]);

  // After signing in via the "Share Plant" prompt, reopen the share modal.
  // The intent's ids were rewritten to the new DB ids during migration.
  useEffect(() => {
    if (!isInitialized || !user || !plant) return;
    const raw = localStorage.getItem(SHARE_INTENT_KEY);
    if (!raw) return;
    try {
      const intent = JSON.parse(raw);
      if (intent?.type === 'plant' && intent.gardenId === gardenId && intent.plantId === plantId) {
        localStorage.removeItem(SHARE_INTENT_KEY);
        setShowShareModal(true);
        setCopied(false);
      }
    } catch {
      localStorage.removeItem(SHARE_INTENT_KEY);
    }
  }, [isInitialized, user, plant, gardenId, plantId]);

  const applyAutofillResult = (result) => {
    setAutofillData(result.data);
    setAutofillMatchedBy(result.matchedBy);
    setAutofillDisplayName(
      result.matchedBy === 'common'
        ? result.data['Common name']
        : result.data['Latin name']
    );
    setShowAutofillModal(true);
  };

  // Auto-show autofill modal (plants only — wildlife have no reference data)
  useEffect(() => {
    if (plant && plant.type !== 'wildlife' && !plant.hasAutofilled) {
      const result = findData(plant.scientificName, plant.commonName);
      if (result) applyAutofillResult(result);
    }
  }, [plant?.scientificName, plant?.commonName, plant?.hasAutofilled, plant?.type]);

  // Escape key handler
  useEffect(() => {
    const esc = (e) => {
      if (e.key === 'Escape') {
        setSelectedImage(null);
        setShowAutofillModal(false);
        setShowNotFoundModal(false);
        setShowDeleteModal(false);
        setShowShareModal(false);
        setShowSignInModal(false);
        setImageToRemove(null);
        if (privacyMode) { setPrivacyMode(false); }
      }
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [privacyMode]);

  // Privacy mode handlers
  const startPlantPrivacy = () => {
    const privacy = plant?.plantPrivacy || {};
    setHiddenFieldsDraft(new Set(privacy.hiddenFields || []));
    setHiddenImagesDraft(new Set(privacy.hiddenImages || []));
    setEditing(false);
    setPrivacyMode(true);
  };

  const cancelPlantPrivacy = () => {
    setPrivacyMode(false);
    setHiddenFieldsDraft(new Set());
    setHiddenImagesDraft(new Set());
  };

  const savePlantPrivacy = async () => {
    const privacy = {
      hiddenFields: Array.from(hiddenFieldsDraft),
      hiddenImages: Array.from(hiddenImagesDraft),
    };
    await save({ ...plant, plantPrivacy: privacy });
    setPrivacyMode(false);
  };

  const toggleFieldVisibility = (fieldKey) => {
    setHiddenFieldsDraft(prev => {
      const next = new Set(prev);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  };

  const toggleImageVisibility = (imageUrl) => {
    setHiddenImagesDraft(prev => {
      const next = new Set(prev);
      if (next.has(imageUrl)) next.delete(imageUrl);
      else next.add(imageUrl);
      return next;
    });
  };

  // Helper: wrap an InfoField with privacy overlay
  const renderField = (key, fieldJsx, large = false) => {
    if (!privacyMode) return fieldJsx;
    const isHidden = hiddenFieldsDraft.has(key);
    return (
      <div
        key={key}
        className={`${styles.privacyFieldWrapper} ${isHidden ? styles.privacyFieldDimmed : ''} ${large ? styles.privacyFieldLarge : ''}`}
        onClick={() => toggleFieldVisibility(key)}
      >
        {fieldJsx}
        <div className={`${styles.privacyCheckbox} ${!isHidden ? styles.privacyChecked : ''}`}>
          {!isHidden && <FiCheck size={12} strokeWidth={3.5} />}
        </div>
      </div>
    );
  };

  const save = async (p) => {
    const trimmed = {
      ...p,
      commonName: p.commonName?.trim() || '',
      scientificName: p.scientificName?.trim() || '',
    };
    const u = await updatePlant(plantId, trimmed, user?.id);
    setPlant(u);
    setTemp(u);
    updatePlantInContext(u);
  };

  const compress = async (f) => {
    try {
      const c = await imageCompression(f, IMAGE_COMPRESSION_OPTIONS);
      return await imageCompression.getDataUrlFromFile(c);
    } catch {
      return null;
    }
  };

  const onMain = async (e) => {
    const f = e.target.files[0];
    if (f?.type.startsWith('image/')) {
      const dataUrl = await compress(f);
      if (dataUrl) {
        const oldImage = temp.mainImage;
        const url = user?.id ? await uploadImage(dataUrl, user.id, 'plants') : dataUrl;
        await save({ ...temp, mainImage: url });
        if (user?.id) deleteImage(oldImage);
      }
    }
  };

  const onAdd = async (e) => {
    const f = e.target.files[0];
    if (f?.type.startsWith('image/')) {
      const dataUrl = await compress(f);
      if (dataUrl) {
        const url = user?.id ? await uploadImage(dataUrl, user.id, 'plants') : dataUrl;
        await save({ ...temp, images: [...(temp.images || []), url] });
      }
    }
    if (addRef.current) addRef.current.value = '';
  };

  const onCopyPlant = () => {
    if (!plant) return;
    setCopiedPlant({
      commonName: plant.commonName,
      scientificName: plant.scientificName,
      mainImage: plant.mainImage,
      datePlanted: plant.datePlanted,
      bloomTime: plant.bloomTime,
      height: plant.height,
      sunlight: plant.sunlight,
      moisture: plant.moisture,
      nativeRange: plant.nativeRange,
      plantType: plant.plantType,
      hostedInsects: plant.hostedInsects,
      notes: plant.notes,
      images: plant.images,
      hasAutofilled: plant.hasAutofilled,
    });
  };

  const removeMainImage = async () => {
    const oldImage = temp.mainImage;
    await save({ ...temp, mainImage: '' });
    if (user?.id) deleteImage(oldImage);
  };

  const removeAdditionalImage = async (img) => {
    if (user?.id) deleteImage(img);
    await save({ ...temp, images: temp.images.filter(x => x !== img) });
  };

  const confirmRemoveImage = async () => {
    if (!imageToRemove) return;
    if (imageToRemove.kind === 'main') await removeMainImage();
    else await removeAdditionalImage(imageToRemove.url);
    setImageToRemove(null);
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
    await navigator.clipboard.writeText(`${window.location.origin}/share/${gardenId}/plant/${plantId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onAutofillClick = () => {
    const result = findData(temp.scientificName, temp.commonName);
    if (result) {
      applyAutofillResult(result);
    } else {
      setShowNotFoundModal(true);
    }
  };

  const onAutofill = async () => {
    if (!autofillData) return;
    const updates = await buildAutofillUpdates(temp, { data: autofillData, matchedBy: autofillMatchedBy });
    // Record the entry state we filled from so the garden prompt won't re-ask
    // until this entry changes again.
    await save({ ...temp, ...updates, autofillSig: entrySignature(autofillData) });
    setShowAutofillModal(false);
  };

  // Declining the prompt marks the plant as handled so it isn't asked again
  // (autofill is still available on demand from the menu). Aligns with the
  // garden-level prompt: once asked — filled or not — we don't re-ask until the
  // reference entry changes (tracked via autofillSig).
  const onAutofillDecline = () => {
    setShowAutofillModal(false);
    if (plant && plant.type !== 'wildlife') {
      save({ ...plant, hasAutofilled: true, autofillSig: entrySignature(autofillData) });
    }
  };

  const onDelete = async () => {
    if (user?.id && plant) {
      deleteImage(plant.mainImage);
      (plant.images || []).forEach(img => deleteImage(img));
    }
    await deletePlant(plantId, user?.id);
    removePlantFromContext(plantId);
    // Return to the wildlife grid if other wildlife remain, else the plants grid.
    const otherWildlifeRemain = isWildlife && wildlife.some(w => w.id !== plantId);
    router.push(otherWildlifeRemain ? `/garden/${gardenId}/wildlife` : `/garden/${gardenId}`);
  };

  const label = isWildlife ? 'Wildlife' : 'Plant';
  const plantMenu = [
    { icon: <FiEdit size={16} />, label: `Edit ${label}`, onClick: () => { setTemp({ ...plant }); setEditing(true); }},
    { icon: <FiDatabase size={16} />, label: 'Autofill', onClick: onAutofillClick, visible: !isWildlife },
    { icon: <FiEye size={16} />, label: 'Edit Privacy', onClick: startPlantPrivacy, visible: !!user },
    { divider: true },
    { icon: <FiCopy size={16} />, label: 'Copy Plant', onClick: onCopyPlant, visible: !isWildlife },
    { icon: <FiShare2 size={16} />, label: `Share ${label}`, onClick: handleShare, variant: 'share' },
    { divider: true },
    { icon: <FiTrash2 size={16} />, label: 'Delete', onClick: () => setShowDeleteModal(true), danger: true },
  ];

  if (isLoading || !plant) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading plant...</div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.container}>
        <PageHeader
            title={plant.commonName ? (plant.commonName) : plant.scientificName ? (
            <em>{plant.scientificName}</em>) : (label)}
          onBack={() => isWildlife ? router.push(`/garden/${gardenId}/wildlife`) : router.back()}
          actions={
            privacyMode ? (
              <div className={styles.privacyActions}>
                <Button variant="secondary" size="small" onClick={cancelPlantPrivacy}>Cancel</Button>
                <Button size="small" onClick={savePlantPrivacy}>Save</Button>
              </div>
            ) : editing ? (
              <Button variant="success" onClick={async () => { await save(temp); setEditing(false); }}>
                Save
              </Button>
            ) : (
              <DropdownMenu items={plantMenu} />
            )
          }
        />

        <div className={styles.details}>
          {privacyMode && (
            <div className={styles.privacyBanner}>
              Select which fields and photos are visible when this plant is shared. Checked items will be visible to viewers.
            </div>
          )}

          <div
            className={`${styles.mainImageContainer} ${editing ? styles.mainImageEditing : ''}`}
            onClick={() => {
              if (privacyMode) return;
              if (editing || !temp.mainImage) { mainRef.current?.click(); return; }
              setSelectedImage(temp.mainImage);
            }}
          >
            <img src={temp.mainImage || '/placeholder-plant.jpg'} alt="" className={styles.mainImage} onError={(e) => { e.target.src = '/placeholder-plant.jpg'; }} />
            {!privacyMode && !isWildlife && !garden?.customization?.hideBadges && <PlantBadges commonName={plant.commonName} scientificName={plant.scientificName} size="large" />}
            {!privacyMode && <button className={styles.mainImageEditButton} onClick={(e) => { e.stopPropagation(); mainRef.current?.click(); }}><FiEdit size={18} /></button>}
            {!privacyMode && temp.mainImage && <button className={styles.mainImageDeleteButton} onClick={(e) => { e.stopPropagation(); setImageToRemove({ kind: 'main' }); }}><FiTrash2 size={18} /></button>}
            <input ref={mainRef} type="file" onChange={onMain} className={styles.fileInput} accept="image/*" onClick={(e) => e.stopPropagation()} />
          </div>

          <div className={styles.infoGridWrapper}>
            <div className={`${styles.infoGrid} ${privacyMode ? styles.infoGridPrivacy : ''}`}>
              {renderField('commonName', <InfoField label="Common Name" value={temp.commonName} onChange={v => setTemp({ ...temp, commonName: v })} onSave={() => save(temp)} isEditing={editing} type="text" />)}
              {renderField('scientificName', <InfoField label="Scientific Name" value={temp.scientificName} onChange={v => setTemp({ ...temp, scientificName: v })} onSave={() => save(temp)} isEditing={editing} type="text" />)}
              {!isWildlife && (
                <>
                  {renderField('datePlanted', <InfoField label="Date Planted" value={temp.datePlanted} onChange={v => setTemp({ ...temp, datePlanted: v })} onSave={() => save(temp)} isEditing={editing} type="date" formatDisplay={formatDateDisplay} />)}
                  {renderField('bloomTime', <InfoField label="Bloom Time" value={temp.bloomTime} onChange={v => setTemp({ ...temp, bloomTime: v })} onSave={() => save(temp)} isEditing={editing} type="multiselect" options={BLOOM_OPTIONS} />)}
                  {renderField('height', <InfoField label="Height" value={temp.height} onChange={v => setTemp({ ...temp, height: v })} onSave={() => save(temp)} isEditing={editing} type="text" placeholder="e.g., 2-3 ft" />)}
                  {renderField('sunlight', <InfoField label="Sunlight" value={temp.sunlight} onChange={v => setTemp({ ...temp, sunlight: v })} onSave={() => save(temp)} isEditing={editing} type="multiselect" options={SUN_OPTIONS} />)}
                  {renderField('moisture', <InfoField label="Moisture" value={temp.moisture} onChange={v => setTemp({ ...temp, moisture: v })} onSave={() => save(temp)} isEditing={editing} type="multiselect" options={MOISTURE_OPTIONS} />)}
                  {renderField('plantType', <InfoField label="Plant Type" value={temp.plantType} onChange={v => { const updated = { ...temp, plantType: v }; setTemp(updated); if (!editing) save(updated); }} isEditing={editing} type="multiselect" options={PLANT_TYPE_OPTIONS} />)}
                  {renderField('nativeRange', <InfoField label="Native Range" value={temp.nativeRange} onChange={v => setTemp({ ...temp, nativeRange: v })} onSave={() => save(temp)} isEditing={editing} type="multiselect" options={NATIVE_OPTIONS} />)}
                  {renderField('hostedInsects', <InfoField label="Hosted Butterflies and Moths" value={temp.hostedInsects} onChange={v => setTemp({ ...temp, hostedInsects: v })} onSave={() => save(temp)} isEditing={editing} type="textarea" maxHeight="195px" placeholder="e.g., Monarch; Swallowtail; Bumblebee" />)}
                </>
              )}
              {isWildlife && renderField('nativeRange', <InfoField label="Native Range" value={temp.nativeRange} onChange={v => setTemp({ ...temp, nativeRange: v })} onSave={() => save(temp)} isEditing={editing} type="multiselect" options={NATIVE_OPTIONS} />)}
              {renderField('notes', <InfoField label="Notes" value={temp.notes} onChange={v => setTemp({ ...temp, notes: v })} onSave={() => save(temp)} isEditing={editing} type="textarea" emptyText="No notes" size="large" />, true)}
            </div>
          </div>

          <div className={`${styles.photosSection} ${editing ? styles.photosSectionEditing : ''}`}>
            <h2 className={styles.sectionTitle}>Additional Photos</h2>
            {privacyMode ? (
              (plant.images?.length > 0) ? (
                <div className={styles.imageGrid}>
                  {plant.images.map((img, i) => {
                    const isImgHidden = hiddenImagesDraft.has(img);
                    return (
                      <div key={i} className={`${styles.photoItem} ${isImgHidden ? styles.privacyFieldDimmed : ''}`}
                        onClick={() => toggleImageVisibility(img)}>
                        <LazyImage src={tileUrl(img)} srcSet={tileSrcSet(img)} sizes={PHOTO_TILE_SIZES} fallbackSrc={img} alt="" className={styles.photo} />
                        <div className={`${styles.privacyCheckbox} ${!isImgHidden ? styles.privacyChecked : ''}`}>
                          {!isImgHidden && <FiCheck size={14} strokeWidth={3.5} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.noPhotos}>No additional photos.</p>
              )
            ) : temp.images?.length > 0 ? (
              <div className={styles.imageGrid}>
                {temp.images.map((img, i) => (
                  <div key={i} className={styles.photoItem}>
                    <LazyImage src={tileUrl(img)} srcSet={tileSrcSet(img)} sizes={PHOTO_TILE_SIZES} fallbackSrc={img} alt="" className={styles.photo} onClick={() => setSelectedImage(img)} />
                    <button onClick={e => { e.stopPropagation(); setImageToRemove({ kind: 'additional', url: img }); }} className={styles.removeButton}>
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                ))}
                <button className={styles.addPhotoButton} onClick={() => addRef.current?.click()}>
                  <FiPlus size={24} />
                  <span>Add Photo</span>
                  <input ref={addRef} type="file" onChange={onAdd} className={styles.fileInput} accept="image/*" />
                </button>
              </div>
            ) : (
              <div className={styles.emptyPhotosContainer}>
                <p className={styles.noPhotos}>No additional photos yet.</p>
                <div className={`${styles.emptyPhotosAddButton} ${editing ? styles.visible : ''}`}>
                  <button className={styles.addPhotoButton} onClick={() => addRef.current?.click()}>
                    <FiPlus size={24} />
                    <span>Add Photo</span>
                    <input ref={addRef} type="file" onChange={onAdd} className={styles.fileInput} accept="image/*" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedImage && (
        <div className={styles.photoModalOverlay} onClick={() => setSelectedImage(null)}>
          <div className={styles.photoModalContent} onClick={e => e.stopPropagation()}>
            <img src={selectedImage} alt="" className={styles.photoModalImage} />
            {getImageCredit(selectedImage) && (
              <div className={styles.photoModalCredit}>Photo: {getImageCredit(selectedImage)}</div>
            )}
            <button className={styles.photoModalCloseButton} onClick={() => setSelectedImage(null)}>
              <IoClose size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Remove Image Confirmation */}
      <ConfirmModal
        isOpen={!!imageToRemove}
        onClose={() => setImageToRemove(null)}
        onConfirm={confirmRemoveImage}
        title="Remove Image"
        message="Are you sure you want to remove this image?"
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Plant-specific Modals */}
      <ConfirmModal
        isOpen={showAutofillModal}
        onClose={onAutofillDecline}
        onConfirm={onAutofill}
        title="Autofill Plant Data"
        message={<>Found <strong>{autofillDisplayName}</strong> in database. Would you like to autofill?</>}
        confirmText="Yes"
        cancelText="No"
      />

      <ConfirmModal
        isOpen={showNotFoundModal}
        onClose={() => setShowNotFoundModal(false)}
        onConfirm={() => setShowNotFoundModal(false)}
        title="Autofill not available"
        message={<><strong>{temp?.scientificName || temp?.commonName || 'Plant'}</strong> has not been added to the database.</>}
        confirmText="OK"
        cancelText={null}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={onDelete}
        title={`Delete ${label}`}
        message={<>Delete <strong>{plant.commonName || plant.scientificName}</strong>?</>}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title={`Share ${label}`} size="small">
        <p className={styles.shareText}>Anyone with this link can view this {label.toLowerCase()}:</p>
        <div className={styles.shareLink}>
          <code>{`${typeof window !== 'undefined' ? window.location.origin : ''}/share/${gardenId}/plant/${plantId}`}</code>
        </div>
        <div className={styles.shareButtons}>
          <Button variant="secondary" onClick={() => setShowShareModal(false)}>Close</Button>
          <Button onClick={copyShareLink}>{copied ? 'Copied!' : 'Copy Link'}</Button>
        </div>
      </Modal>

      <Modal isOpen={showSignInModal} onClose={() => setShowSignInModal(false)} title="Sign in to Share" size="small">
        <p className={styles.shareText}>Sign in with Google to share your plants with others.</p>
        <div className={styles.signInButtons}>
          <Button variant="secondary" onClick={() => setShowSignInModal(false)}>Close</Button>
          <GoogleSignInButton variant="primary" shareIntent={{ type: 'plant', gardenId, plantId }} />
        </div>
      </Modal>
    </>
  );
}