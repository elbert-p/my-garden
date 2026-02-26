import { supabase } from './supabaseClient';
import localforage from 'localforage';

const DEFAULT_GARDEN_IMAGE = '/default-garden.jpg';

/**
 * In-memory cache for Supabase data
 * Cleared on page reload, persists across navigation
 */
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

const cache = {
  gardens: null,              // { userId, data, timestamp }
  gardenDetails: new Map(),   // gardenId -> { data, timestamp }
  plants: new Map(),          // gardenId -> { data, timestamp }
  plantDetails: new Map(),    // plantId -> { data, timestamp }
  sharedGardens: new Map(),   // gardenId -> { garden, plants, owner, timestamp }
  sharedPlants: new Map(),    // plantId -> { plant, owner, timestamp }
  profiles: new Map(),        // userId -> { data, timestamp }
};

// Track background preload status
let preloadPromise = null;

// Helper: check if error is an AbortError
const isAbortError = (error) => {
  if (!error) return false;
  return error.name === 'AbortError' || 
         error.message?.includes('AbortError') ||
         error.code === 'ABORT_ERR';
};

// Helper: safely execute Supabase query, returning null on abort
const safeQuery = async (queryFn) => {
  try {
    return await queryFn();
  } catch (error) {
    if (isAbortError(error)) return null;
    throw error;
  }
};

const isCacheValid = (entry) => entry && (Date.now() - entry.timestamp < CACHE_MAX_AGE_MS);

// ============ CACHE HELPERS ============

const updateGardenInCache = (gardenId, updatedGarden) => {
  const now = Date.now();
  cache.gardenDetails.set(gardenId, { data: updatedGarden, timestamp: now });
  
  if (cache.gardens?.data) {
    cache.gardens.data = cache.gardens.data.map(g => g.id === gardenId ? updatedGarden : g);
    cache.gardens.timestamp = now;
  }
  
  const shared = cache.sharedGardens.get(gardenId);
  if (shared) {
    cache.sharedGardens.set(gardenId, { ...shared, garden: updatedGarden, timestamp: now });
  }
};

const updatePlantInCache = (plantId, updatedPlant) => {
  const now = Date.now();
  cache.plantDetails.set(plantId, { data: updatedPlant, timestamp: now });
  
  const gardenId = updatedPlant.gardenId;
  if (gardenId) {
    const plantsCached = cache.plants.get(gardenId);
    if (plantsCached?.data) {
      cache.plants.set(gardenId, {
        data: plantsCached.data.map(p => p.id === plantId ? updatedPlant : p),
        timestamp: now,
      });
    }
    
    const sharedPlant = cache.sharedPlants.get(plantId);
    if (sharedPlant) {
      cache.sharedPlants.set(plantId, { ...sharedPlant, plant: updatedPlant, timestamp: now });
    }
    
    const sharedGarden = cache.sharedGardens.get(gardenId);
    if (sharedGarden?.plants) {
      cache.sharedGardens.set(gardenId, {
        ...sharedGarden,
        plants: sharedGarden.plants.map(p => p.id === plantId ? updatedPlant : p),
        timestamp: now,
      });
    }
  }
};

const addGardenToCache = (newGarden) => {
  const now = Date.now();
  cache.gardenDetails.set(newGarden.id, { data: newGarden, timestamp: now });
  if (cache.gardens?.data) {
    cache.gardens.data = [...cache.gardens.data, newGarden];
    cache.gardens.timestamp = now;
  }
};

const addPlantToCache = (newPlant) => {
  const now = Date.now();
  cache.plantDetails.set(newPlant.id, { data: newPlant, timestamp: now });
  
  const gardenId = newPlant.gardenId;
  if (gardenId) {
    const plantsCached = cache.plants.get(gardenId);
    if (plantsCached?.data) {
      cache.plants.set(gardenId, { data: [...plantsCached.data, newPlant], timestamp: now });
    }
    
    const sharedGarden = cache.sharedGardens.get(gardenId);
    if (sharedGarden?.plants) {
      cache.sharedGardens.set(gardenId, {
        ...sharedGarden,
        plants: [...sharedGarden.plants, newPlant],
        timestamp: now,
      });
    }
  }
};

