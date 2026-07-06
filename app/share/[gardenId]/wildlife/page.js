'use client';
import { useSharedGarden } from '@/context/SharedGardenContext';
import { getWildlifeDisplay } from '@/lib/dataService';
import ItemGrid from '@/components/ItemGrid';
import PlantBadges from '@/components/PlantBadges';
import styles from '../page.module.css';

export default function SharedWildlifePage() {
  const { garden, gardenId, filteredWildlife, searchQuery } = useSharedGarden();

  const wildlifeDisplay = getWildlifeDisplay(garden?.customization);
  const columns = wildlifeDisplay.columns;
  const hideBadges = wildlifeDisplay.hideBadges;

  const emptyMessage = searchQuery
    ? 'No wildlife match your current search.'
    : 'This garden has no wildlife yet.';

  return (
    <div className={styles.container}>
      <ItemGrid
        items={filteredWildlife}
        emptyMessage={emptyMessage}
        linkPrefix={`/share/${gardenId}/plant`}
        getItemId={(w) => w.id}
        getItemImage={(w) => w.mainImage || '/placeholder-plant.jpg'}
        fallbackImage="/placeholder-plant.jpg"
        getItemName={(w) => w.commonName || w.scientificName}
        getItemStyle={(w) => ({ fontStyle: w.commonName ? 'normal' : 'italic' })}
        renderOverlay={hideBadges ? undefined : (w) => <PlantBadges commonName={w.commonName} scientificName={w.scientificName} />}
        columns={columns}
      />
    </div>
  );
}
