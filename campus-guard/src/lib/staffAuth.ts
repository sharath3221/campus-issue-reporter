import { MaintenanceStaff } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export const STAFF_SESSION_KEY = 'campuspulse_staff_session';

function matchesStaffCredentials(staff: any, input: string): boolean {
  const cleanInput = input.trim().toLowerCase().replace(/[\s\-\(\)]/g, '');
  const inputDigits = cleanInput.replace(/\D/g, '');

  const staffPhone = (staff.phone_number || '').trim().toLowerCase().replace(/[\s\-\(\)]/g, '');
  const staffDigits = staffPhone.replace(/\D/g, '');
  const staffId = (staff.staff_id || '').trim().toLowerCase();

  // 1. Exact raw match against staff_id or cleaned phone
  if (cleanInput === staffPhone || cleanInput === staffId) {
    return true;
  }

  // 2. Suffix match on phone digits (handles country code +91 or 0 differences)
  if (inputDigits.length >= 7 && staffDigits.length >= 7) {
    const inTail = inputDigits.slice(-10);
    const staffTail = staffDigits.slice(-10);
    if (inTail === staffTail) {
      return true;
    }
  }

  return false;
}

/**
 * Authenticate maintenance staff via registered Phone Number or Staff ID and PIN/Passcode given by Admin
 */
export async function signInMaintenanceStaff(
  phoneOrId: string,
  passcode: string,
  localStaffRoster: MaintenanceStaff[] = []
): Promise<MaintenanceStaff> {
  const cleanPasscode = passcode.trim();

  if (!phoneOrId.trim()) {
    throw new Error('Please enter your registered phone number or staff ID.');
  }

  // 1. Try matching from Supabase live database if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('maintenance_staff')
        .select('*');

      if (!error && data && data.length > 0) {
        const found = data.find((s: any) => matchesStaffCredentials(s, phoneOrId));

        if (found) {
          const expectedPass = String(found.passcode || '1234').trim();
          if (cleanPasscode !== expectedPass) {
            throw new Error('Incorrect technician PIN. Please verify the credentials provided by your Administrator.');
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
      if (err.message && err.message.includes('Incorrect technician PIN')) {
        throw err;
      }
      console.warn('Supabase staff auth query notice:', err);
    }
  }

  // 2. Fallback to local roster
  const matched = localStaffRoster.find((s) => matchesStaffCredentials(s, phoneOrId));

  if (!matched) {
    throw new Error('No registered technician found with this Phone Number or Staff ID. Please ask your Administrator to add you in the Roster.');
  }

  const expected = String(matched.passcode || '1234').trim();
  if (cleanPasscode !== expected) {
    throw new Error('Incorrect technician PIN. Please verify the credentials provided by your Administrator.');
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

