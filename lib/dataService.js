import { supabase } from './supabaseClient';
import localforage from 'localforage';

const DEFAULT_GARDEN_IMAGE = '/default-garden.jpg';

/**
 * Data Service - Abstracts storage between local (localforage) and Supabase
 * Uses Supabase when user is authenticated, localforage when not
 */

// Helper to convert Supabase row to app format
const gardenFromSupabase = (row) => ({
  id: row.id,
  name: row.name,
  image: row.image || DEFAULT_GARDEN_IMAGE,
  createdAt: row.created_at,
});

const gardenToSupabase = (garden, userId) => ({
  user_id: userId,
  name: garden.name,
  image: garden.image,
});

const plantFromSupabase = (row) => ({
  id: row.id,
  gardenId: row.garden_id,
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

// ============ PUBLIC/SHARED ACCESS ============

export async function getSharedGarden(gardenId) {
  // Fetch garden
  const { data: garden, error: gError } = await supabase
    .from('gardens')
    .select('*')
    .eq('id', gardenId)
    .single();

  if (gError) throw gError;

  // Fetch owner profile
  const { data: owner, error: oError } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url')
    .eq('id', garden.user_id)
    .single();

  if (oError) console.error('Could not fetch owner:', oError);

  const { data: plants, error: pError } = await supabase
    .from('plants')
    .select('*')
    .eq('garden_id', gardenId)
    .order('created_at', { ascending: true });

  if (pError) throw pError;

  return {
    garden: gardenFromSupabase(garden),
    plants: plants.map(plantFromSupabase),
    owner: owner || null,
  };
}

export async function getSharedPlant(plantId) {
  const { data: plant, error: pError } = await supabase
    .from('plants')
    .select('*')
    .eq('id', plantId)
    .single();

  if (pError) throw pError;

  // Fetch owner profile
  const { data: owner, error: oError } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url')
    .eq('id', plant.user_id)
    .single();

  if (oError) console.error('Could not fetch owner:', oError);

  return {
    plant: plantFromSupabase(plant),
    owner: owner || null,
  };
}

// ============ GARDENS ============

export async function getGardens(userId) {
  if (userId) {
    const { data, error } = await supabase
      .from('gardens')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    // If user has no gardens, create a default one
    if (data.length === 0) {
      const { data: newGarden, error: createError } = await supabase
        .from('gardens')
        .insert({ user_id: userId, name: 'My Garden', image: DEFAULT_GARDEN_IMAGE })
        .select()
        .single();
      
      if (createError) throw createError;
      return { gardens: [gardenFromSupabase(newGarden)], createdDefault: true };
    }
    
    return { gardens: data.map(gardenFromSupabase), createdDefault: false };
  } else {
    // Local storage
    let gardens = await localforage.getItem('gardens');
    let createdDefault = false;
    
    // Migration: create default garden if needed
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
    const { data, error } = await supabase
      .from('gardens')
      .select('*')
      .eq('id', gardenId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return gardenFromSupabase(data);
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
    return gardenFromSupabase(data);
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
    return gardenFromSupabase(data);
  } else {
    const gardens = (await localforage.getItem('gardens')) || [];
    const updated = gardens.map((g) => (g.id === gardenId ? { ...g, ...updates } : g));
    await localforage.setItem('gardens', updated);
    return updated.find((g) => g.id === gardenId);
  }
}

export async function deleteGarden(gardenId, userId) {
  if (userId) {
    // Plants are deleted automatically via CASCADE
    const { error } = await supabase
      .from('gardens')
      .delete()
      .eq('id', gardenId)
      .eq('user_id', userId);

    if (error) throw error;
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
    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .eq('garden_id', gardenId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data.map(plantFromSupabase);
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    return plants.filter((p) => p.gardenId === gardenId);
  }
}

export async function getPlant(plantId, userId) {
  if (userId) {
    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .eq('id', plantId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return plantFromSupabase(data);
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
    return plantFromSupabase(data);
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    const newPlant = {
      ...plant,
      id: plant.id || crypto.randomUUID(),
    };
    plants.push(newPlant);
    await localforage.setItem('plants', newPlant);
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
    return plantFromSupabase(data);
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    const updated = plants.map((p) => (p.id === plantId ? { ...p, ...updates } : p));
    await localforage.setItem('plants', updated);
    return updated.find((p) => p.id === plantId);
  }
}

export async function deletePlant(plantId, userId) {
  if (userId) {
    const { error } = await supabase
      .from('plants')
      .delete()
      .eq('id', plantId)
      .eq('user_id', userId);

    if (error) throw error;
  } else {
    const plants = (await localforage.getItem('plants')) || [];
    await localforage.setItem('plants', plants.filter((p) => p.id !== plantId));
  }
}