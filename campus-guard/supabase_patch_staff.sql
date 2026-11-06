-- ==============================================================================
-- CampusPulse: Maintenance Staff Table & RLS Policy Patch
-- Run this single snippet in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Ensure passcode column exists on maintenance_staff
ALTER TABLE IF EXISTS maintenance_staff 
ADD COLUMN IF NOT EXISTS passcode VARCHAR(50) DEFAULT '1234';

-- 2. Ensure RLS allows full CRUD for anon and authenticated admin sessions
ALTER TABLE IF EXISTS maintenance_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view on-duty maintenance staff" ON maintenance_staff;
CREATE POLICY "Public can view on-duty maintenance staff"
    ON maintenance_staff FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can insert maintenance staff" ON maintenance_staff;
CREATE POLICY "Admins can insert maintenance staff"
    ON maintenance_staff FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update maintenance staff" ON maintenance_staff;
CREATE POLICY "Admins can update maintenance staff"
    ON maintenance_staff FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete maintenance staff" ON maintenance_staff;
CREATE POLICY "Admins can delete maintenance staff"
    ON maintenance_staff FOR DELETE
    TO anon, authenticated
    USING (true);

-- 3. Confirm Realtime replication is enabled for instant multi-device roster sync
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'maintenance_staff'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_staff;
    END IF;
END $$;
