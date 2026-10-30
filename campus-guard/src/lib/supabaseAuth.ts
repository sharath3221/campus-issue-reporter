import { supabase, isSupabaseConfigured } from './supabaseClient';
import { AdminRole, AdminUser } from '../types';

export const ADMIN_SESSION_KEY = 'campuspulse_admin_session';

/**
 * Initiates Google OAuth Sign-In using Supabase Auth
 */
export async function signInWithGoogleSupabase(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Please verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.');
  }

  const redirectTo = `${window.location.origin}/admin/dashboard`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw error;
  }
}

/**
 * Authenticates an administrator strictly via Supabase Auth
 * No demo bypass or direct login fallbacks allowed.
 */
export async function signInWithSupabasePassword(
  email: string,
  password: string,
  role: AdminRole = 'ADMIN'
): Promise<AdminUser> {
  const cleanEmail = email.trim().toLowerCase();

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Please verify your connection settings in .env.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: password,
  });

  if (error || !data?.user) {
    throw new Error(error?.message || 'Invalid administrator credentials. Account not found or password incorrect.');
  }

  const user: AdminUser = {
    admin_id: data.user.id,
    email: data.user.email || cleanEmail,
    role: role,
    full_name:
      data.user.user_metadata?.full_name ||
      data.user.user_metadata?.name ||
      (role === 'PRINCIPAL'
        ? 'College Principal'
        : role === 'MANAGEMENT'
        ? 'Governing Trustee'
        : 'Operations Head'),
    department:
      role === 'PRINCIPAL'
        ? "Principal's Office"
        : role === 'MANAGEMENT'
        ? 'Governing Council'
        : 'Facilities Management',
  };

  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(user));
  return user;
}

/**
 * Registers a new administrator directly in Supabase Auth.
 */
export async function signUpWithSupabase(
  email: string,
  password: string,
  role: AdminRole = 'ADMIN'
): Promise<{ user: AdminUser | null; message?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Please verify your connection settings in .env.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: password,
    options: {
      data: {
        role: role,
        full_name:
          role === 'PRINCIPAL'
            ? 'College Principal'
            : role === 'MANAGEMENT'
            ? 'Governing Trustee'
            : 'Operations Head',
      },
    },
  });

  if (error) {
    throw error;
  }

  if (data?.session?.user) {
    const adminUser: AdminUser = {
      admin_id: data.session.user.id,
      email: data.session.user.email || cleanEmail,
      role: role,
      full_name:
        data.session.user.user_metadata?.full_name ||
        (role === 'PRINCIPAL' ? 'College Principal' : role === 'MANAGEMENT' ? 'Governing Trustee' : 'Operations Head'),
      department:
        role === 'PRINCIPAL' ? "Principal's Office" : role === 'MANAGEMENT' ? 'Governing Council' : 'Facilities Management',
    };
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminUser));
    return { user: adminUser };
  }

  return {
    user: null,
    message: 'Admin account created in Supabase! If email confirmation is enabled, please verify your email before logging in.',
  };
}

/**
 * Checks for an active Supabase Auth session
 * Strictly rejects any unauthenticated or demo sessions.
 */
export async function getActiveAdminSession(): Promise<AdminUser | null> {
  // 1. Verify live Supabase Auth session
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const user = data.session.user;
        const adminSession: AdminUser = {
          admin_id: user.id,
          email: user.email || 'admin@college.edu',
          role: 'PRINCIPAL',
          full_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Authorized Administrator',
          department: "Principal's Office / Executive Directorate",
        };
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminSession));
        return adminSession;
      } else {
        // No live Supabase session found -> immediately purge local cache
        localStorage.removeItem(ADMIN_SESSION_KEY);
        return null;
      }
    } catch (err) {
      console.warn('Error verifying Supabase session:', err);
      localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
  }

  // Supabase not configured or no active session
  localStorage.removeItem(ADMIN_SESSION_KEY);
  return null;
}

/**
 * Signs out of Supabase Auth and removes all stored admin sessions
 */
export async function signOutAdmin(): Promise<void> {
  try {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
  } catch (err) {
    console.warn('Supabase sign out notice:', err);
  } finally {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }
}
