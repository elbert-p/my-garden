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
      return { gardens: cache.gardens.data, createdDefault: false };
    }

    const result = await safeQuery(() =>
      supabase.from('gardens').select('*').eq('user_id', userId).order('created_at', { ascending: true })
    );
    
    if (!result) return { gardens: [], createdDefault: false };
    
    let data = result.data || [];
    let createdDefault = false;
    
    if (data.length === 0) {
      const createResult = await safeQuery(() =>
        supabase.from('gardens')
          .insert({ user_id: userId, name: 'My Garden', image: DEFAULT_GARDEN_IMAGE })
          .select()
          .single()
      );
      
      if (createResult?.data) {
        data = [createResult.data];
        createdDefault = true;
      }
    }
    
    const gardens = data.map(gardenFromSupabase);
    const now = Date.now();
    
    cache.gardens = { userId, data: gardens, timestamp: now };
    gardens.forEach(g => cache.gardenDetails.set(g.id, { data: g, timestamp: now }));
    
    // Trigger background preload of plants
    setTimeout(() => preloadUserData(userId), 0);
    
    return { gardens, createdDefault };
  } else {
    // Local storage path
    let gardens = await localforage.getItem('gardens');
    let createdDefault = false;
    
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
        createdDefault = true;
      }
    }
    return { gardens, createdDefault };
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