'use client';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import localforage from 'localforage';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const initializedRef = useRef(false);
  const router = useRouter();

  // Initialize auth state
  useEffect(() => {
    let subscription;

    const init = async () => {
      if (initializedRef.current) return;
      initializedRef.current = true;

      const { data: { session: initialSession } } = await supabase.auth.getSession();
      setSession(initialSession);
      setLoading(false);

      // If user just signed in, migrate local data
      if (initialSession?.user) {
        const hasMigrated = localStorage.getItem(`migrated_${initialSession.user.id}`);
        if (!hasMigrated) {
          setIsMigrating(true);
          await migrateLocalDataToSupabase(initialSession.user.id);
          localStorage.setItem(`migrated_${initialSession.user.id}`, 'true');
          setIsMigrating(false);
        }
      }

      setIsInitialized(true);

      // Listen for auth changes
      const { data } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        console.log('[Auth] Event:', event);
        
        if (event === 'SIGNED_IN') {
          const previousUserId = session?.user?.id;
          const newUserId = currentSession?.user?.id;
          
          if (newUserId && newUserId !== previousUserId) {
            const hasMigrated = localStorage.getItem(`migrated_${newUserId}`);
            if (!hasMigrated) {
              setIsMigrating(true);
              setSession(currentSession); // Update session first so UI knows user is signed in
              await migrateLocalDataToSupabase(newUserId);
              localStorage.setItem(`migrated_${newUserId}`, 'true');
              setIsMigrating(false);
            }
            if (!previousUserId) {
              router.push('/');
              router.refresh();
            }
          }
        }

        if (event === 'SIGNED_OUT') {
          router.push('/');
        }

        setSession(currentSession);
      });

      subscription = data.subscription;
    };

    init();

    return () => {
      subscription?.unsubscribe();
    };
  }, [router, session?.user?.id]);

  // Migrate local storage data to Supabase on first sign in
  const migrateLocalDataToSupabase = async (userId) => {
    try {
      console.log('[Auth] Starting migration of local data...');
      
      const localGardens = (await localforage.getItem('gardens')) || [];
      const localPlants = (await localforage.getItem('plants')) || [];

      if (localGardens.length === 0 && localPlants.length === 0) {
        console.log('[Auth] No local data to migrate');
        return;
      }

      const { data: existingGardens } = await supabase
        .from('gardens')
        .select('id')
        .eq('user_id', userId);

      if (existingGardens && existingGardens.length > 0) {
        console.log('[Auth] User already has data in Supabase, skipping migration');
        return;
      }

      const gardenIdMap = {};

      for (const garden of localGardens) {
        const { data: newGarden, error } = await supabase
          .from('gardens')
          .insert({
            user_id: userId,
            name: garden.name,
            image: garden.image,
          })
          .select()
          .single();

        if (error) {
          console.error('[Auth] Error migrating garden:', error);
          continue;
        }

        gardenIdMap[garden.id] = newGarden.id;
      }

      for (const plant of localPlants) {
        const newGardenId = gardenIdMap[plant.gardenId];
        if (!newGardenId) {
          console.warn('[Auth] No matching garden for plant:', plant.id);
          continue;
        }

        const { error } = await supabase
          .from('plants')
          .insert({
            user_id: userId,
            garden_id: newGardenId,
            common_name: plant.commonName,
            scientific_name: plant.scientificName,
            main_image: plant.mainImage,
            date_planted: plant.datePlanted || null,
            bloom_time: plant.bloomTime || [],
            height: plant.height,
            sunlight: plant.sunlight || [],
            moisture: plant.moisture || [],
            native_range: plant.nativeRange || [],
            notes: plant.notes,
            images: plant.images || [],
            has_autofilled: plant.hasAutofilled || false,
          });

        if (error) {
          console.error('[Auth] Error migrating plant:', error);
        }
      }

      console.log('[Auth] Migration complete!');
    } catch (err) {
      console.error('[Auth] Migration error:', err);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
      setSession(null);
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
      setSession(null);
      router.push('/');
    }
  };

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    isInitialized,
    isMigrating,
    isAuthenticated: !!session?.user,
    signInWithGoogle,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};