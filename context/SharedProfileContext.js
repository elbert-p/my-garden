'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getSharedProfileData, getSharedGardenPlants } from '@/lib/dataService';

const SharedProfileContext = createContext();

export function SharedProfileProvider({ children }) {
  const { userId } = useParams();
  
  const [profile, setProfile] = useState(null);
  const [createdGardens, setCreatedGardens] = useState([]);
  const [savedGardens, setSavedGardens] = useState([]);
  const [recentGardens, setRecentGardens] = useState([]);
  const [plantCounts, setPlantCounts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const data = await getSharedProfileData(userId);
        if (!isMounted) return;

        setProfile(data.profile);
        setCreatedGardens(data.createdGardens);
        setSavedGardens(data.savedGardens);
        setRecentGardens(data.recentGardens);
        setIsLoading(false);

        // Load visible plant counts in background
        const allGardens = [...data.createdGardens, ...data.savedGardens, ...data.recentGardens];
        const seen = new Set();
        const counts = {};
        for (const garden of allGardens) {
          if (seen.has(garden.id)) continue;
          seen.add(garden.id);
          try {
            const plants = await getSharedGardenPlants(garden.id);
            const hiddenIds = garden.customization?.hiddenPlantIds || [];
            counts[garden.id] = hiddenIds.length > 0
              ? plants.filter(p => !hiddenIds.includes(p.id)).length
              : plants.length;
          } catch { /* skip */ }
        }
        if (isMounted && Object.keys(counts).length > 0) {
          setPlantCounts(counts);
        }
      } catch (e) {
        if (!isMounted) return;
        console.error('Failed to load shared profile:', e);
        setError('Profile not found or no longer available.');
        setIsLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [userId]);

  const value = {
    userId,
    profile,
    createdGardens,
    savedGardens,
    recentGardens,
    plantCounts,
    isLoading,
    error,
  };

  return (
    <SharedProfileContext.Provider value={value}>
      {children}
    </SharedProfileContext.Provider>
  );
}

export const useSharedProfile = () => {
  const context = useContext(SharedProfileContext);
  if (!context) {
    throw new Error('useSharedProfile must be used within a SharedProfileProvider');
  }
  return context;
};