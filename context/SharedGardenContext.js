'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getSharedGarden } from '@/lib/dataService';

const SharedGardenContext = createContext();

export function SharedGardenProvider({ children }) {
  const { gardenId } = useParams();
  
  const [garden, setGarden] = useState(null);
  const [plants, setPlants] = useState([]);
  const [owner, setOwner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const data = await getSharedGarden(gardenId);
        
        if (!isMounted || !data) return;
        
        setGarden(data.garden);
        setPlants(data.plants);
        setOwner(data.owner);
      } catch (e) {
        if (!isMounted) return;
        console.error('Failed to load shared garden:', e);
        setError('Garden not found or no longer available.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => { isMounted = false; };
  }, [gardenId]);

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
    owner,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
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