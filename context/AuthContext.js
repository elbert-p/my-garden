'use client';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import localforage from 'localforage';
import { clearAllCaches } from '@/lib/dataService';
import { uploadImage } from '@/lib/imageStorage';

const AuthContext = createContext();

/**
 * AuthProvider - Robust auth handling inspired by working pattern
 * 
 * Key improvements:
 * 1. Uses prevUserId in localStorage to track user across reloads
 * 2. Handles INITIAL_SESSION separately from SIGNED_IN
 * 3. Properly ignores AbortError from interrupted requests
 * 4. Doesn't block on profile sync - does it in background
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const router = useRouter();
  
  const prevUserIdRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let authSubscription = null;

    const init = async () => {
      try {
        // Read previously known user from localStorage
        const storedPrevUserId = localStorage.getItem('garden_prevUserId');
        prevUserIdRef.current = storedPrevUserId;

        // Get current session BEFORE attaching listener
        const { data: { session: initialSession }, error: initError } = 
          await supabase.auth.getSession();

        if (!isMounted) return;

        if (initError) {
          // Ignore abort errors
          if (initError.message?.includes('AbortError') || initError.name === 'AbortError') {
            return;
          }
          console.error('[Auth] Error getting initial session:', initError);
        }

        setSession(initialSession);
        setLoading(false);

        // Handle initial session if user is signed in
        if (initialSession?.user) {
          const newUserId = initialSession.user.id;
          
          // Only do migration/sync if this is a DIFFERENT user than before
          if (newUserId !== storedPrevUserId) {
            await handleNewUser(initialSession.user, isMounted);
          }
          
          // Persist current user
          prevUserIdRef.current = newUserId;
          localStorage.setItem('garden_prevUserId', newUserId);
        }

        if (!isMounted) return;
        setIsInitialized(true);

        // Now attach the listener - ignore INITIAL_SESSION since we handled it
        const { data } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (!isMounted) return;

          // Skip INITIAL_SESSION - we already handled it above
          if (event === 'INITIAL_SESSION') {
            return;
          }

          if (event === 'SIGNED_IN' && currentSession?.user) {
            const newUserId = currentSession.user.id;
            
            // Only process if it's a different user
            if (newUserId !== prevUserIdRef.current) {
              await handleNewUser(currentSession.user, isMounted);
              
              prevUserIdRef.current = newUserId;
              localStorage.setItem('garden_prevUserId', newUserId);
              
              // Redirect to home after new sign in
              if (!prevUserIdRef.current) {
                router.push('/');
                router.refresh();
              }
            }
          }

          if (event === 'SIGNED_OUT') {
            prevUserIdRef.current = null;
            localStorage.removeItem('garden_prevUserId');
            clearAllCaches(); // Clear data cache on sign out
            router.push('/');
          }

          if (isMounted) {
            setSession(currentSession);
          }
        });

        authSubscription = data.subscription;

      } catch (error) {
        // Ignore abort errors completely
        if (error?.message?.includes('AbortError') || error?.name === 'AbortError') {
          return;
        }
        console.error('[Auth] Init error:', error);
        if (isMounted) {
          setLoading(false);
          setIsInitialized(true);
        }
      }
    };

    /**
     * Handle a new user signing in
     * - Sync profile to profiles table (non-blocking)
     * - Migrate local data if needed
     */
    async function handleNewUser(user, mounted) {
      // Sync profile in background - don't await
      syncUserProfile(user);

      // Check if migration is needed
      const hasMigrated = localStorage.getItem(`garden_migrated_${user.id}`);
      if (!hasMigrated && mounted) {
        setIsMigrating(true);
        await migrateLocalDataToSupabase(user.id);
        if (mounted) {
          localStorage.setItem(`garden_migrated_${user.id}`, 'true');
          setIsMigrating(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
      authSubscription?.unsubscribe();
    };
  }, [router]);

  // Sync user profile to profiles table - fire and forget
  const syncUserProfile = async (user) => {
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
        // Ignore abort errors
        if (error.message?.includes('AbortError') || error.name === 'AbortError') {
          return;
        }
        console.error('[Auth] Error syncing profile:', error);
      }
    } catch (err) {
      if (err?.message?.includes('AbortError') || err?.name === 'AbortError') {
        return;
      }
      console.error('[Auth] Profile sync error:', err);
    }
  };

  /**
   * Helper: upload a single image (data URL) to Supabase Storage.
   * Returns the public URL, or the original value if it's not a data URL
   * or if the upload fails.
   */
  const safeUploadImage = async (dataUrl, userId, folder) => {
    if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
    try {
      return await uploadImage(dataUrl, userId, folder);
    } catch (err) {
      console.error('[Auth] Image upload failed during migration:', err);
      return dataUrl; // fall back to keeping the data URL
    }
  };

  // Migrate local storage data to Supabase
  const migrateLocalDataToSupabase = async (userId) => {
    try {
      // Migrate profile about blocks
      const localProfileBlocks = await localforage.getItem('profileAboutBlocks');
      if (localProfileBlocks?.length > 0) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('about_blocks')
          .eq('id', userId)
          .single();

        if (!existing?.about_blocks?.length) {
          await supabase
            .from('profiles')
            .update({ about_blocks: localProfileBlocks })
            .eq('id', userId);
        }
        await localforage.removeItem('profileAboutBlocks');
      }

      const localGardens = (await localforage.getItem('gardens')) || [];
      const localPlants = (await localforage.getItem('plants')) || [];

      if (localGardens.length === 0 && localPlants.length === 0) {
        return;
      }

      // Check if user already has data
      const { data: existingGardens, error: checkError } = await supabase
        .from('gardens')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (checkError) {
        if (checkError.message?.includes('AbortError')) return;
        console.error('[Auth] Error checking existing gardens:', checkError);
        return;
      }

      if (existingGardens && existingGardens.length > 0) {
        return; // User already has data, skip migration
      }

      const gardenIdMap = {};

      for (const garden of localGardens) {
        // Upload garden image to storage instead of storing base64
        const imageUrl = await safeUploadImage(garden.image, userId, 'gardens');

        const { data: newGarden, error } = await supabase
          .from('gardens')
          .insert({
            user_id: userId,
            name: garden.name,
            image: imageUrl,
          })
          .select()
          .single();

        if (error) {
          if (error.message?.includes('AbortError')) return;
          console.error('[Auth] Error migrating garden:', error);
          continue;
        }

        gardenIdMap[garden.id] = newGarden.id;
      }

      for (const plant of localPlants) {
        const newGardenId = gardenIdMap[plant.gardenId];
        if (!newGardenId) continue;

        // Upload plant images to storage
        const mainImageUrl = await safeUploadImage(plant.mainImage, userId, 'plants');

        let galleryUrls = plant.images || [];
        if (galleryUrls.length > 0) {
          galleryUrls = await Promise.all(
            galleryUrls.map(img => safeUploadImage(img, userId, 'plants'))
          );
        }

        const { error } = await supabase
          .from('plants')
          .insert({
            user_id: userId,
            garden_id: newGardenId,
            common_name: plant.commonName,
            scientific_name: plant.scientificName,
            main_image: mainImageUrl,
            date_planted: plant.datePlanted || null,
            bloom_time: plant.bloomTime || [],
            height: plant.height,
            sunlight: plant.sunlight || [],
            moisture: plant.moisture || [],
            native_range: plant.nativeRange || [],
            notes: plant.notes,
            images: galleryUrls,
            has_autofilled: plant.hasAutofilled || false,
          });

        if (error) {
          if (error.message?.includes('AbortError')) return;
          console.error('[Auth] Error migrating plant:', error);
        }
      }

      console.log('[Auth] Migration complete!');
    } catch (err) {
      if (err?.message?.includes('AbortError') || err?.name === 'AbortError') {
        return;
      }
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
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
    // Always clean up local state regardless of Supabase response
    prevUserIdRef.current = null;
    localStorage.removeItem('garden_prevUserId');
    clearAllCaches();
    setSession(null);
    router.push('/');
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