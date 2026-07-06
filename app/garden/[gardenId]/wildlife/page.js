'use client';
import { useGarden } from '@/context/GardenContext';
import { getWildlifeDisplay } from '@/lib/dataService';
import ItemGrid from '@/components/ItemGrid';
import PlantBadges from '@/components/PlantBadges';
import styles from '../page.module.css';
import { FiMenu } from 'react-icons/fi';

export default function WildlifePage() {
  const { gardenId, filteredWildlife, searchQuery, garden, previewCustomization, startRearrangeMode } = useGarden();

  const wildlifeDisplay = getWildlifeDisplay(garden?.customization);
  const columns = previewCustomization?.columns ?? wildlifeDisplay.columns;
  const hideBadges = previewCustomization?.hideBadges ?? wildlifeDisplay.hideBadges;

  const emptyMessage = searchQuery
    ? 'No wildlife match your current search.'
    : <>No wildlife in this garden yet. Click the menu <FiMenu size={20} style={{ verticalAlign: 'text-bottom', display: 'inline-block', margin: '0 2px' }} /> to add one!</>;

  return (
    <div className={styles.container}>
      <ItemGrid
        items={filteredWildlife}
        emptyMessage={emptyMessage}
        linkPrefix={`/garden/${gardenId}/plant`}
        getItemId={(w) => w.id}
        getItemImage={(w) => w.mainImage || '/placeholder-plant.jpg'}
        fallbackImage="/placeholder-plant.jpg"
        getItemName={(w) => w.commonName || w.scientificName}
        getItemStyle={(w) => ({ fontStyle: w.commonName ? 'normal' : 'italic' })}
        renderOverlay={hideBadges ? undefined : (w) => <PlantBadges commonName={w.commonName} scientificName={w.scientificName} />}
        columns={columns}
        onLongPress={(id) => startRearrangeMode(id)}
      />
    </div>
  );
}
