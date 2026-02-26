'use client';
import { useSharedProfile } from '@/context/SharedProfileContext';
import ItemGrid, { ItemGridSection } from '@/components/ItemGrid';
import styles from './page.module.css';

const DEFAULT_GARDEN_IMAGE = '/default-garden.jpg';

export default function SharedProfilePage() {
  const { userId, createdGardens, savedGardens, recentGardens } = useSharedProfile();

  const hasSaved = savedGardens.length > 0;
  const hasRecent = recentGardens.length > 0;

  return (
    <div className={styles.container}>
      <ItemGridSection title="Created">
        {createdGardens.length > 0 ? (
          <ItemGrid
            items={createdGardens}
            linkPrefix="/share"
            getItemId={(g) => g.id}
            getItemImage={(g) => g.image || DEFAULT_GARDEN_IMAGE}
            getItemName={(g) => g.name}
          />
        ) : (
          <p className={styles.sectionEmpty}>No shared gardens.</p>
        )}
      </ItemGridSection>

      {hasSaved && (
        <ItemGridSection title="Saved">
          <ItemGrid
            items={savedGardens}
            linkPrefix="/share"
            getItemId={(g) => g.id}
            getItemImage={(g) => g.image || DEFAULT_GARDEN_IMAGE}
            getItemName={(g) => g.name}
          />
        </ItemGridSection>
      )}

      {hasRecent && (
        <ItemGridSection title="Recently Viewed">
          <ItemGrid
            items={recentGardens}
            linkPrefix="/share"
            getItemId={(g) => g.id}
            getItemImage={(g) => g.image || DEFAULT_GARDEN_IMAGE}
            getItemName={(g) => g.name}
          />
        </ItemGridSection>
      )}
    </div>
  );
}