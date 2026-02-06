'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { getGarden, updateGarden, deleteGarden, createPlant, getPlants } from '@/lib/dataService';

const GardenContext = createContext();

export function GardenProvider({ children }) {
  const { gardenId } = useParams();
  const router = useRouter();
  const { user, isInitialized } = useAuth();
  
  const [garden, setGarden] = useState(null);
  const [plants, setPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showAddPlantModal, setShowAddPlantModal] = useState(false);
  const [showEditGardenModal, setShowEditGardenModal] = useState(false);
  const [showDeleteGardenModal, setShowDeleteGardenModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);

  // Load garden and plants data
  useEffect(() => {
    const loadData = async () => {
      if (!isInitialized || !gardenId) return;
      
      try {
        const gardenData = await getGarden(gardenId, user?.id);
        if (gardenData) {
          setGarden(gardenData);
          const plantsData = await getPlants(gardenId, user?.id);
          setPlants(plantsData);
        } else {
          router.push('/');
        }
      } catch (e) {
        console.error('Failed to load garden:', e);
        router.push('/');
      } finally {
        setIsLoading(false);
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

  const handleShare = useCallback(() => {
    if (!user) {
      setShowSignInModal(true);
      return;
    }
    setShowShareModal(true);
  }, [user]);

  // Filter plants based on search
  const filteredPlants = searchQuery.trim()
    ? plants.filter(plant => {
        const query = searchQuery.toLowerCase();
        const commonName = (plant.commonName || '').toLowerCase();
        const scientificName = (plant.scientificName || '').toLowerCase();
        return commonName.includes(query) || scientificName.includes(query);
      })
    : plants;

  const value = {
    garden,
    gardenId,
    plants,
    filteredPlants,
    isLoading,
    user,
    isInitialized,
    searchQuery,
    setSearchQuery,
    
    // Actions
    updateGarden: handleUpdateGarden,
    deleteGarden: handleDeleteGarden,
    createPlant: handleCreatePlant,
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