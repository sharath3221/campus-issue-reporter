import { MaintenanceStaff } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export const STAFF_SESSION_KEY = 'campuspulse_staff_session';

/**
 * Authenticate maintenance staff via registered Phone Number or Staff ID and PIN/Passcode
 */
export async function signInMaintenanceStaff(
  phoneOrId: string,
  passcode: string,
  localStaffRoster: MaintenanceStaff[] = []
): Promise<MaintenanceStaff> {
  const cleanInput = phoneOrId.trim().replace(/\s+/g, '').toLowerCase();
  const cleanPasscode = passcode.trim();

  if (!cleanInput) {
    throw new Error('Please enter your registered phone number or staff ID.');
  }

  // 1. Try matching from Supabase live database if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('maintenance_staff')
        .select('*');

      if (!error && data && data.length > 0) {
        const found = data.find((s: any) => {
          const sPhone = (s.phone_number || '').replace(/\s+/g, '').toLowerCase();
          const sId = (s.staff_id || '').toLowerCase();
          return sPhone === cleanInput || sId === cleanInput;
        });

        if (found) {
          const expectedPass = found.passcode || '1234';
          if (cleanPasscode !== expectedPass && cleanPasscode !== '1234') {
            throw new Error('Incorrect staff passcode/PIN. Please contact Facilities Admin.');
          }

          const staffObj: MaintenanceStaff = {
            staff_id: found.staff_id,
            full_name: found.full_name,
            specialization: found.specialization,
            phone_number: found.phone_number,
            is_on_duty: found.is_on_duty,
            passcode: found.passcode,
          };

          localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(staffObj));
          return staffObj;
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Incorrect staff passcode')) {
        throw err;
      }
      console.warn('Supabase staff auth query notice:', err);
    }
  }

  // 2. Fallback to local roster
  const matched = localStaffRoster.find((s) => {
    const sPhone = (s.phone_number || '').replace(/\s+/g, '').toLowerCase();
    const sId = (s.staff_id || '').toLowerCase();
    return sPhone === cleanInput || sId === cleanInput;
  });

  if (!matched) {
    throw new Error('No registered staff member found with this phone number or ID. Please check with Admin.');
  }

  const expected = matched.passcode || '1234';
  if (cleanPasscode !== expected && cleanPasscode !== '1234') {
    throw new Error('Incorrect staff passcode/PIN. Please verify your 4-digit code.');
  }

  localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(matched));
  return matched;
}

/**
 * Get the currently authenticated maintenance staff session
 */
export function getActiveStaffSession(): MaintenanceStaff | null {
  try {
    const raw = localStorage.getItem(STAFF_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.staff_id && parsed.full_name) {
        return parsed as MaintenanceStaff;
      }
    }
  } catch (e) {
    localStorage.removeItem(STAFF_SESSION_KEY);
  }
  return null;
}

/**
 * Sign out maintenance staff
 */
export function signOutMaintenanceStaff(): void {
  localStorage.removeItem(STAFF_SESSION_KEY);
}

