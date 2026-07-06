'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getSharedGardenInfo, getSharedGardenPlants, applyManualOrder } from '@/lib/dataService';
import { applySortAndFilter } from '@/components/SortFilterControls';

const SharedGardenContext = createContext();

export function SharedGardenProvider({ children }) {
  const { gardenId } = useParams();
  
  const [garden, setGarden] = useState(null);
  const [plants, setPlants] = useState([]);
  const [owner, setOwner] = useState(null);
  const [gardenLoading, setGardenLoading] = useState(true);
  const [plantsLoaded, setPlantsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [filters, setFilters] = useState({});
  const [wildlifeFilters, setWildlifeFilters] = useState({});

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        // Phase 1: Load garden info + owner (fast, populates navbar)
        const info = await getSharedGardenInfo(gardenId);
        if (!isMounted) return;
        
        setGarden(info.garden);
        setOwner(info.owner);
        setGardenLoading(false);

        // Phase 2: Load plants (can be slower)
        const plantsList = await getSharedGardenPlants(gardenId);
        if (!isMounted) return;
        
        setPlants(plantsList);
        setPlantsLoaded(true);
      } catch (e) {
        if (!isMounted) return;
        console.error('Failed to load shared garden:', e);
        setError('Garden not found or no longer available.');
        setGardenLoading(false);
      }
    };

    loadData();

    return () => { isMounted = false; };
  }, [gardenId]);

  // Wildlife are plants with type='wildlife' in the same table — split them out.
  const plantList = plants.filter(p => p.type !== 'wildlife');
  const wildlifeList = plants.filter(p => p.type === 'wildlife');
  const hiddenPlantIds = garden?.customization?.hiddenPlantIds || [];
  const hideHidden = (items) => hiddenPlantIds.length > 0
    ? items.filter(p => !hiddenPlantIds.includes(p.id))
    : items;
  const matchesSearch = (item) => {
    const query = searchQuery.toLowerCase();
    const commonName = (item.commonName || '').toLowerCase();
    const scientificName = (item.scientificName || '').toLowerCase();
    return commonName.includes(query) || scientificName.includes(query);
  };

  // Plants: apply owner's manual order, drop hidden, then search + sort/filter.
  const orderedPlants = applyManualOrder(plantList, garden?.customization?.plantOrder);
  const visiblePlants = hideHidden(orderedPlants);
  const totalVisible = visiblePlants.length;
  const searchFiltered = searchQuery.trim() ? visiblePlants.filter(matchesSearch) : visiblePlants;
  const filteredPlants = applySortAndFilter(searchFiltered, sort, filters);

  // Wildlife: same visibility rules, but search only (no sort/filter on that tab).
  const orderedWildlife = applyManualOrder(wildlifeList, garden?.customization?.wildlifeOrder);
  const visibleWildlife = hideHidden(orderedWildlife);
  const totalVisibleWildlife = visibleWildlife.length;
  const hasVisibleWildlife = totalVisibleWildlife > 0;
  const searchFilteredWildlife = searchQuery.trim() ? visibleWildlife.filter(matchesSearch) : visibleWildlife;
  const filteredWildlife = applySortAndFilter(searchFilteredWildlife, { key: null, dir: 'asc' }, wildlifeFilters);

  // About block visibility (shown by default — only hidden when explicitly listed)
  const hiddenAboutBlockIds = garden?.customization?.hiddenAboutBlockIds || [];
  const visibleAboutBlocks = (garden?.aboutBlocks || []).filter(b =>
    !hiddenAboutBlockIds.includes(b.id) && (b.content || b.title)
  );
  const hasVisibleAbout = visibleAboutBlocks.length > 0;

  // Todo visibility (hidden by default — only visible when todoPrivate === false)
  const isTodoVisible = garden?.customization?.todoPrivate === false && !!garden?.todoContent;

  const value = {
    garden,
    gardenId,
    plants,
    filteredPlants,
    totalVisible,
    wildlife: orderedWildlife,
    filteredWildlife,
    totalVisibleWildlife,
    hasVisibleWildlife,
    owner,
    isLoading: gardenLoading,
    plantsLoaded,
    error,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    filters,
    setFilters,
    wildlifeFilters,
    setWildlifeFilters,
    // About/todo visibility
    visibleAboutBlocks,
    hasVisibleAbout,
    isTodoVisible,
  };

  return (
    <SharedGardenContext.Provider value={value}>
      {children}
    </SharedGardenContext.Provider>
  );
}

export const useSharedGarden = () => {
  const context = useContext(SharedGardenContext);
  if (!context) {
    throw new Error('useSharedGarden must be used within a SharedGardenProvider');
  }
  return context;
};