'use client';
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';
import { getGarden, updateGarden, updateGardenAbout, updateGardenTodo, updateGardenCustomization, deleteGarden, createPlant, getPlants, applyManualOrder } from '@/lib/dataService';
import { applySortAndFilter } from '@/components/SortFilterControls';

const GardenContext = createContext();

export function GardenProvider({ children }) {
  const { gardenId } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user, isInitialized } = useAuth();

  // Which tab's items are active — drives ordering, rearrange, and privacy.
  const activeType = pathname?.endsWith('/wildlife') ? 'wildlife' : 'plant';
  
  const [garden, setGarden] = useState(null);
  const [plants, setPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [plantsLoaded, setPlantsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [filters, setFilters] = useState({});
  const [wildlifeFilters, setWildlifeFilters] = useState({});
  const [previewCustomization, setPreviewCustomization] = useState(null);
  
  // Modal states
  const [showAddPlantModal, setShowAddPlantModal] = useState(false);
  const [showEditGardenModal, setShowEditGardenModal] = useState(false);
  const [showDeleteGardenModal, setShowDeleteGardenModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);

  // Rearrange mode (shared between layout and page so long-press can trigger it)
  const [rearrangeMode, setRearrangeMode] = useState(false);
  const [rearrangeDraft, setRearrangeDraft] = useState(null); // array of plant ids
  // When entered via long-press: the item id to auto-start dragging in the
  // rearrange-mode grid so the user doesn't have to press again.
  const [pendingDragId, setPendingDragId] = useState(null);

  // Load garden and plants data in two phases
  useEffect(() => {
    const loadData = async () => {
      if (!isInitialized || !gardenId) return;
      
      try {
        const gardenData = await getGarden(gardenId, user?.id);
        if (!gardenData) {
          router.push('/');
          return;
        }
        setGarden(gardenData);
        setIsLoading(false);

        const plantsData = await getPlants(gardenId, user?.id);
        setPlants(plantsData);
        setPlantsLoaded(true);
      } catch (e) {
        console.error('Failed to load garden:', e);
        router.push('/');
      }
    };
    
    loadData();
  }, [gardenId, user?.id, isInitialized, router]);

  // Garden actions
  const handleUpdateGarden = useCallback(async (updates) => {
    const updated = await updateGarden(gardenId, updates, user?.id);
    setGarden(updated);
    return updated;
  }, [gardenId, user?.id]);

  const handleUpdateGardenAbout = useCallback(async (aboutBlocks) => {
    const updated = await updateGardenAbout(gardenId, aboutBlocks, user?.id);
    setGarden(updated);
    return updated;
  }, [gardenId, user?.id]);

  const handleUpdateGardenTodo = useCallback(async (todoContent) => {
    const updated = await updateGardenTodo(gardenId, todoContent, user?.id);
    setGarden(updated);
    return updated;
  }, [gardenId, user?.id]);

  const handleUpdateGardenCustomization = useCallback(async (customization) => {
    const updated = await updateGardenCustomization(gardenId, customization, user?.id);
    setGarden(updated);
    return updated;
  }, [gardenId, user?.id]);

  const handleDeleteGarden = useCallback(async () => {
    await deleteGarden(gardenId, user?.id);
    router.push('/');
  }, [gardenId, user?.id, router]);

  const handleCreatePlant = useCallback(async (plantData) => {
    const newPlant = await createPlant({
      gardenId,
      ...plantData,
    }, user?.id);
    setPlants(prev => [...prev, newPlant]);
    return newPlant;
  }, [gardenId, user?.id]);

  const handleUpdatePlantInContext = useCallback((updatedPlant) => {
    setPlants(prev => prev.map(p => p.id === updatedPlant.id ? updatedPlant : p));
  }, []);

  const handleRemovePlantFromContext = useCallback((plantId) => {
    setPlants(prev => prev.filter(p => p.id !== plantId));
  }, []);

  const handleShare = useCallback(() => {
    if (!user) {
      setShowSignInModal(true);
      return;
    }
    setShowShareModal(true);
  }, [user]);

  // Split by type — wildlife are plants with type='wildlife' in the same table.
  const plantList = useMemo(() => plants.filter(p => p.type !== 'wildlife'), [plants]);
  const wildlifeList = useMemo(() => plants.filter(p => p.type === 'wildlife'), [plants]);

  // Apply manual rearrange order — this is the "no sort applied" default order.
  // While dragging in rearrange mode the draft drives display for the active tab
  // so swaps render live.
  const orderedPlants = useMemo(() => {
    if (rearrangeMode && rearrangeDraft && activeType === 'plant') {
      return applyManualOrder(plantList, rearrangeDraft);
    }
    return applyManualOrder(plantList, garden?.customization?.plantOrder);
  }, [plantList, garden?.customization?.plantOrder, rearrangeMode, rearrangeDraft, activeType]);

  const orderedWildlife = useMemo(() => {
    if (rearrangeMode && rearrangeDraft && activeType === 'wildlife') {
      return applyManualOrder(wildlifeList, rearrangeDraft);
    }
    return applyManualOrder(wildlifeList, garden?.customization?.wildlifeOrder);
  }, [wildlifeList, garden?.customization?.wildlifeOrder, rearrangeMode, rearrangeDraft, activeType]);

  const matchesSearch = (item) => {
    const query = searchQuery.toLowerCase();
    const commonName = (item.commonName || '').toLowerCase();
    const scientificName = (item.scientificName || '').toLowerCase();
    return commonName.includes(query) || scientificName.includes(query);
  };

  // Plants: filter by search, then apply sort & filters
  const searchFiltered = searchQuery.trim() ? orderedPlants.filter(matchesSearch) : orderedPlants;
  const filteredPlants = applySortAndFilter(searchFiltered, sort, filters);

  // Wildlife: search + a Native Range filter only (no sort on the wildlife tab)
  const searchFilteredWildlife = searchQuery.trim() ? orderedWildlife.filter(matchesSearch) : orderedWildlife;
  const filteredWildlife = applySortAndFilter(searchFilteredWildlife, { key: null, dir: 'asc' }, wildlifeFilters);

  // Items for the currently-active tab — used by the layout's privacy/rearrange grids.
  const activeItems = activeType === 'wildlife' ? orderedWildlife : orderedPlants;

  // Rearrange mode actions.
  // `dragId` (optional) — when entered via long-press on a tile, primes that
  // tile to auto-start dragging in the rearrange grid.
  const startRearrangeMode = useCallback((dragId) => {
    setRearrangeDraft(activeItems.map(p => p.id));
    setPendingDragId(typeof dragId === 'string' ? dragId : null);
    setRearrangeMode(true);
  }, [activeItems]);

  const cancelRearrangeMode = useCallback(() => {
    setRearrangeMode(false);
    setRearrangeDraft(null);
    setPendingDragId(null);
  }, []);

  const saveRearrangeMode = useCallback(async () => {
    if (rearrangeDraft) {
      const existing = garden?.customization || {};
      const orderKey = activeType === 'wildlife' ? 'wildlifeOrder' : 'plantOrder';
      await handleUpdateGardenCustomization({ ...existing, [orderKey]: rearrangeDraft });
    }
    setRearrangeMode(false);
    setRearrangeDraft(null);
    setPendingDragId(null);
  }, [rearrangeDraft, garden?.customization, handleUpdateGardenCustomization, activeType]);

  const value = {
    garden,
    gardenId,
    plants: orderedPlants,
    rawPlants: plants,
    filteredPlants,
    wildlife: orderedWildlife,
    filteredWildlife,
    hasWildlife: wildlifeList.length > 0,
    activeType,
    activeItems,
    isLoading,
    plantsLoaded,
    user,
    isInitialized,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    filters,
    setFilters,
    wildlifeFilters,
    setWildlifeFilters,

    // Actions
    updateGarden: handleUpdateGarden,
    updateGardenAbout: handleUpdateGardenAbout,
    updateGardenTodo: handleUpdateGardenTodo,
    updateGardenCustomization: handleUpdateGardenCustomization,
    deleteGarden: handleDeleteGarden,
    createPlant: handleCreatePlant,
    updatePlantInContext: handleUpdatePlantInContext,
    removePlantFromContext: handleRemovePlantFromContext,
    handleShare,
    
    // Modal controls
    showAddPlantModal,
    setShowAddPlantModal,
    showEditGardenModal,
    setShowEditGardenModal,
    showDeleteGardenModal,
    setShowDeleteGardenModal,
    showShareModal,
    setShowShareModal,
    showSignInModal,
    setShowSignInModal,
    showCustomizeModal,
    setShowCustomizeModal,
    previewCustomization,
    setPreviewCustomization,

    // Rearrange mode
    rearrangeMode,
    rearrangeDraft,
    setRearrangeDraft,
    pendingDragId,
    startRearrangeMode,
    cancelRearrangeMode,
    saveRearrangeMode,
  };

  return (
    <GardenContext.Provider value={value}>
      {children}
    </GardenContext.Provider>
  );
}

export const useGarden = () => {
  const context = useContext(GardenContext);
  if (!context) {
    throw new Error('useGarden must be used within a GardenProvider');
  }
  return context;
};