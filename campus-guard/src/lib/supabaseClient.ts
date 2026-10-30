import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve credentials from Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('your-project')
);

// Fallback dummy client if credentials not set yet to avoid runtime crash
let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  console.log('✅ Supabase Client initialized with live backend:', supabaseUrl);
} else {
  console.warn(
    'ℹ️ Supabase credentials not detected or using demo placeholders. Running in reactive offline/hybrid mode. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file to enable cloud sync.'
  );
  // Create a minimal placeholder client
  client = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key'
  );
}

export const supabase = client;

/**
 * Uploads a base64 image or Blob to the 'incident-media' Supabase storage bucket
 */
export async function uploadIncidentMedia(
  file: File | Blob,
  fileName: string
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  try {
    const filePath = `uploads/${Date.now()}_${fileName}`;
    const { data, error } = await supabase.storage
      .from('incident-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('incident-media')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('Failed to upload to Supabase Storage:', err);
    return null;
  }
}

