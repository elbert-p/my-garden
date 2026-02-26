'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getSharedProfileData } from '@/lib/dataService';

const SharedProfileContext = createContext();

export function SharedProfileProvider({ children }) {
  const { userId } = useParams();
  
  const [profile, setProfile] = useState(null);
  const [createdGardens, setCreatedGardens] = useState([]);
  const [savedGardens, setSavedGardens] = useState([]);
  const [recentGardens, setRecentGardens] = useState([]);
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