const removeGardenFromCache = (gardenId) => {
  cache.gardenDetails.delete(gardenId);
  cache.sharedGardens.delete(gardenId);
  cache.plants.delete(gardenId);
  
  if (cache.gardens?.data) {
    cache.gardens.data = cache.gardens.data.filter(g => g.id !== gardenId);
  }
  
  for (const [plantId, entry] of cache.plantDetails.entries()) {
    if (entry.data?.gardenId === gardenId) {
      cache.plantDetails.delete(plantId);
      cache.sharedPlants.delete(plantId);
    }
  }
};

const removePlantFromCache = (plantId, gardenId) => {
  cache.plantDetails.delete(plantId);
  cache.sharedPlants.delete(plantId);
  
  if (gardenId) {
    const plantsCached = cache.plants.get(gardenId);
    if (plantsCached?.data) {
      cache.plants.set(gardenId, {
        ...plantsCached,
        data: plantsCached.data.filter(p => p.id !== plantId),
      });
    }
    
    const sharedGarden = cache.sharedGardens.get(gardenId);
    if (sharedGarden?.plants) {
      cache.sharedGardens.set(gardenId, {
        ...sharedGarden,
        plants: sharedGarden.plants.filter(p => p.id !== plantId),
      });
    }
  }
};

// ============ DATA CONVERTERS ============

const gardenFromSupabase = (row) => ({
  id: row.id,
  name: row.name,
  image: row.image || DEFAULT_GARDEN_IMAGE,
  createdAt: row.created_at,
  userId: row.user_id,
  aboutBlocks: row.about_blocks || [],
  todoContent: row.todo_content || '',
  customization: row.customization || {}
});

const gardenToSupabase = (garden, userId) => ({
  user_id: userId,
  name: garden.name,
  image: garden.image,
});

const plantFromSupabase = (row) => ({
  id: row.id,
  gardenId: row.garden_id,
  userId: row.user_id,
  commonName: row.common_name,
  scientificName: row.scientific_name,
  mainImage: row.main_image,
  datePlanted: row.date_planted,
  bloomTime: row.bloom_time || [],
  height: row.height,
  sunlight: row.sunlight || [],
  moisture: row.moisture || [],
  nativeRange: row.native_range || [],
  notes: row.notes,
  images: row.images || [],
  hasAutofilled: row.has_autofilled,
});

const plantToSupabase = (plant, userId) => ({
  user_id: userId,
  garden_id: plant.gardenId,
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

// ============ PROFILE HELPER ============

async function getCachedProfile(userId) {
  if (!userId) return null;
  
  const cached = cache.profiles.get(userId);
  if (isCacheValid(cached)) return cached.data;
  
  const result = await safeQuery(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  });
  
  if (!result) return null;
  
  const profile = {
    id: result.id,
    email: result.email,
    display_name: result.display_name,
    avatar_url: result.avatar_url,
  };
  
  cache.profiles.set(userId, { data: profile, timestamp: Date.now() });
  return profile;
}

// ============ BACKGROUND PRELOAD ============

/**
 * Preload all plant data for user's gardens in background
 * Call this after initial page load to warm the cache
 */
export async function preloadUserData(userId) {
  if (!userId || preloadPromise) return preloadPromise;
  
  preloadPromise = (async () => {
    try {
      // Get all gardens if not cached
      if (!cache.gardens || cache.gardens.userId !== userId) {
        const { data: gardens } = await supabase
          .from('gardens')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });
        
        if (gardens) {
          const now = Date.now();
          const gardenList = gardens.map(gardenFromSupabase);
          cache.gardens = { userId, data: gardenList, timestamp: now };
          gardenList.forEach(g => cache.gardenDetails.set(g.id, { data: g, timestamp: now }));
        }
      }
      
      // Preload plants for all gardens
      const gardenIds = cache.gardens?.data?.map(g => g.id) || [];
      
      for (const gardenId of gardenIds) {
        if (cache.plants.has(gardenId)) continue; // Already cached
        
        const { data: plants } = await supabase
          .from('plants')
          .select('*')
          .eq('garden_id', gardenId)
          .eq('user_id', userId)
          .order('created_at', { ascending: true });
        
        if (plants) {
          const now = Date.now();
          const plantList = plants.map(plantFromSupabase);
          cache.plants.set(gardenId, { data: plantList, timestamp: now });
          plantList.forEach(p => cache.plantDetails.set(p.id, { data: p, timestamp: now }));
        }
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('[DataService] Preload error:', error);
      }
    }
  })();
  
  return preloadPromise;
}

