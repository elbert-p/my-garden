import { supabase } from './supabaseClient';
import localforage from 'localforage';

const DEFAULT_GARDEN_IMAGE = '/default-garden.jpg';

/**
 * In-memory cache for Supabase data
 * This cache lives only in memory, so it's cleared on page reload
 * but persists across tab switches and navigation within the app
 */
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

const cache = {
  // User's own data
  gardens: null,              // { userId: string, data: Garden[], timestamp: number }
  gardenDetails: new Map(),   // gardenId -> { data: Garden, timestamp: number }
  plants: new Map(),          // gardenId -> { data: Plant[], timestamp: number }
  plantDetails: new Map(),    // plantId -> { data: Plant, timestamp: number }
  
  // Shared/public data
  sharedGardens: new Map(),   // gardenId -> { garden, plants, owner, timestamp }
  sharedPlants: new Map(),    // plantId -> { plant, owner, timestamp }
  
  // Profiles (owners)
  profiles: new Map(),        // userId -> { data: Profile, timestamp: number }
};

// Cache helper functions
const isCacheValid = (cacheEntry) => {
  if (!cacheEntry) return false;
  return Date.now() - cacheEntry.timestamp < CACHE_MAX_AGE_MS;
};

// Update garden in all relevant caches
const updateGardenInCache = (gardenId, updatedGarden) => {
  const now = Date.now();
  
  // Update garden details cache
  cache.gardenDetails.set(gardenId, { data: updatedGarden, timestamp: now });
  
  // Update in gardens list cache
  if (cache.gardens && cache.gardens.data) {
    cache.gardens.data = cache.gardens.data.map(g => 
      g.id === gardenId ? updatedGarden : g
    );
    cache.gardens.timestamp = now;
  }
  
  // Update in shared gardens cache
  const sharedCached = cache.sharedGardens.get(gardenId);
  if (sharedCached) {
    cache.sharedGardens.set(gardenId, {
      ...sharedCached,
      garden: updatedGarden,
      timestamp: now,
    });
  }
};

// Update plant in all relevant caches
const updatePlantInCache = (plantId, updatedPlant) => {
  const now = Date.now();
  
  // Update plant details cache
  cache.plantDetails.set(plantId, { data: updatedPlant, timestamp: now });
  
  // Update in plants list cache
  const gardenId = updatedPlant.gardenId;
  if (gardenId) {
    const plantsCached = cache.plants.get(gardenId);
    if (plantsCached && plantsCached.data) {
      cache.plants.set(gardenId, {
        data: plantsCached.data.map(p => p.id === plantId ? updatedPlant : p),
        timestamp: now,
      });
    }
  }
  
  // Update in shared plants cache
  const sharedPlantCached = cache.sharedPlants.get(plantId);
  if (sharedPlantCached) {
    cache.sharedPlants.set(plantId, {
      ...sharedPlantCached,
      plant: updatedPlant,
      timestamp: now,
    });
  }
  
  // Update in shared gardens cache (which contains plant lists)
  if (gardenId) {
    const sharedGardenCached = cache.sharedGardens.get(gardenId);
    if (sharedGardenCached && sharedGardenCached.plants) {
      cache.sharedGardens.set(gardenId, {
        ...sharedGardenCached,
        plants: sharedGardenCached.plants.map(p => p.id === plantId ? updatedPlant : p),
        timestamp: now,
      });
    }
  }
};

// Add garden to caches
const addGardenToCache = (newGarden) => {
  const now = Date.now();
  
  // Add to garden details
  cache.gardenDetails.set(newGarden.id, { data: newGarden, timestamp: now });
  
  // Add to gardens list
  if (cache.gardens && cache.gardens.data) {
    cache.gardens.data = [...cache.gardens.data, newGarden];
    cache.gardens.timestamp = now;
  }
};

// Add plant to caches
const addPlantToCache = (newPlant) => {
  const now = Date.now();
  
  // Add to plant details
  cache.plantDetails.set(newPlant.id, { data: newPlant, timestamp: now });
  
  // Add to plants list for the garden
  const gardenId = newPlant.gardenId;
  if (gardenId) {
    const plantsCached = cache.plants.get(gardenId);
    if (plantsCached && plantsCached.data) {
      cache.plants.set(gardenId, {
        data: [...plantsCached.data, newPlant],
        timestamp: now,
      });
    }
    
    // Also add to shared garden cache if present
    const sharedGardenCached = cache.sharedGardens.get(gardenId);
    if (sharedGardenCached && sharedGardenCached.plants) {
      cache.sharedGardens.set(gardenId, {
        ...sharedGardenCached,
        plants: [...sharedGardenCached.plants, newPlant],
        timestamp: now,
      });
    }
  }
};

