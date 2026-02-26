'use client';
import { useMemo } from 'react';
import { useSharedGarden } from '@/context/SharedGardenContext';
import { isMissingSortField, getActiveFilterCount, getSortGroups } from '@/components/SortFilterControls';
import ItemGrid from '@/components/ItemGrid';
import styles from './page.module.css';

export default function SharedGardenPage() {
  const { garden, gardenId, filteredPlants, plants, searchQuery, sort, filters } = useSharedGarden();

  // Filter out hidden plants
  const hiddenPlantIds = garden?.customization?.hiddenPlantIds || [];
  const visiblePlants = useMemo(
    () => filteredPlants.filter(p => !hiddenPlantIds.includes(p.id)),
    [filteredPlants, hiddenPlantIds]
  );
  const totalVisible = useMemo(
    () => plants.filter(p => !hiddenPlantIds.includes(p.id)).length,
    [plants, hiddenPlantIds]
  );

  const filterCount = getActiveFilterCount(filters);
  const hasActiveFilters = !!(searchQuery || filterCount > 0 || sort.key);
  const sortGroups = getSortGroups(visiblePlants, sort);
  const columns = garden?.customization?.columns;

  const emptyMessage = hasActiveFilters
    ? 'No plants match your current filters.'
    : 'This garden has no plants yet.';

  return (
    <div className={styles.container}>
      <ItemGrid
        items={visiblePlants}
        sortGroups={sortGroups}
        emptyMessage={emptyMessage}
        linkPrefix={`/share/${gardenId}/plant`}
        getItemId={(p) => p.id}
        getItemImage={(p) => p.mainImage || '/placeholder-plant.jpg'}
        getItemName={(p) => p.commonName || p.scientificName}
        getItemStyle={(p) => ({ fontStyle: p.commonName ? 'normal' : 'italic' })}
        getItemDimmed={sort.key ? (p) => isMissingSortField(p, sort) : undefined}
        columns={columns}
      />
    </div>
  );
}