// ============ PUBLIC/SHARED ACCESS ============

/**
 * Get just the garden info and owner for a shared garden (fast, for navbar)
 */
export async function getSharedGardenInfo(gardenId) {
  // Check full cache first
  const cached = cache.sharedGardens.get(gardenId);
  if (isCacheValid(cached)) {
    return { garden: cached.garden, owner: cached.owner };
  }

  // Check garden details cache
  const cachedGarden = cache.gardenDetails.get(gardenId);
  if (isCacheValid(cachedGarden)) {
    const owner = await getCachedProfile(cachedGarden.data.userId);
    return { garden: cachedGarden.data, owner };
  }

  // Fetch just the garden row
  const result = await safeQuery(() =>
    supabase.from('gardens').select('*').eq('id', gardenId).single()
  );
  
  if (!result?.data) throw new Error('Garden not found');
  
  const garden = gardenFromSupabase(result.data);
  const owner = await getCachedProfile(result.data.user_id);
  
  const now = Date.now();
  cache.gardenDetails.set(gardenId, { data: garden, timestamp: now });
  
  return { garden, owner };
}

/**
 * Get the plants for a shared garden (call after getSharedGardenInfo)
 */
export async function getSharedGardenPlants(gardenId) {
  // Check full cache
  const cached = cache.sharedGardens.get(gardenId);
  if (isCacheValid(cached)) {
    return cached.plants;
  }

  // Check plants cache
  const cachedPlants = cache.plants.get(gardenId);
  if (isCacheValid(cachedPlants)) {
    return cachedPlants.data;
  }

  const result = await safeQuery(() =>
    supabase.from('plants').select('*').eq('garden_id', gardenId).order('created_at', { ascending: true })
  );

  const plants = (result?.data || []).map(plantFromSupabase);
  const now = Date.now();
  
  cache.plants.set(gardenId, { data: plants, timestamp: now });
  plants.forEach(p => cache.plantDetails.set(p.id, { data: p, timestamp: now }));

  // Also update the full shared garden cache if we have garden info
  const gardenCached = cache.gardenDetails.get(gardenId);
  if (gardenCached) {
    const owner = await getCachedProfile(gardenCached.data.userId);
    cache.sharedGardens.set(gardenId, { 
      garden: gardenCached.data, plants, owner, timestamp: now 
    });
    plants.forEach(p => cache.sharedPlants.set(p.id, { plant: p, owner, timestamp: now }));
  }

  return plants;
}

/**
 * Original combined fetch - still used for full cache warming
 */
export async function getSharedGarden(gardenId) {
  const cached = cache.sharedGardens.get(gardenId);
  if (isCacheValid(cached)) {
    return { garden: cached.garden, plants: cached.plants, owner: cached.owner };
  }

  const [gardenResult, plantsResult] = await Promise.all([
    safeQuery(() => supabase.from('gardens').select('*').eq('id', gardenId).single()),
    safeQuery(() => supabase.from('plants').select('*').eq('garden_id', gardenId).order('created_at', { ascending: true })),
  ]);

  if (!gardenResult?.data) throw new Error('Garden not found');
  
  const garden = gardenFromSupabase(gardenResult.data);
  const plants = (plantsResult?.data || []).map(plantFromSupabase);
  const owner = await getCachedProfile(gardenResult.data.user_id);

  const now = Date.now();
  cache.sharedGardens.set(gardenId, { garden, plants, owner, timestamp: now });
  cache.gardenDetails.set(gardenId, { data: garden, timestamp: now });
  plants.forEach(p => {
    cache.sharedPlants.set(p.id, { plant: p, owner, timestamp: now });
    cache.plantDetails.set(p.id, { data: p, timestamp: now });
  });

  return { garden, plants, owner };
}

