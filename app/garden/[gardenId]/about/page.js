'use client';
import { useState } from 'react';
import { FiEdit, FiEye, FiCheck } from 'react-icons/fi';
import { useGarden } from '@/context/GardenContext';
import AboutPageContent from '@/components/AboutPageContent';
import DropdownMenu from '@/components/DropdownMenu';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import RichText from '@/components/RichText';
import styles from './page.module.css';

export default function GardenAboutPage() {
  const { garden, user, updateGardenAbout, updateGardenCustomization } = useGarden();
  const [privacyMode, setPrivacyMode] = useState(false);
  const [hiddenBlockIdsDraft, setHiddenBlockIdsDraft] = useState(new Set());

  if (!garden) return null;

  const defaultBlocks = [
    { id: 'default-text', type: 'text', title: 'Description', content: '' },
    { id: 'default-img', type: 'image', content: garden.image || '/default-garden.jpg', title: 'Garden image' },
  ];

  const blocks = garden.aboutBlocks?.length > 0 ? garden.aboutBlocks : defaultBlocks;
  const hiddenAboutBlockIds = garden?.customization?.hiddenAboutBlockIds || [];

  // Privacy mode handlers
  const startPrivacy = () => {
    setHiddenBlockIdsDraft(new Set(hiddenAboutBlockIds));
    setPrivacyMode(true);
  };

  const cancelPrivacy = () => {
    setPrivacyMode(false);
    setHiddenBlockIdsDraft(new Set());
  };

  const savePrivacy = async () => {
    const existing = garden?.customization || {};
    await updateGardenCustomization({ ...existing, hiddenAboutBlockIds: Array.from(hiddenBlockIdsDraft) });
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

  // Privacy mode view
  if (privacyMode) {
    const contentBlocks = blocks.filter(b => b.content || b.title);

    return (
      <div className={styles.container}>
        <PageHeader
          title="About This Garden"
          actions={
            <div className={styles.privacyActions}>
              <Button variant="secondary" size="small" onClick={cancelPrivacy}>Cancel</Button>
              <Button size="small" onClick={savePrivacy}>Save</Button>
            </div>
          }
        />
        <div className={styles.privacyBanner}>
          Select which blocks are visible when this garden is shared. Checked blocks will be visible to viewers.
        </div>
        <div className={styles.privacyBlocks}>
          {contentBlocks.length > 0 ? contentBlocks.map(block => {
            const isHidden = hiddenBlockIdsDraft.has(block.id);
            return (
              <div
                key={block.id}
                className={`${styles.privacyBlock} ${isHidden ? styles.privacyBlockDimmed : ''}`}
                onClick={() => toggleBlock(block.id)}
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

  // Normal view with DropdownMenu
  return (
    <AboutPageContent
      blocks={blocks}
      onSave={updateGardenAbout}
      userId={user?.id}
      title="About This Garden"
      headerActions={user ? (startEditAll) => (
        <DropdownMenu items={[
          { icon: <FiEdit size={16} />, label: 'Edit Page', onClick: startEditAll },
          { icon: <FiEye size={16} />, label: 'Edit Privacy', onClick: startPrivacy },
        ]} />
      ) : undefined}
    />
  );
}