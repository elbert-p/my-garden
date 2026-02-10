'use client';
import { useGarden } from '@/context/GardenContext';
import { isMissingSortField, getActiveFilterCount } from '@/components/SortFilterControls';
import ItemGrid from '@/components/ItemGrid';
import styles from './page.module.css';

export default function GardenPage() {
  const { gardenId, filteredPlants, plants, searchQuery, sort, filters } = useGarden();

  const hasActiveFilters = !!(getActiveFilterCount(filters) > 0);

  const emptyMessage = searchQuery
    ? 'No plants match your current search.'
    : hasActiveFilters
    ? 'No plants match your current filters.'
    : 'No plants in this garden yet. Click the menu to add one!';

  return (
    <div className={styles.container}>
      <ItemGrid
        items={filteredPlants}
        emptyMessage={emptyMessage}
        linkPrefix={`/garden/${gardenId}/plant`}
        getItemId={(p) => p.id}
        getItemImage={(p) => p.mainImage || '/placeholder-plant.jpg'}
        getItemName={(p) => p.commonName || p.scientificName}
        getItemStyle={(p) => ({ fontStyle: p.commonName ? 'normal' : 'italic' })}
        getItemDimmed={sort.key ? (p) => isMissingSortField(p, sort) : undefined}
      />
    </div>
  );
}