export async function getSharedPlant(plantId) {
  const cached = cache.sharedPlants.get(plantId);
  if (isCacheValid(cached)) {
    return { plant: cached.plant, owner: cached.owner };
  }

  const result = await safeQuery(() => 
    supabase.from('plants').select('*').eq('id', plantId).single()
  );
  
  if (!result?.data) throw new Error('Plant not found');

  const plant = plantFromSupabase(result.data);
  const owner = await getCachedProfile(result.data.user_id);

  const now = Date.now();
  cache.sharedPlants.set(plantId, { plant, owner, timestamp: now });
  cache.plantDetails.set(plantId, { data: plant, timestamp: now });

  return { plant, owner };
}

// ============ GARDENS ============

export async function getGardens(userId) {
  if (userId) {
    if (cache.gardens?.userId === userId && isCacheValid(cache.gardens)) {
      // Trigger background preload of plants
      setTimeout(() => preloadUserData(userId), 0);
      return cache.gardens.data;
    }

    const result = await safeQuery(() =>
      supabase.from('gardens').select('*').eq('user_id', userId).order('created_at', { ascending: true })
    );
    
    if (!result) return [];
    
    let data = result.data || [];
    
    const gardens = data.map(gardenFromSupabase);
    const now = Date.now();
    
    cache.gardens = { userId, data: gardens, timestamp: now };
    gardens.forEach(g => cache.gardenDetails.set(g.id, { data: g, timestamp: now }));
    
    // Trigger background preload of plants
    setTimeout(() => preloadUserData(userId), 0);
    
    return gardens;
  } else {
    // Local storage path
    let gardens = await localforage.getItem('gardens');
    
    if (!gardens) {
      const existingPlants = await localforage.getItem('plants');
      if (existingPlants?.length > 0) {
        const defaultGarden = {
          id: 'default',
          name: 'My Garden',
          image: existingPlants[0]?.mainImage || DEFAULT_GARDEN_IMAGE,
          createdAt: new Date().toISOString(),
        };
        gardens = [defaultGarden];
        await localforage.setItem('gardens', gardens);
        await localforage.setItem('plants', existingPlants.map(p => ({ ...p, gardenId: 'default' })));
      } else {
        gardens = [{
          id: 'default',
          name: 'My Garden',
          image: DEFAULT_GARDEN_IMAGE,
          createdAt: new Date().toISOString(),
        }];
        await localforage.setItem('gardens', gardens);
      }
    }
    return gardens;
  }
}

export async function getGarden(gardenId, userId) {
  if (userId) {
    const cached = cache.gardenDetails.get(gardenId);
    if (isCacheValid(cached)) return cached.data;

    const result = await safeQuery(() =>
      supabase.from('gardens').select('*').eq('id', gardenId).eq('user_id', userId).single()
    );
    
    if (!result?.data) return null;
    
    const garden = gardenFromSupabase(result.data);
    cache.gardenDetails.set(gardenId, { data: garden, timestamp: Date.now() });
    return garden;
  } else {
    const gardens = (await localforage.getItem('gardens')) || [];
    return gardens.find(g => g.id === gardenId);
  }
}

