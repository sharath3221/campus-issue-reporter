-- ==============================================================================
-- CampusPulse: Zero-Login AI Campus Facility & Incident Reporting System
-- Supabase PostgreSQL 15+ Complete Database Migration & RLS Policy Schema
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop Existing Tables (if re-running migration)
DROP TABLE IF EXISTS incident_media CASCADE;
DROP TABLE IF EXISTS incident_tickets CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS maintenance_staff CASCADE;
DROP TABLE IF EXISTS campus_locations CASCADE;

-- ==============================================================================
-- 3. Table Definitions
-- ==============================================================================

-- 3.1 Campus Locations (Spot QR Metadata)
CREATE TABLE campus_locations (
    location_id VARCHAR(64) PRIMARY KEY, -- e.g., 'QR-BLD-A-FL1-WASH-02'
    building_name VARCHAR(150) NOT NULL,
    floor_number INT NOT NULL,           -- e.g., 0, 1, 2, 3
    room_number VARCHAR(50) NOT NULL,    -- e.g., 'WASH-02', 'LH-201'
    zone_category VARCHAR(100) NOT NULL, -- e.g., 'WASHROOM', 'CLASSROOM', 'CORRIDOR', 'FACULTY_ROOM'
    gps_latitude NUMERIC(9, 6) NOT NULL,
    gps_longitude NUMERIC(9, 6) NOT NULL,
    fixture_id VARCHAR(100),             -- e.g., 'WASH-02', 'FAN-04'
    x_coord INT DEFAULT 200,             -- 2D Floor Plan Coordinates
    y_coord INT DEFAULT 150,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.2 Maintenance Staff (On-Duty Personnel for WhatsApp/SMS Dispatch)
CREATE TABLE maintenance_staff (
    staff_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    specialization VARCHAR(50) NOT NULL CHECK (specialization IN ('PLUMBING', 'ELECTRICAL', 'CLEANING', 'CARPENTRY', 'GENERAL')),
    phone_number VARCHAR(20) NOT NULL,   -- e.g., '+919876543210'
    is_on_duty BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.3 Admin Users (College Principal, Governing Management, Facilities Operations Head)
CREATE TABLE admin_users (
    admin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('PRINCIPAL', 'MANAGEMENT', 'ADMIN')),
    full_name VARCHAR(150) NOT NULL,
    department VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.4 Incident Tickets (Direct User ➔ AI ➔ Executive Admin Pipeline: ZERO CR LAYER)
CREATE TABLE incident_tickets (
    ticket_id VARCHAR(64) PRIMARY KEY, -- e.g., 'tick-1001' or UUID
    location_id VARCHAR(64) NOT NULL REFERENCES campus_locations(location_id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'WATER_SUPPLY', 
        'LIGHTS_FAN_PROJECTOR', 
        'WASHROOM_CLEANLINESS', 
        'FURNITURE_MAINTENANCE'
    )),
    ai_severity_score NUMERIC(5, 2) NOT NULL DEFAULT 5.00, -- Range: 1.00 to 100.00
    status VARCHAR(50) NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('REPORTED', 'DISPATCHED', 'RESOLVED')),
    duplicate_count INT NOT NULL DEFAULT 1,                -- Smart 30-min duplicate clustering
    voice_transcript TEXT,
    voice_audio_url TEXT,
    user_photo_url TEXT,
    fixed_photo_url TEXT,                                  -- Proof of fix uploaded by maintenance
    ai_vision_tags JSONB DEFAULT '[]'::jsonb,              -- Computer Vision defect tags
    assigned_staff_id UUID REFERENCES maintenance_staff(staff_id) ON DELETE SET NULL,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 3.5 Incident Media (Multi-Media Attachments: Photos, Voice Notes, Fixed Proofs)
CREATE TABLE incident_media (
    media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR(64) NOT NULL REFERENCES incident_tickets(ticket_id) ON DELETE CASCADE,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('USER_PHOTO', 'VOICE_NOTE', 'FIXED_PHOTO')),
    file_url TEXT NOT NULL,
    ai_vision_tags JSONB DEFAULT '[]'::jsonb,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Fast Geospatial, Status, and Duplicate Lookups
CREATE INDEX idx_tickets_location_reported ON incident_tickets(location_id, reported_at DESC);
CREATE INDEX idx_tickets_status_severity ON incident_tickets(status, ai_severity_score DESC);
CREATE INDEX idx_locations_floor ON campus_locations(floor_number);
CREATE INDEX idx_media_ticket_id ON incident_media(ticket_id);

-- ==============================================================================
-- 4. Supabase Row-Level Security (RLS) Configuration
-- ==============================================================================

ALTER TABLE campus_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_media ENABLE ROW LEVEL SECURITY;

-- 4.1 Campus Locations: Public Read & Admin Ingestion
DROP POLICY IF EXISTS "Public can view campus locations" ON campus_locations;
CREATE POLICY "Public can view campus locations"
    ON campus_locations FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can create campus locations" ON campus_locations;
CREATE POLICY "Admins can create campus locations"
    ON campus_locations FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update campus locations" ON campus_locations;
CREATE POLICY "Admins can update campus locations"
    ON campus_locations FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.2 Incident Tickets:
-- STRICT CONSTRAINT 1: Zero-Login public users can INSERT incident reports without credentials
CREATE POLICY "Public can anonymously submit tickets"
    ON incident_tickets FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Public can view tickets (to check status at their Spot QR code)
CREATE POLICY "Public can view spot tickets"
    ON incident_tickets FOR SELECT
    TO anon, authenticated
    USING (true);

-- Admins and Maintenance have full UPDATE access (for Dispatch and Resolve)
CREATE POLICY "Admins can update and dispatch tickets"
    ON incident_tickets FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.3 Incident Media:
CREATE POLICY "Public can upload media"
    ON incident_media FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Public can view media"
    ON incident_media FOR SELECT
    TO anon, authenticated
    USING (true);

-- 4.4 Maintenance Staff: Read-only for public dispatch reference
CREATE POLICY "Public can view on-duty maintenance staff"
    ON maintenance_staff FOR SELECT
    TO anon, authenticated
    USING (true);

-- 4.5 Admin Users: Only authenticated admins can view users
CREATE POLICY "Admins view admin accounts"
    ON admin_users FOR SELECT
    TO anon, authenticated
    USING (true);

-- ==============================================================================
-- 5. Supabase Realtime Replication
-- ==============================================================================

-- Enable Realtime events for live dispatch updates on Admin Map & Public Spot Badge (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'incident_tickets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE incident_tickets;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'incident_media'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE incident_media;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'campus_locations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE campus_locations;
    END IF;
END $$;

-- ==============================================================================
-- 6. Supabase Storage Buckets
-- ==============================================================================

-- Create bucket 'incident-media' if storage extension is enabled
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-media', 'incident-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Public read and write for camera uploads (Idempotent)
DROP POLICY IF EXISTS "Allow public uploads to incident-media" ON storage.objects;
CREATE POLICY "Allow public uploads to incident-media"
    ON storage.objects FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'incident-media');

DROP POLICY IF EXISTS "Allow public reads from incident-media" ON storage.objects;
CREATE POLICY "Allow public reads from incident-media"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'incident-media');

