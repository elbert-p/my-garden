'use client';
import { useGarden } from '@/context/GardenContext';
import ItemGrid from '@/components/ItemGrid';
import styles from './page.module.css';

export default function GardenPage() {
  const { gardenId, filteredPlants, searchQuery } = useGarden();

  return (
    <div className={styles.container}>
      <ItemGrid
        items={filteredPlants}
        emptyMessage={searchQuery ? 'No plants match your search.' : 'No plants in this garden yet. Click the menu to add one!'}
        linkPrefix={`/garden/${gardenId}/plant`}
        getItemId={(p) => p.id}
        getItemImage={(p) => p.mainImage || '/placeholder-plant.jpg'}
        getItemName={(p) => p.commonName || p.scientificName}
        getItemStyle={(p) => ({ fontStyle: p.commonName ? 'normal' : 'italic' })}
      />
    </div>
  );
}