export async function createGarden(garden, userId) {
  if (userId) {
    const result = await safeQuery(() =>
      supabase.from('gardens').insert(gardenToSupabase(garden, userId)).select().single()
    );
    
    if (!result?.data) throw new Error('Failed to create garden');
    
    const newGarden = gardenFromSupabase(result.data);
    addGardenToCache(newGarden);
    return newGarden;
  } else {
    const gardens = (await localforage.getItem('gardens')) || [];
    const newGarden = { ...garden, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    gardens.push(newGarden);
    await localforage.setItem('gardens', gardens);
    return newGarden;
  }
}

export async function updateGarden(gardenId, updates, userId) {
  if (userId) {
    const result = await safeQuery(() =>
      supabase.from('gardens')
        .update({ name: updates.name, image: updates.image })
        .eq('id', gardenId)
        .eq('user_id', userId)
        .select()
        .single()
    );
    
    if (!result?.data) throw new Error('Failed to update garden');
    
    const updated = gardenFromSupabase(result.data);
    updateGardenInCache(gardenId, updated);
    return updated;
  } else {
    const gardens = (await localforage.getItem('gardens')) || [];
    const updated = gardens.map(g => g.id === gardenId ? { ...g, ...updates } : g);
    await localforage.setItem('gardens', updated);
    return updated.find(g => g.id === gardenId);
  }
}

export async function deleteGarden(gardenId, userId) {
  if (userId) {
    const result = await safeQuery(() =>
      supabase.from('gardens').delete().eq('id', gardenId).eq('user_id', userId)
    );
    if (result) removeGardenFromCache(gardenId);
  } else {
    const gardens = (await localforage.getItem('gardens')) || [];
    const plants = (await localforage.getItem('plants')) || [];
    await localforage.setItem('gardens', gardens.filter(g => g.id !== gardenId));
    await localforage.setItem('plants', plants.filter(p => p.gardenId !== gardenId));
  }
}

// ============ PLANTS ============

export async function getPlants(gardenId, userId) {
  if (userId) {
    const cached = cache.plants.get(gardenId);
    if (isCacheValid(cached)) return cached.data;

    const result = await safeQuery(() =>
      supabase.from('plants')
        .select('*')
        .eq('garden_id', gardenId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
    );
    
    if (!result) return [];
    
    const plants = (result.data || []).map(plantFromSupabase);
    const now = Date.now();
    
    cache.plants.set(gardenId, { data: plants, timestamp: now });
    plants.forEach(p => cache.plantDetails.set(p.id, { data: p, timestamp: now }));
    
    return plants;
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    return plants.filter(p => p.gardenId === gardenId);
  }
}

export async function getPlant(plantId, userId) {
  if (userId) {
    const cached = cache.plantDetails.get(plantId);
    if (isCacheValid(cached)) return cached.data;

    const result = await safeQuery(() =>
      supabase.from('plants').select('*').eq('id', plantId).eq('user_id', userId).single()
    );
    
    if (!result?.data) return null;
    
    const plant = plantFromSupabase(result.data);
    cache.plantDetails.set(plantId, { data: plant, timestamp: Date.now() });
    return plant;
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    return plants.find(p => p.id === plantId);
  }
}

export async function createPlant(plant, userId) {
  if (userId) {
    const result = await safeQuery(() =>
      supabase.from('plants').insert(plantToSupabase(plant, userId)).select().single()
    );
    
    if (!result?.data) throw new Error('Failed to create plant');
    
    const newPlant = plantFromSupabase(result.data);
    addPlantToCache(newPlant);
    return newPlant;
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    const newPlant = { ...plant, id: crypto.randomUUID() };
    plants.push(newPlant);
    await localforage.setItem('plants', plants);
    return newPlant;
  }
}

export async function updatePlant(plantId, updates, userId) {
  if (userId) {
    const result = await safeQuery(() =>
      supabase.from('plants')
        .update({
          common_name: updates.commonName,
          scientific_name: updates.scientificName,
          main_image: updates.mainImage,
          date_planted: updates.datePlanted || null,
          bloom_time: updates.bloomTime || [],
          height: updates.height,
          sunlight: updates.sunlight || [],
          moisture: updates.moisture || [],
          native_range: updates.nativeRange || [],
          notes: updates.notes,
          images: updates.images || [],
          has_autofilled: updates.hasAutofilled || false,
        })
        .eq('id', plantId)
        .eq('user_id', userId)
        .select()
        .single()
    );
    
    if (!result?.data) throw new Error('Failed to update plant');
    
    const updated = plantFromSupabase(result.data);
    updatePlantInCache(plantId, updated);
    return updated;
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    const updated = plants.map(p => p.id === plantId ? { ...p, ...updates } : p);
    await localforage.setItem('plants', updated);
    return updated.find(p => p.id === plantId);
  }
}

export async function deletePlant(plantId, userId) {
  if (userId) {
    const cached = cache.plantDetails.get(plantId);
    const gardenId = cached?.data?.gardenId;
    
    const result = await safeQuery(() =>
      supabase.from('plants').delete().eq('id', plantId).eq('user_id', userId)
    );
    
    if (result) removePlantFromCache(plantId, gardenId);
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    await localforage.setItem('plants', plants.filter(p => p.id !== plantId));
  }
}

// ============ ABOUT BLOCKS ============

export async function updateGardenAbout(gardenId, aboutBlocks, userId) {
  if (userId) {
    const result = await safeQuery(() =>
      supabase.from('gardens')
        .update({ about_blocks: aboutBlocks })
        .eq('id', gardenId)
        .eq('user_id', userId)
        .select()
        .single()
    );
    if (!result?.data) throw new Error('Failed to update garden about');
    const updated = gardenFromSupabase(result.data);
    updateGardenInCache(gardenId, updated);
    return updated;
  } else {
    const gardens = (await localforage.getItem('gardens')) || [];
    const updatedList = gardens.map(g =>
      g.id === gardenId ? { ...g, aboutBlocks } : g
    );
    await localforage.setItem('gardens', updatedList);
    return updatedList.find(g => g.id === gardenId);
  }
}

export async function updateGardenCustomization(gardenId, customization, userId) {
  if (userId) {
    const result = await safeQuery(() =>
      supabase.from('gardens')
        .update({ customization })
        .eq('id', gardenId)
        .eq('user_id', userId)
        .select()
        .single()
    );
    if (!result?.data) throw new Error('Failed to update garden customization');
    const updated = gardenFromSupabase(result.data);
    updateGardenInCache(gardenId, updated);
    return updated;
  } else {
    const gardens = (await localforage.getItem('gardens')) || [];
    const updatedList = gardens.map(g =>
      g.id === gardenId ? { ...g, customization } : g
    );
    await localforage.setItem('gardens', updatedList);
    return updatedList.find(g => g.id === gardenId);
  }
}

export async function getProfileAboutBlocks(userId) {
  if (userId) {
    const result = await safeQuery(() =>
      supabase.from('profiles')
        .select('about_blocks')
        .eq('id', userId)
        .single()
    );
    return result?.data?.about_blocks || [];
  } else {
    return (await localforage.getItem('profileAboutBlocks')) || [];
  }
}

export async function updateProfileAboutBlocks(userId, aboutBlocks) {
  if (userId) {
    const { error } = await supabase
      .from('profiles')
      .update({ about_blocks: aboutBlocks })
      .eq('id', userId);
    if (error) throw error;
  } else {
    await localforage.setItem('profileAboutBlocks', aboutBlocks);
  }
}

export async function updateGardenTodo(gardenId, todoContent, userId) {
  if (userId) {
    const result = await safeQuery(() =>
      supabase.from('gardens')
        .update({ todo_content: todoContent })
        .eq('id', gardenId)
        .eq('user_id', userId)
        .select()
        .single()
    );
    if (!result?.data) throw new Error('Failed to update garden todo');
    const updated = gardenFromSupabase(result.data);
    updateGardenInCache(gardenId, updated);
    return updated;
  } else {
    const gardens = (await localforage.getItem('gardens')) || [];
    const updatedList = gardens.map(g =>
      g.id === gardenId ? { ...g, todoContent } : g
    );
    await localforage.setItem('gardens', updatedList);
    return updatedList.find(g => g.id === gardenId);
  }
}

// ============ CACHE MANAGEMENT ============

export function clearAllCaches() {
  cache.gardens = null;
  cache.gardenDetails.clear();
  cache.plants.clear();
  cache.plantDetails.clear();
  cache.sharedGardens.clear();
  cache.sharedPlants.clear();
  cache.profiles.clear();
  preloadPromise = null;
}

export function getCacheStats() {
  return {
    hasGardens: !!cache.gardens,
    gardenDetailsCount: cache.gardenDetails.size,
    plantsCount: cache.plants.size,
    plantDetailsCount: cache.plantDetails.size,
    sharedGardensCount: cache.sharedGardens.size,
    sharedPlantsCount: cache.sharedPlants.size,
    profilesCount: cache.profiles.size,
  };
}

// ============================================================
// Add these functions to the END of dataService.js
// (before the cache management section, or after — they're self-contained)
// ============================================================

// ============ SAVED GARDENS ============

export async function saveGarden(gardenId, userId) {
  if (!userId) return;
  const result = await safeQuery(() =>
    supabase.from('saved_gardens')
      .upsert({ user_id: userId, garden_id: gardenId, saved_at: new Date().toISOString() }, { onConflict: 'user_id,garden_id' })
  );
  return !!result;
}

export async function unsaveGarden(gardenId, userId) {
  if (!userId) return;
  await safeQuery(() =>
    supabase.from('saved_gardens')
      .delete()
      .eq('user_id', userId)
      .eq('garden_id', gardenId)
  );
}

export async function isGardenSaved(gardenId, userId) {
  if (!userId) return false;
  const result = await safeQuery(() =>
    supabase.from('saved_gardens')
      .select('garden_id')
      .eq('user_id', userId)
      .eq('garden_id', gardenId)
      .maybeSingle()
  );
  return !!result?.data;
}

export async function getSavedGardens(userId) {
  if (!userId) return [];
  const result = await safeQuery(() =>
    supabase.from('saved_gardens')
      .select('garden_id, saved_at, gardens(*)')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false })
  );
  if (!result?.data) return [];
  return result.data
    .filter(row => row.gardens)
    .map(row => ({
      ...gardenFromSupabase(row.gardens),
      savedAt: row.saved_at,
    }));
}