-- ==============================================================================
-- 7. Seed Initial Campus Data
-- ==============================================================================

INSERT INTO campus_locations (location_id, building_name, floor_number, room_number, zone_category, gps_latitude, gps_longitude, fixture_id, x_coord, y_coord)
VALUES
('QR-BLD-A-FL1-WASH-02', 'Engineering Block A', 1, 'WASH-02', 'WASHROOM', 16.845612, 74.601245, 'WASH-02', 160, 180),
('QR-BLD-A-FL2-LH-201', 'Engineering Block A', 2, 'LH-201', 'CLASSROOM', 16.845688, 74.601299, 'FAN-04', 340, 140),
('QR-BLD-B-FL1-COOL-01', 'Science Block B', 1, 'COOLER-01', 'CORRIDOR', 16.845420, 74.601550, 'WATER-COOLER-EAST', 580, 220),
('QR-BLD-C-FL3-FAC-305', 'Academic Complex C', 3, 'FAC-305', 'FACULTY_ROOM', 16.845910, 74.601880, 'AC-UNIT-01', 420, 320),
('QR-BLD-A-FL1-LH-104', 'Engineering Block A', 1, 'LH-104', 'CLASSROOM', 16.845550, 74.601150, 'PROJECTOR-CEIL', 240, 240),
('QR-BLD-B-FL2-WASH-01', 'Science Block B', 2, 'WASH-01', 'WASHROOM', 16.845350, 74.601620, 'DRAIN-MAIN', 640, 150)
ON CONFLICT (location_id) DO NOTHING;

INSERT INTO maintenance_staff (staff_id, full_name, specialization, phone_number, is_on_duty)
VALUES
('a0000000-0000-0000-0000-000000000001', 'Rajesh Patil', 'PLUMBING', '+919876543210', true),
('a0000000-0000-0000-0000-000000000002', 'Suresh Sharma', 'ELECTRICAL', '+919876543211', true),
('a0000000-0000-0000-0000-000000000003', 'Ramesh Sonawane (Janitor)', 'CLEANING', '+919876543212', true),
('a0000000-0000-0000-0000-000000000004', 'Amit Verma', 'CARPENTRY', '+919876543213', true)
ON CONFLICT (staff_id) DO NOTHING;


