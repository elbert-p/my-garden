'use client';
import { useState, useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiBookmark, FiCopy } from 'react-icons/fi';
import { SharedGardenProvider, useSharedGarden } from '@/context/SharedGardenContext';
import { getActiveFilterCount, getActiveSortCount } from '@/components/SortFilterControls';
import { useAuth } from '@/context/AuthContext';
import {
  saveGarden as saveGardenDb, unsaveGarden as unsaveGardenDb,
  isGardenSaved as isGardenSavedDb, recordGardenView,
} from '@/lib/dataService';
import {
  addLocalRecentlyViewed, addLocalSavedGarden,
  removeLocalSavedGarden, isLocalGardenSaved,
  setCopyGardenSource,
} from '@/lib/clipboardStorage';
import NavBar from '@/components/NavBar';
import SortFilterControls from '@/components/SortFilterControls';
import styles from './layout.module.css';

const DEFAULT_CUSTOMIZATION = { columns: 4, bgColor: '#f4f4f9' };

function SharedGardenLayoutContent({ children }) {
  const { gardenId } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  
  const {
    garden, owner, plants, filteredPlants, isLoading, plantsLoaded, error,
    searchQuery, setSearchQuery, sort, setSort, filters, setFilters,
  } = useSharedGarden();

  const [isSaved, setIsSaved] = useState(false);
  const [hasRecordedView, setHasRecordedView] = useState(false);

  const isAboutPage = pathname.endsWith('/about');
  const isPlantPage = pathname.includes('/plant/');
  const contentWidth = (isPlantPage || isAboutPage) ? 'medium' : 'large';

  // Record view when garden loads
  useEffect(() => {
    if (!garden || hasRecordedView) return;
    setHasRecordedView(true);
    addLocalRecentlyViewed(gardenId);
    if (user?.id) {
      recordGardenView(gardenId, user.id);
    }
  }, [garden, gardenId, user?.id, hasRecordedView]);

  // Check saved status
  useEffect(() => {
    if (!garden) return;
    if (user?.id) {
      isGardenSavedDb(gardenId, user.id).then(setIsSaved);
    } else {
      setIsSaved(isLocalGardenSaved(gardenId));
    }
  }, [garden, gardenId, user?.id]);

  const handleToggleSave = async () => {
    if (isSaved) {
      if (user?.id) await unsaveGardenDb(gardenId, user.id);
      else removeLocalSavedGarden(gardenId);
      setIsSaved(false);
    } else {
      if (user?.id) await saveGardenDb(gardenId, user.id);
      else addLocalSavedGarden(gardenId);
      setIsSaved(true);
    }
  };

  const handleCopyGarden = () => {
    if (!garden) return;
    setCopyGardenSource({
      gardenId: garden.id,
      name: garden.name,
      image: garden.image,
      isShared: true,
    });
    router.push('/');
  };

  const tabs = [
    { label: 'Plants', href: `/share/${gardenId}`, active: !isAboutPage },
    { label: 'About', href: `/share/${gardenId}/about`, active: isAboutPage },
  ];

  const menuItems = [
    { icon: <FiBookmark size={16} />, label: isSaved ? 'Unsave' : 'Save', onClick: handleToggleSave, variant: 'save' },
    { icon: <FiCopy size={16} />, label: 'Make a copy', onClick: handleCopyGarden },
  ];

  const customization = {
    ...DEFAULT_CUSTOMIZATION,
    ...garden?.customization,
  };

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
        menuItems={menuItems}
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