// ============ RECENTLY VIEWED ============

export async function recordGardenView(gardenId, userId) {
  if (!userId) return;
  await safeQuery(() =>
    supabase.from('recently_viewed_gardens')
      .upsert(
        { user_id: userId, garden_id: gardenId, viewed_at: new Date().toISOString() },
        { onConflict: 'user_id,garden_id' }
      )
  );
}

export async function getRecentlyViewedGardens(userId) {
  if (!userId) return [];
  const result = await safeQuery(() =>
    supabase.from('recently_viewed_gardens')
      .select('garden_id, viewed_at, gardens(*)')
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .limit(20)
  );
  if (!result?.data) return [];
  return result.data
    .filter(row => row.gardens)
    .map(row => ({
      ...gardenFromSupabase(row.gardens),
      viewedAt: row.viewed_at,
    }));
}

// ============ PROFILE VISIBILITY ============

export async function getProfileVisibility(userId) {
  if (!userId) return { hiddenCreatedIds: [], visibleSavedIds: [], visibleRecentIds: [] };
  const result = await safeQuery(() =>
    supabase.from('profiles')
      .select('profile_visibility')
      .eq('id', userId)
      .single()
  );
  const vis = result?.data?.profile_visibility || {};
  return {
    hiddenCreatedIds: vis.hiddenCreatedIds || [],
    visibleSavedIds: vis.visibleSavedIds || [],
    visibleRecentIds: vis.visibleRecentIds || [],
  };
}

