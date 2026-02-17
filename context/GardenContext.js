'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { getGarden, updateGarden, updateGardenAbout, deleteGarden, createPlant, getPlants } from '@/lib/dataService';
import { applySortAndFilter } from '@/components/SortFilterControls';

const GardenContext = createContext();

export function GardenProvider({ children }) {
  const { gardenId } = useParams();
  const router = useRouter();
  const { user, isInitialized } = useAuth();
  
  const [garden, setGarden] = useState(null);
  const [plants, setPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [plantsLoaded, setPlantsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [filters, setFilters] = useState({});
  
  // Modal states
  const [showAddPlantModal, setShowAddPlantModal] = useState(false);
  const [showEditGardenModal, setShowEditGardenModal] = useState(false);
  const [showDeleteGardenModal, setShowDeleteGardenModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);

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

  // Filter by search, then apply sort & filters
  const searchFiltered = searchQuery.trim()
    ? plants.filter(plant => {
        const query = searchQuery.toLowerCase();
        const commonName = (plant.commonName || '').toLowerCase();
        const scientificName = (plant.scientificName || '').toLowerCase();
        return commonName.includes(query) || scientificName.includes(query);
      })
    : plants;
  
  const filteredPlants = applySortAndFilter(searchFiltered, sort, filters);

  const value = {
    garden,
    gardenId,
    plants,
    filteredPlants,
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
    
    // Actions
    updateGarden: handleUpdateGarden,
    updateGardenAbout: handleUpdateGardenAbout,
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