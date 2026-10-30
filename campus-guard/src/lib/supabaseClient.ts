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
  client = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key'
  );
}

export const supabase = client;

/**
 * Converts a base64 Data URL to a Blob
 */
export function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Uploads a File, Blob, or base64 Data URL to the 'incident-media' Supabase storage bucket
 * Returns the public CDN URL to display in tickets and spot badges
 */
export async function uploadIncidentMedia(
  fileOrDataUrl: File | Blob | string,
  fileName: string = 'capture.jpg'
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  try {
    let blob: Blob;
    if (typeof fileOrDataUrl === 'string') {
      if (fileOrDataUrl.startsWith('data:')) {
        blob = dataURLtoBlob(fileOrDataUrl);
      } else if (fileOrDataUrl.startsWith('http')) {
        return fileOrDataUrl; // Already a cloud/web URL
      } else {
        return null;
      }
    } else {
      blob = fileOrDataUrl;
    }

    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${fileName}`;
    const filePath = `uploads/${uniqueName}`;

    const { data, error } = await supabase.storage
      .from('incident-media')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: blob.type || 'image/jpeg',
      });

    if (error) {
      console.warn('Supabase storage upload notice:', error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('incident-media')
      .getPublicUrl(data.path);

    console.log('✅ Photo successfully uploaded to Supabase Storage:', publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn('Failed to upload to Supabase Storage:', err);
    return null;
  }
}
