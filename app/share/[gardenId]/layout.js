'use client';
import { useState, useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiBookmark, FiCopy } from 'react-icons/fi';
import { SharedGardenProvider, useSharedGarden } from '@/context/SharedGardenContext';
import { getActiveFilterCount, getActiveSortCount, MULTI_FILTER_CATEGORIES } from '@/components/SortFilterControls';
import { useAuth } from '@/context/AuthContext';
import {
  saveGarden as saveGardenDb, unsaveGarden as unsaveGardenDb,
  isGardenSaved as isGardenSavedDb, recordGardenView,
  getPlantDisplay, getWildlifeDisplay,
} from '@/lib/dataService';
import {
  addLocalRecentlyViewed, addLocalSavedGarden,
  removeLocalSavedGarden, isLocalGardenSaved,
  setCopyGardenSource,
} from '@/lib/clipboardStorage';
import NavBar from '@/components/NavBar';
import SortFilterControls from '@/components/SortFilterControls';
import styles from './layout.module.css';

// The wildlife tab exposes only a Native Range filter (no sort).
const WILDLIFE_FILTER_CATEGORIES = MULTI_FILTER_CATEGORIES.filter(c => c.key === 'nativeRange');

function SharedGardenLayoutContent({ children }) {
  const { gardenId } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  
  const {
    garden, owner, filteredPlants, totalVisible, isLoading, plantsLoaded, error,
    wildlife, filteredWildlife, totalVisibleWildlife, hasVisibleWildlife,
    searchQuery, setSearchQuery, sort, setSort, filters, setFilters,
    wildlifeFilters, setWildlifeFilters,
    hasVisibleAbout, isTodoVisible,
  } = useSharedGarden();

  const [isSaved, setIsSaved] = useState(false);
  const [hasRecordedView, setHasRecordedView] = useState(false);

  const isAboutPage = pathname.endsWith('/about');
  const isTodoPage = pathname.endsWith('/todo');
  const isWildlifePage = pathname.endsWith('/wildlife');
  const isPlantPage = pathname.includes('/plant/');
  const isSubPage = isPlantPage || isAboutPage || isTodoPage;
  const contentWidth = isSubPage ? 'medium' : 'large';

  // The plant detail route is reused for wildlife — highlight the Wildlife tab
  // when viewing a wildlife detail page.
  const currentItemId = isPlantPage ? pathname.split('/plant/')[1]?.split('/')[0] : null;
  const isWildlifeDetail = !!currentItemId && wildlife.some(w => w.id === currentItemId);
  const onWildlife = isWildlifePage || isWildlifeDetail;

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

  // Build tabs conditionally based on content visibility
  const tabs = [
    { label: 'Plants', href: `/share/${gardenId}`, active: !isAboutPage && !isTodoPage && !onWildlife },
    hasVisibleWildlife && { label: 'Wildlife', href: `/share/${gardenId}/wildlife`, active: onWildlife },
    hasVisibleAbout && { label: 'About', href: `/share/${gardenId}/about`, active: isAboutPage },
    isTodoVisible && { label: 'To-Do', href: `/share/${gardenId}/todo`, active: isTodoPage },
  ].filter(Boolean);

  const menuItems = [
    { icon: <FiBookmark size={16} fill={isSaved ? '#FFC107' : 'none'} color={isSaved ? '#FFC107' : 'currentColor'} />, 
      label: isSaved ? 'Unsave' : 'Save', onClick: handleToggleSave, variant: 'save' },
    { icon: <FiCopy size={16} />, label: 'Make a copy', onClick: handleCopyGarden },
  ];

  const activeBgColor = onWildlife
    ? getWildlifeDisplay(garden?.customization).bgColor
    : getPlantDisplay(garden?.customization).bgColor;

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
          // About / To-Do: show the whole garden's total (plants + wildlife).
          if (isAboutPage || isTodoPage) return totalVisible + totalVisibleWildlife;
          if (isWildlifePage) {
            const hasWildlifeFilters = getActiveFilterCount(wildlifeFilters) > 0 || !!searchQuery;
            if (hasWildlifeFilters) return `${filteredWildlife.length} / ${totalVisibleWildlife}`;
            return totalVisibleWildlife;
          }
          if (isWildlifeDetail) return totalVisibleWildlife;
          const filterCount = getActiveFilterCount(filters);
          const hasFilters = filterCount > 0 || !!searchQuery;
          if (hasFilters) {
            return `${filteredPlants.length} / ${totalVisible}`;
          }
          const sortCount = getActiveSortCount(filteredPlants, sort);
          if (sortCount !== null && sortCount < totalVisible) {
            return `${sortCount} / ${totalVisible}`;
          }
          return totalVisible;
        })() : null}
        showHome={true}
        tabs={tabs}
        showSearch={!isSubPage}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={isWildlifePage ? 'Search wildlife...' : 'Search plants...'}
        extraActions={(!isSubPage && isWildlifePage) ? (
          <SortFilterControls
            sort={{ key: null, dir: 'asc' }}
            onSortChange={() => {}}
            filters={wildlifeFilters}
            onFiltersChange={setWildlifeFilters}
            enableSort={false}
            enableDate={false}
            enableHeight={false}
            enableBadges={false}
            multiCategories={WILDLIFE_FILTER_CATEGORIES}
          />
        ) : (!isSubPage) ? (
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
          style={{ backgroundColor: activeBgColor }}
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