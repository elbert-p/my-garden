'use client';
import { useSharedGarden } from '@/context/SharedGardenContext';
import { isMissingSortField, getActiveFilterCount } from '@/components/SortFilterControls';
import ItemGrid from '@/components/ItemGrid';
import styles from './page.module.css';

export default function SharedGardenPage() {
  const { gardenId, filteredPlants, plants, searchQuery, sort, filters } = useSharedGarden();

  const filterCount = getActiveFilterCount(filters);
  const hasActiveFilters = !!(searchQuery || filterCount > 0 || sort.key);

  const emptyMessage = hasActiveFilters
    ? 'No plants match your current filters.'
    : 'This garden has no plants yet.';

  return (
    <div className={styles.container}>
      <ItemGrid
        items={filteredPlants}
        emptyMessage={emptyMessage}
        linkPrefix={`/share/${gardenId}/plant`}
        getItemId={(p) => p.id}
        getItemImage={(p) => p.mainImage || '/placeholder-plant.jpg'}
        getItemName={(p) => p.commonName || p.scientificName}
        getItemStyle={(p) => ({ fontStyle: p.commonName ? 'normal' : 'italic' })}
        getItemDimmed={sort.key ? (p) => isMissingSortField(p, sort) : undefined}
      />
    </div>
  );
}