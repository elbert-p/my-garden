'use client';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { SharedGardenProvider, useSharedGarden } from '@/context/SharedGardenContext';
import { getActiveFilterCount, getActiveSortCount } from '@/components/SortFilterControls';
import NavBar from '@/components/NavBar';
import SortFilterControls from '@/components/SortFilterControls';
import styles from './layout.module.css';

const DEFAULT_CUSTOMIZATION = { columns: 4, bgColor: '#f4f4f9' };

function SharedGardenLayoutContent({ children }) {
  const { gardenId } = useParams();
  const pathname = usePathname();
  
  const { garden, owner, plants, filteredPlants, isLoading, plantsLoaded, error, searchQuery, setSearchQuery, sort, setSort, filters, setFilters } = useSharedGarden();

  // Determine active tab and content width
  const isAboutPage = pathname.endsWith('/about');
  const isPlantPage = pathname.includes('/plant/');
  
  // Plant pages use narrower content width
  const contentWidth = (isPlantPage || isAboutPage) ? 'medium' : 'large';

  // Tabs and search are always shown immediately (URLs use gardenId from params)
  const tabs = [
    { label: 'Plants', href: `/share/${gardenId}`, active: !isAboutPage },
    { label: 'About', href: `/share/${gardenId}/about`, active: isAboutPage },
  ];

  const customization = {
    ...DEFAULT_CUSTOMIZATION,
    ...garden?.customization,
  };

  // Error state - show after garden loading completes
  if (!isLoading && error) {
    return (
      <>
        <NavBar title="Not Found" showHome={true} contentWidth={contentWidth} />
        <div className={styles.container}>
          <p className={styles.message}>{error}</p>
          <Link href="/" className={styles.homeLink}>Go to My Gardens</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar
        title={garden?.name || ''}
        badge={plantsLoaded ? (() => {
          const filterCount = getActiveFilterCount(filters);
          const hasFilters = filterCount > 0 || !!searchQuery;
          if (hasFilters) {
            return `${filteredPlants.length} / ${plants.length}`;
          }
          const sortCount = getActiveSortCount(plants, sort);
          if (sortCount !== null && sortCount < plants.length) {
            return `${sortCount} / ${plants.length}`;
          }
          return plants.length;
        })() : null}
        showHome={true}
        tabs={tabs}
        showSearch={!isPlantPage && !isAboutPage}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search plants..."
        extraActions={!isPlantPage && !isAboutPage ? (
          <SortFilterControls
            sort={sort}
            onSortChange={setSort}
            filters={filters}
            onFiltersChange={setFilters}
          />
        ) : null}
        sharedBy={owner}
        contentWidth={contentWidth}
      />
        {!garden || (!plantsLoaded && !isPlantPage) ? (
          <div className={styles.container}>
            <p className={styles.loading}>Loading...</p>
          </div>
        ) : (
          <div
            className={styles.gardenBackground}
            style={{ backgroundColor: customization.bgColor }}
          >
            {children}
          </div>
        )}
    </>
  );
}

export default function SharedGardenLayout({ children }) {
  return (
    <SharedGardenProvider>
      <SharedGardenLayoutContent>
        {children}
      </SharedGardenLayoutContent>
    </SharedGardenProvider>
  );
}