'use client';
import { useSharedGarden } from '@/context/SharedGardenContext';
import ItemGrid from '@/components/ItemGrid';
import styles from './page.module.css';

export default function SharedGardenPage() {
  const { gardenId, filteredPlants, searchQuery } = useSharedGarden();

  return (
    <div className={styles.container}>
      <ItemGrid
        items={filteredPlants}
        emptyMessage={searchQuery ? 'No plants match your search.' : 'This garden has no plants yet.'}
        linkPrefix={`/share/${gardenId}/plant`}
        getItemId={(p) => p.id}
        getItemImage={(p) => p.mainImage || '/placeholder-plant.jpg'}
        getItemName={(p) => p.commonName || p.scientificName}
        getItemStyle={(p) => ({ fontStyle: p.commonName ? 'normal' : 'italic' })}
      />
    </div>
  );
}