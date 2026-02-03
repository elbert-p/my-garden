import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a dummy client during build time when env vars aren't available
// This prevents the build from failing on static pages like /_not-found
const createSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client for build time
    // This will never be used at runtime since env vars will be available
    if (typeof window === 'undefined') {
      console.warn('Supabase environment variables not available during build');
      return null;
    }
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(supabaseUrl, supabaseAnonKey);
};

export const supabase = createSupabaseClient();