export async function updateProfileVisibility(userId, visibility) {
  if (!userId) return;
  const { error } = await supabase
    .from('profiles')
    .update({ profile_visibility: visibility })
    .eq('id', userId);
  if (error) throw error;
}

// ============ PLANT VISIBILITY (garden-level) ============

export function getHiddenPlantIds(garden) {
  return garden?.customization?.hiddenPlantIds || [];
}

export async function updateHiddenPlantIds(gardenId, hiddenPlantIds, userId) {
  if (!userId) return;
  // Merge with existing customization
  const existing = cache.gardenDetails.get(gardenId)?.data?.customization || {};
  const newCustomization = { ...existing, hiddenPlantIds };
  const result = await safeQuery(() =>
    supabase.from('gardens')
      .update({ customization: newCustomization })
      .eq('id', gardenId)
      .eq('user_id', userId)
      .select()
      .single()
  );
  if (!result?.data) throw new Error('Failed to update plant visibility');
  const updated = gardenFromSupabase(result.data);
  updateGardenInCache(gardenId, updated);
  return updated;
}

// ============ SHARED PROFILE DATA ============

/**
 * Get all data needed for a user's shared profile page.
 * Returns: { profile, createdGardens, savedGardens, recentGardens }
 */
export async function getSharedProfileData(userId) {
  // Fetch profile + visibility
  const profileResult = await safeQuery(() =>
    supabase.from('profiles')
      .select('id, email, display_name, avatar_url, about_blocks, profile_visibility')
      .eq('id', userId)
      .single()
  );
  if (!profileResult?.data) throw new Error('Profile not found');

  const profile = profileResult.data;
  const vis = profile.profile_visibility || {};
  const hiddenCreatedIds = vis.hiddenCreatedIds || [];
  const visibleSavedIds = vis.visibleSavedIds || [];
  const visibleRecentIds = vis.visibleRecentIds || [];

  // Fetch user's created gardens
  const gardensResult = await safeQuery(() =>
    supabase.from('gardens')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
  );
  const allCreated = (gardensResult?.data || []).map(gardenFromSupabase);
  const createdGardens = allCreated.filter(g => !hiddenCreatedIds.includes(g.id));

  // Fetch saved gardens (only visible ones)
  let savedGardens = [];
  if (visibleSavedIds.length > 0) {
    const savedResult = await safeQuery(() =>
      supabase.from('saved_gardens')
        .select('garden_id, saved_at, gardens(*)')
        .eq('user_id', userId)
        .in('garden_id', visibleSavedIds)
        .order('saved_at', { ascending: false })
    );
    if (savedResult?.data) {
      savedGardens = savedResult.data
        .filter(row => row.gardens)
        .map(row => ({ ...gardenFromSupabase(row.gardens), savedAt: row.saved_at }));
    }
  }

  // Fetch recently viewed (only visible ones)
  let recentGardens = [];
  if (visibleRecentIds.length > 0) {
    const recentResult = await safeQuery(() =>
      supabase.from('recently_viewed_gardens')
        .select('garden_id, viewed_at, gardens(*)')
        .eq('user_id', userId)
        .in('garden_id', visibleRecentIds)
        .order('viewed_at', { ascending: false })
    );
    if (recentResult?.data) {
      recentGardens = recentResult.data
        .filter(row => row.gardens)
        .map(row => ({ ...gardenFromSupabase(row.gardens), viewedAt: row.viewed_at }));
    }
  }

  return {
    profile: {
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      about_blocks: profile.about_blocks || [],
    },
    createdGardens,
    savedGardens,
    recentGardens,
  };
}

