'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getSharedGardenInfo, getSharedGardenPlants } from '@/lib/dataService';
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