'use client';
import { useState, useEffect, useRef } from 'react';
import { FiEdit, FiPlus, FiTrash2, FiArrowUp, FiArrowDown, FiType, FiImage } from 'react-icons/fi';
import imageCompression from 'browser-image-compression';
import { uploadImage, deleteImage } from '@/lib/imageStorage';
import PageHeader from './PageHeader';
import Button from './Button';
import RichText from './RichText';
import RichTextEditor from './RichTextEditor';
import styles from './AboutPageContent.module.css';

export default function AboutPageContent({ blocks: savedBlocks, onSave, userId, title }) {
  const [blocks, setBlocks] = useState(savedBlocks);
  const [editingAll, setEditingAll] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [justActivated, setJustActivated] = useState(false);
  const [addMenuIdx, setAddMenuIdx] = useState(null);
  const [saving, setSaving] = useState(false);

  const blockRefs = useRef({});
  const addMenuRef = useRef(null);

  const isEditable = !!onSave;

  useEffect(() => {
    if (!editingAll && !activeBlockId) setBlocks(savedBlocks);
  }, [savedBlocks, editingAll, activeBlockId]);

  useEffect(() => {
    if (justActivated) {
      const t = setTimeout(() => setJustActivated(false), 100);
      return () => clearTimeout(t);
    }
  }, [justActivated]);

  useEffect(() => {
    if (!activeBlockId) return;
    const handleOutside = (e) => {
      if (justActivated) return;
      const ref = blockRefs.current[activeBlockId];
      if (ref && !ref.contains(e.target)) {
        onSave?.(blocks);
        setActiveBlockId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [activeBlockId, justActivated, blocks, onSave]);

  useEffect(() => {
    if (!activeBlockId) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setBlocks(savedBlocks);
        setActiveBlockId(null);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [activeBlockId, savedBlocks]);

  useEffect(() => {
    if (addMenuIdx === null) return;
    const handler = (e) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) setAddMenuIdx(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addMenuIdx]);

  const activateBlock = (blockId, e) => {
    if (!isEditable || editingAll || activeBlockId === blockId) return;
    e?.stopPropagation();
    setJustActivated(true);
    setActiveBlockId(blockId);
  };

  const addBlock = (type, afterIndex) => {
    const nb = { id: crypto.randomUUID(), type, title: '', content: '' };
    const u = [...blocks];
    u.splice(afterIndex + 1, 0, nb);
    setBlocks(u);
    setAddMenuIdx(null);
  };

  const updateBlock = (id, updates) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBlock = (id) => {
    const block = blocks.find(b => b.id === id);
    if (block?.type === 'image' && block.content && userId) deleteImage(block.content);
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const moveBlock = (index, dir) => {
    const to = index + dir;
    if (to < 0 || to >= blocks.length) return;
    const u = [...blocks];
    [u[index], u[to]] = [u[to], u[index]];
    setBlocks(u);
  };

  const handleImageChange = async (blockId, file) => {
    if (!file?.type.startsWith('image/')) return;
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
      const dataUrl = await imageCompression.getDataUrlFromFile(compressed);
      const url = userId ? await uploadImage(dataUrl, userId, 'about') : dataUrl;
      updateBlock(blockId, { content: url });
    } catch (err) {
      console.error('Image upload failed:', err);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try { await onSave(blocks); setEditingAll(false); }
    catch (err) { console.error('Save failed:', err); }
    setSaving(false);
  };

  const handleCancelAll = () => {
    setBlocks(savedBlocks);
    setEditingAll(false);
    setAddMenuIdx(null);
  };

  const startEditAll = () => {
    setActiveBlockId(null);
    setEditingAll(true);
  };

  const hasContent = blocks.some(b => b.content || b.title);

  const renderAddButton = (afterIndex) => (
    <div className={styles.addButtonRow} key={`add-${afterIndex}`}>
      <button className={styles.addButton}
        onClick={() => setAddMenuIdx(addMenuIdx === afterIndex ? null : afterIndex)} aria-label="Add block">
        <FiPlus size={16} />
      </button>
      {addMenuIdx === afterIndex && (
        <div className={styles.addMenu} ref={addMenuRef}>
          <button className={styles.addMenuItem} onClick={() => addBlock('text', afterIndex)}>
            <FiType size={16} /> <span>Text</span>
          </button>
          <button className={styles.addMenuItem} onClick={() => addBlock('image', afterIndex)}>
            <FiImage size={16} /> <span>Image</span>
          </button>
        </div>
      )}
    </div>
  );

  const renderBlockView = (block) => {
    if (block.type === 'text') {
      if (!block.title && !block.content) return null;
      return (
        <>
          {block.title && <h2 className={styles.viewTitle}>{block.title}</h2>}
          {block.content ? <RichText content={block.content} /> : (
            <p className={styles.placeholderText}>{isEditable ? 'Click to add text...' : ''}</p>
          )}
        </>
      );
    }
    if (block.type === 'image') {
      if (!block.content) return null;
      return (
        <>
          <div className={styles.viewImageWrapper}>
            <img src={block.content} alt={block.title || ''} className={styles.viewImage} />
          </div>
          {block.title && <p className={styles.viewCaption}>{block.title}</p>}
        </>
      );
    }
    return null;
  };

  const renderBlockEdit = (block, index, showToolbar) => (
    <>
      {showToolbar && (
        <div className={styles.blockToolbar}>
          <span className={styles.blockTypeLabel}>
            {block.type === 'text' ? <><FiType size={14} /> Text</> : <><FiImage size={14} /> Image</>}
          </span>
          <div className={styles.blockActions}>
            <button onClick={() => moveBlock(index, -1)} disabled={index === 0} className={styles.blockAction} title="Move up"><FiArrowUp size={15} /></button>
            <button onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className={styles.blockAction} title="Move down"><FiArrowDown size={15} /></button>
            <button onClick={() => removeBlock(block.id)} className={`${styles.blockAction} ${styles.blockActionDanger}`} title="Delete"><FiTrash2 size={15} /></button>
          </div>
        </div>
      )}
      <div className={styles.blockBody}>
        {block.type === 'text' && (
          <>
            <input type="text" value={block.title || ''} onChange={e => updateBlock(block.id, { title: e.target.value })}
              placeholder="Section title" className={styles.titleInput} />
            <RichTextEditor value={block.content} onChange={val => updateBlock(block.id, { content: val })}
              placeholder="Write something..." minRows={4} />
          </>
        )}
        {block.type === 'image' && (
          <>
            <label className={styles.imageContainer}>
              {block.content ? (
                <>
                  <img src={block.content} alt="" className={styles.imagePreview} />
                  <div className={styles.imageEditIcon}><FiEdit size={18} /></div>
                </>
              ) : (
                <div className={styles.imageUploadArea}>
                  <FiImage size={28} />
                  <span>Choose an image</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={e => handleImageChange(block.id, e.target.files[0])} hidden />
            </label>
            <input type="text" value={block.title || ''} onChange={e => updateBlock(block.id, { title: e.target.value })}
              placeholder="Caption" className={styles.captionInput} />
          </>
        )}
      </div>
    </>
  );

  return (
    <div className={styles.container}>
      {isEditable && (
        <PageHeader
          title={title}
          actions={
            editingAll ? (
              <div className={styles.headerActions}>
                <Button variant="secondary" onClick={handleCancelAll}>Cancel</Button>
                <Button onClick={handleSaveAll} disabled={saving}>{saving ? 'Saving...' : 'Done'}</Button>
              </div>
            ) : (
              <button className={styles.editIconButton} onClick={startEditAll} aria-label="Edit page">
                <FiEdit size={18} />
              </button>
            )
          }
        />
      )}
      {!isEditable && title && <PageHeader title={title} />}

      <div className={styles.page}>
        {editingAll ? (
          <div className={styles.editArea}>
            {renderAddButton(-1)}
            {blocks.map((block, i) => (
              <div key={block.id}>
                <div className={styles.editBlock}>
                  {renderBlockEdit(block, i, true)}
                </div>
                {renderAddButton(i)}
              </div>
            ))}
            {blocks.length === 0 && (
              <p className={styles.emptyHint}>Click <strong>+</strong> above to add your first section.</p>
            )}
          </div>
        ) : (
          <div className={styles.viewArea}>
            {hasContent ? blocks.map((block, i) => {
              const isActive = activeBlockId === block.id;
              const isEmpty = !block.content && !block.title;
              if (isEmpty && !isEditable) return null;

              return (
                <div
                  key={block.id}
                  ref={el => blockRefs.current[block.id] = el}
                  className={`${styles.viewBlock} ${isEditable && !isActive ? styles.viewBlockEditable : ''} ${isActive ? styles.viewBlockActive : ''}`}
                  onClick={(e) => !isActive && activateBlock(block.id, e)}
                >
                  {isActive ? renderBlockEdit(block, i, false) : renderBlockView(block)}
                </div>
              );
            }) : (
              <p className={styles.emptyMessage}>
                {isEditable ? 'No content yet. Click the edit button to start adding information.' : 'No content added yet.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}