'use client';
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import localforage from 'localforage';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const router = useRouter();
  
  // Use ref to track the current session for the auth listener
  const sessionRef = useRef(null);

  // Sync user profile data to profiles table
  const syncUserProfile = useCallback(async (user) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          display_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          avatar_url: user.user_metadata?.avatar_url,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });
      
      if (error) {
        console.error('[Auth] Error syncing profile:', error);
      }
    } catch (err) {
      console.error('[Auth] Profile sync error:', err);
    }
  }, []);

  // Migrate local storage data to Supabase on first sign in
  const migrateLocalDataToSupabase = useCallback(async (userId) => {
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
  }, []);

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;
    let subscription = null;

    const init = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        // Check if component is still mounted before updating state
        if (!isMounted) return;
        
        sessionRef.current = initialSession;
        setSession(initialSession);
        setLoading(false);

        // If user is signed in, migrate local data and sync profile
        if (initialSession?.user) {
          // Sync profile to profiles table
          await syncUserProfile(initialSession.user);
          
          if (!isMounted) return;
          
          const hasMigrated = localStorage.getItem(`migrated_${initialSession.user.id}`);
          if (!hasMigrated) {
            setIsMigrating(true);
            await migrateLocalDataToSupabase(initialSession.user.id);
            if (!isMounted) return;
            localStorage.setItem(`migrated_${initialSession.user.id}`, 'true');
            setIsMigrating(false);
          }
        }

        if (!isMounted) return;
        setIsInitialized(true);

        // Listen for auth changes
        const { data } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (!isMounted) return;
          
          console.log('[Auth] Event:', event);
          
          if (event === 'SIGNED_IN') {
            const previousUserId = sessionRef.current?.user?.id;
            const newUserId = currentSession?.user?.id;
            
            // Sync profile on sign in
            if (currentSession?.user) {
              await syncUserProfile(currentSession.user);
            }
            
            if (!isMounted) return;
            
            if (newUserId && newUserId !== previousUserId) {
              const hasMigrated = localStorage.getItem(`migrated_${newUserId}`);
              if (!hasMigrated) {
                setIsMigrating(true);
                setSession(currentSession);
                sessionRef.current = currentSession;
                await migrateLocalDataToSupabase(newUserId);
                if (!isMounted) return;
                localStorage.setItem(`migrated_${newUserId}`, 'true');
                setIsMigrating(false);
              }
              if (!previousUserId) {
                router.push('/');
                router.refresh();
              }
            }
          }

          if (!isMounted) return;

          if (event === 'SIGNED_OUT') {
            router.push('/');
          }

          sessionRef.current = currentSession;
          setSession(currentSession);
        });

        subscription = data.subscription;
      } catch (error) {
        console.error('[Auth] Init error:', error);
        if (isMounted) {
          setLoading(false);
          setIsInitialized(true);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [router, syncUserProfile, migrateLocalDataToSupabase]);

  const signInWithGoogle = useCallback(async () => {
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
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
      sessionRef.current = null;
      setSession(null);
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
      sessionRef.current = null;
      setSession(null);
      router.push('/');
    }
  }, [router]);

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