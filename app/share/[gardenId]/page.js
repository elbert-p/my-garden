'use client';
import { useSharedGarden } from '@/context/SharedGardenContext';
import { isMissingSortField, getActiveFilterCount, getSortGroups } from '@/components/SortFilterControls';
import ItemGrid from '@/components/ItemGrid';
import PlantBadges from '@/components/PlantBadges';
import styles from './page.module.css';

export default function SharedGardenPage() {
  const { garden, gardenId, filteredPlants, searchQuery, sort, filters, totalVisible } = useSharedGarden();

  const filterCount = getActiveFilterCount(filters);
  const hasActiveFilters = !!(searchQuery || filterCount > 0 || sort.key);
  const sortGroups = getSortGroups(filteredPlants, sort);
  const columns = garden?.customization?.columns;

  const emptyMessage = hasActiveFilters
    ? 'No plants match your current filters.'
    : 'This garden has no plants yet.';

  return (
    <div className={styles.container}>
      <ItemGrid
        items={filteredPlants}
        sortGroups={sortGroups}
        emptyMessage={emptyMessage}
        linkPrefix={`/share/${gardenId}/plant`}
        getItemId={(p) => p.id}
        getItemImage={(p) => p.mainImage || '/placeholder-plant.jpg'}
        getItemName={(p) => p.commonName || p.scientificName}
        getItemStyle={(p) => ({ fontStyle: p.commonName ? 'normal' : 'italic' })}
        renderOverlay={(p) => <PlantBadges commonName={p.commonName} scientificName={p.scientificName} />}
        getItemDimmed={sort.key ? (p) => isMissingSortField(p, sort) : undefined}
        columns={columns}
      />
    </div>
  );
}