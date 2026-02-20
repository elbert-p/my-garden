'use client';
import { useGarden } from '@/context/GardenContext';
import { isMissingSortField, getActiveFilterCount, getSortGroups } from '@/components/SortFilterControls';
import ItemGrid from '@/components/ItemGrid';
import styles from './page.module.css';
import { FiMenu } from 'react-icons/fi';

export default function GardenPage() {
  const { gardenId, filteredPlants, plants, searchQuery, sort, filters, garden, previewCustomization } = useGarden();

  const hasActiveFilters = !!(getActiveFilterCount(filters) > 0);
  const sortGroups = getSortGroups(filteredPlants, sort);
  const columns = previewCustomization?.columns ?? garden?.customization?.columns;

  const emptyMessage = searchQuery
    ? 'No plants match your current search.'
    : hasActiveFilters
    ? 'No plants match your current filters.'
    : <>No plants in this garden yet. Click the menu <FiMenu size={20} style={{ verticalAlign: 'text-bottom', display: 'inline-block', margin: '0 2px' }} /> to add one!</>;

  return (
    <div className={styles.container}>
      <ItemGrid
        items={filteredPlants}
        sortGroups={sortGroups}
        emptyMessage={emptyMessage}
        linkPrefix={`/garden/${gardenId}/plant`}
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