// ============ COPY GARDEN ============

/**
 * Copy a garden (with all visible plants and about blocks) into the current user's account.
 * @param {string} sourceGardenId - The garden to copy from
 * @param {string} newName - Name for the new garden
 * @param {string} newImage - Image URL for the new garden
 * @param {string} userId - The user creating the copy
 * @param {boolean} isShared - If true, copy from shared view (respect hidden plants)
 */
export async function copyGardenWithPlants(sourceGardenId, newName, newImage, userId, isShared = false) {
  if (!userId) throw new Error('Must be signed in to copy a garden');

  // 1. Get source garden
  const gardenResult = await safeQuery(() =>
    supabase.from('gardens').select('*').eq('id', sourceGardenId).single()
  );
  if (!gardenResult?.data) throw new Error('Source garden not found');
  const sourceGarden = gardenFromSupabase(gardenResult.data);

  // 2. Get source plants
  const plantsResult = await safeQuery(() =>
    supabase.from('plants')
      .select('*')
      .eq('garden_id', sourceGardenId)
      .order('created_at', { ascending: true })
  );
  let sourcePlants = (plantsResult?.data || []).map(plantFromSupabase);

  // If copying from shared view, filter out hidden plants
  if (isShared) {
    const hiddenIds = sourceGarden.customization?.hiddenPlantIds || [];
    sourcePlants = sourcePlants.filter(p => !hiddenIds.includes(p.id));
  }

  // 3. Create new garden
  const createResult = await safeQuery(() =>
    supabase.from('gardens')
      .insert({
        user_id: userId,
        name: newName,
        image: newImage || sourceGarden.image,
        about_blocks: sourceGarden.aboutBlocks || [],
        customization: { columns: sourceGarden.customization?.columns || 4, bgColor: sourceGarden.customization?.bgColor || '#f4f4f9' },
      })
      .select()
      .single()
  );
  if (!createResult?.data) throw new Error('Failed to create garden copy');
  const newGarden = gardenFromSupabase(createResult.data);

  // 4. Copy plants
  if (sourcePlants.length > 0) {
    const plantInserts = sourcePlants.map(p => ({
      user_id: userId,
      garden_id: newGarden.id,
      common_name: p.commonName,
      scientific_name: p.scientificName,
      main_image: p.mainImage,
      date_planted: p.datePlanted || null,
      bloom_time: p.bloomTime || [],
      height: p.height,
      sunlight: p.sunlight || [],
      moisture: p.moisture || [],
      native_range: p.nativeRange || [],
      notes: p.notes,
      images: p.images || [],
      has_autofilled: p.hasAutofilled || false,
    }));

    await safeQuery(() =>
      supabase.from('plants').insert(plantInserts)
    );
  }

  // 5. Update caches
  addGardenToCache(newGarden);

  return newGarden;
}