// Remove garden from caches
const removeGardenFromCache = (gardenId) => {
  cache.gardenDetails.delete(gardenId);
  cache.sharedGardens.delete(gardenId);
  
  // Remove from gardens list
  if (cache.gardens && cache.gardens.data) {
    cache.gardens.data = cache.gardens.data.filter(g => g.id !== gardenId);
  }
  
  // Remove all plants for this garden
  cache.plants.delete(gardenId);
  
  // Remove individual plant entries for this garden
  for (const [plantId, entry] of cache.plantDetails.entries()) {
    if (entry.data?.gardenId === gardenId) {
      cache.plantDetails.delete(plantId);
      cache.sharedPlants.delete(plantId);
    }
  }
};

// Remove plant from caches
const removePlantFromCache = (plantId, gardenId) => {
  cache.plantDetails.delete(plantId);
  cache.sharedPlants.delete(plantId);
  
  // Remove from plants list
  if (gardenId) {
    const plantsCached = cache.plants.get(gardenId);
    if (plantsCached && plantsCached.data) {
      cache.plants.set(gardenId, {
        ...plantsCached,
        data: plantsCached.data.filter(p => p.id !== plantId),
      });
    }
    
    // Remove from shared garden cache
    const sharedGardenCached = cache.sharedGardens.get(gardenId);
    if (sharedGardenCached && sharedGardenCached.plants) {
      cache.sharedGardens.set(gardenId, {
        ...sharedGardenCached,
        plants: sharedGardenCached.plants.filter(p => p.id !== plantId),
      });
    }
  }
};

// Helper to convert Supabase row to app format
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

// Helper to fetch and cache a profile
async function getCachedProfile(userId, signal) {
  if (!userId) return null;
  
  const cached = cache.profiles.get(userId);
  if (isCacheValid(cached)) {
    return cached.data;
  }
  
  const { data: owner, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url')
    .eq('id', userId)
    .abortSignal(signal)
    .single();
  
  if (error) {
    if (error.name === 'AbortError') throw error;
    console.error('Could not fetch owner:', error);
    return null;
  }
  
  const profile = {
    id: owner.id,
    email: owner.email,
    display_name: owner.display_name,
    avatar_url: owner.avatar_url,
  };
  
  cache.profiles.set(userId, { data: profile, timestamp: Date.now() });
  return profile;
}

// ============ PUBLIC/SHARED ACCESS ============

export async function getSharedGarden(gardenId, signal) {
  // Check cache first
  const cached = cache.sharedGardens.get(gardenId);
  if (isCacheValid(cached)) {
    return {
      garden: cached.garden,
      plants: cached.plants,
      owner: cached.owner,
    };
  }

  // Fetch garden and plants in parallel
  const [gardenResult, plantsResult] = await Promise.all([
    supabase
      .from('gardens')
      .select('*')
      .eq('id', gardenId)
      .abortSignal(signal)
      .single(),
    supabase
      .from('plants')
      .select('*')
      .eq('garden_id', gardenId)
      .abortSignal(signal)
      .order('created_at', { ascending: true }),
  ]);

  if (gardenResult.error) throw gardenResult.error;
  if (plantsResult.error) throw plantsResult.error;

  const garden = gardenFromSupabase(gardenResult.data);
  const plants = plantsResult.data.map(plantFromSupabase);
  
  // Fetch owner profile (cached)
  const owner = await getCachedProfile(gardenResult.data.user_id, signal);

  // Cache the result
  const now = Date.now();
  cache.sharedGardens.set(gardenId, {
    garden,
    plants,
    owner,
    timestamp: now,
  });
  
  // Also cache individual plants for faster detail page loads
  plants.forEach(plant => {
    cache.sharedPlants.set(plant.id, {
      plant,
      owner,
      timestamp: now,
    });
    cache.plantDetails.set(plant.id, { data: plant, timestamp: now });
  });
  
  // Cache garden details too
  cache.gardenDetails.set(gardenId, { data: garden, timestamp: now });

  return { garden, plants, owner };
}

export async function getSharedPlant(plantId, signal) {
  // Check cache first
  const cached = cache.sharedPlants.get(plantId);
  if (isCacheValid(cached)) {
    return {
      plant: cached.plant,
      owner: cached.owner,
    };
  }

  const { data: plant, error: pError } = await supabase
    .from('plants')
    .select('*')
    .eq('id', plantId)
    .abortSignal(signal)
    .single();

  if (pError) throw pError;

  const plantData = plantFromSupabase(plant);
  
  // Fetch owner profile (cached)
  const owner = await getCachedProfile(plant.user_id, signal);

  // Cache the result
  const now = Date.now();
  cache.sharedPlants.set(plantId, {
    plant: plantData,
    owner,
    timestamp: now,
  });
  cache.plantDetails.set(plantId, { data: plantData, timestamp: now });

  return { plant: plantData, owner };
}

// ============ GARDENS ============

export async function getGardens(userId) {
  if (userId) {
    // Check cache first
    if (cache.gardens && cache.gardens.userId === userId && isCacheValid(cache.gardens)) {
      return { gardens: cache.gardens.data, createdDefault: false };
    }

    const { data, error } = await supabase
      .from('gardens')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    if (data.length === 0) {
      const { data: newGarden, error: createError } = await supabase
        .from('gardens')
        .insert({ user_id: userId, name: 'My Garden', image: DEFAULT_GARDEN_IMAGE })
        .select()
        .single();
      
      if (createError) throw createError;
      const gardens = [gardenFromSupabase(newGarden)];
      
      cache.gardens = { userId, data: gardens, timestamp: Date.now() };
      
      return { gardens, createdDefault: true };
    }
    
    const gardens = data.map(gardenFromSupabase);
    const now = Date.now();
    
    // Cache the list
    cache.gardens = { userId, data: gardens, timestamp: now };
    
    // Also cache individual gardens
    gardens.forEach(garden => {
      cache.gardenDetails.set(garden.id, { data: garden, timestamp: now });
    });
    
    return { gardens, createdDefault: false };
  } else {
    let gardens = await localforage.getItem('gardens');
    let createdDefault = false;
    
    if (!gardens) {
      const existingPlants = await localforage.getItem('plants');
      if (existingPlants && existingPlants.length > 0) {
        const defaultGarden = {
          id: 'default',
          name: 'My Garden',
          image: existingPlants[0]?.mainImage || DEFAULT_GARDEN_IMAGE,
          createdAt: new Date().toISOString(),
        };
        gardens = [defaultGarden];
        await localforage.setItem('gardens', gardens);
        const migratedPlants = existingPlants.map((p) => ({ ...p, gardenId: 'default' }));
        await localforage.setItem('plants', migratedPlants);
      } else {
        const defaultGarden = {
          id: 'default',
          name: 'My Garden',
          image: DEFAULT_GARDEN_IMAGE,
          createdAt: new Date().toISOString(),
        };
        gardens = [defaultGarden];
        await localforage.setItem('gardens', gardens);
        createdDefault = true;
      }
    }
    return { gardens, createdDefault };
  }
}

export async function getGarden(gardenId, userId) {
  if (userId) {
    // Check cache first
    const cached = cache.gardenDetails.get(gardenId);
    if (isCacheValid(cached)) {
      return cached.data;
    }

    const { data, error } = await supabase
      .from('gardens')
      .select('*')
      .eq('id', gardenId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    
    const garden = gardenFromSupabase(data);
    cache.gardenDetails.set(gardenId, { data: garden, timestamp: Date.now() });
    
    return garden;
  } else {
    const gardens = (await localforage.getItem('gardens')) || [];
    return gardens.find((g) => g.id === gardenId);
  }
}

export async function createGarden(garden, userId) {
  if (userId) {
    const { data, error } = await supabase
      .from('gardens')
      .insert(gardenToSupabase(garden, userId))
      .select()
      .single();

    if (error) throw error;
    
    const newGarden = gardenFromSupabase(data);
    addGardenToCache(newGarden);
    
    return newGarden;
  } else {
    const gardens = (await localforage.getItem('gardens')) || [];
    const newGarden = {
      ...garden,
      id: garden.id || crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    gardens.push(newGarden);
    await localforage.setItem('gardens', gardens);
    return newGarden;
  }
}

export async function updateGarden(gardenId, updates, userId) {
  if (userId) {
    const { data, error } = await supabase
      .from('gardens')
      .update({ name: updates.name, image: updates.image })
      .eq('id', gardenId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    
    const updatedGarden = gardenFromSupabase(data);
    updateGardenInCache(gardenId, updatedGarden);
    
    return updatedGarden;
  } else {
    const gardens = (await localforage.getItem('gardens')) || [];
    const updated = gardens.map((g) => (g.id === gardenId ? { ...g, ...updates } : g));
    await localforage.setItem('gardens', updated);
    return updated.find((g) => g.id === gardenId);
  }
}

export async function deleteGarden(gardenId, userId) {
  if (userId) {
    const { error } = await supabase
      .from('gardens')
      .delete()
      .eq('id', gardenId)
      .eq('user_id', userId);

    if (error) throw error;
    
    removeGardenFromCache(gardenId);
  } else {
    const gardens = (await localforage.getItem('gardens')) || [];
    const plants = (await localforage.getItem('plants')) || [];
    await localforage.setItem('gardens', gardens.filter((g) => g.id !== gardenId));
    await localforage.setItem('plants', plants.filter((p) => p.gardenId !== gardenId));
  }
}

// ============ PLANTS ============

export async function getPlants(gardenId, userId) {
  if (userId) {
    // Check cache first
    const cached = cache.plants.get(gardenId);
    if (isCacheValid(cached)) {
      return cached.data;
    }

    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .eq('garden_id', gardenId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    const plants = data.map(plantFromSupabase);
    const now = Date.now();
    
    // Cache the list
    cache.plants.set(gardenId, { data: plants, timestamp: now });
    
    // Also cache individual plants
    plants.forEach(plant => {
      cache.plantDetails.set(plant.id, { data: plant, timestamp: now });
    });
    
    return plants;
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    return plants.filter((p) => p.gardenId === gardenId);
  }
}

export async function getPlant(plantId, userId) {
  if (userId) {
    // Check cache first
    const cached = cache.plantDetails.get(plantId);
    if (isCacheValid(cached)) {
      return cached.data;
    }

    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .eq('id', plantId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    
    const plant = plantFromSupabase(data);
    cache.plantDetails.set(plantId, { data: plant, timestamp: Date.now() });
    
    return plant;
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    return plants.find((p) => p.id === plantId);
  }
}

export async function createPlant(plant, userId) {
  if (userId) {
    const { data, error } = await supabase
      .from('plants')
      .insert(plantToSupabase(plant, userId))
      .select()
      .single();

    if (error) throw error;
    
    const newPlant = plantFromSupabase(data);
    addPlantToCache(newPlant);
    
    return newPlant;
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    const newPlant = {
      ...plant,
      id: plant.id || crypto.randomUUID(),
    };
    plants.push(newPlant);
    await localforage.setItem('plants', plants);
    return newPlant;
  }
}

export async function updatePlant(plantId, updates, userId) {
  if (userId) {
    const supabaseUpdates = {
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
    };

    const { data, error } = await supabase
      .from('plants')
      .update(supabaseUpdates)
      .eq('id', plantId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    
    const updatedPlant = plantFromSupabase(data);
    updatePlantInCache(plantId, updatedPlant);
    
    return updatedPlant;
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    const updated = plants.map((p) => (p.id === plantId ? { ...p, ...updates } : p));
    await localforage.setItem('plants', updated);
    return updated.find((p) => p.id === plantId);
  }
}

export async function deletePlant(plantId, userId) {
  if (userId) {
    // Get the plant first to know its gardenId for cache update
    const cached = cache.plantDetails.get(plantId);
    const gardenId = cached?.data?.gardenId;
    
    const { error } = await supabase
      .from('plants')
      .delete()
      .eq('id', plantId)
      .eq('user_id', userId);

    if (error) throw error;
    
    removePlantFromCache(plantId, gardenId);
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    await localforage.setItem('plants', plants.filter((p) => p.id !== plantId));
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