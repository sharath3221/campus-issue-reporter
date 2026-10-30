-- CampusPulse Database Schema Specification
-- PostgreSQL 15+ with Relational Integrity & Spatial Indexes

-- 1. Table: campus_locations
CREATE TABLE IF NOT EXISTS campus_locations (
    location_id VARCHAR(64) PRIMARY KEY, -- e.g., 'QR-BLD-A-FL1-WASH-02'
    building_name VARCHAR(150) NOT NULL,
    floor_number INT NOT NULL,           -- e.g., 0 for Ground, 1, 2, 3
    room_number VARCHAR(50),             -- e.g., 'WASH-02', 'LH-201', 'FAC-305'
    zone_category VARCHAR(100) NOT NULL, -- e.g., 'WASHROOM', 'CLASSROOM', 'CORRIDOR', 'FACULTY_ROOM'
    gps_latitude NUMERIC(9, 6) NOT NULL,
    gps_longitude NUMERIC(9, 6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table: maintenance_staff
CREATE TABLE IF NOT EXISTS maintenance_staff (
    staff_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    specialization VARCHAR(50) NOT NULL CHECK (specialization IN ('PLUMBING', 'ELECTRICAL', 'CLEANING', 'CARPENTRY', 'GENERAL')),
    phone_number VARCHAR(20) NOT NULL,   -- e.g., '+919876543210' for WhatsApp/SMS dispatch
    is_on_duty BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table: admin_users
CREATE TABLE IF NOT EXISTS admin_users (
    admin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('PRINCIPAL', 'MANAGEMENT', 'ADMIN')),
    full_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table: incident_tickets
-- Direct pipeline: User Submission -> AI Engine -> Admin Portal (NO CR Layer)
CREATE TABLE IF NOT EXISTS incident_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id VARCHAR(64) NOT NULL REFERENCES campus_locations(location_id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'WATER_SUPPLY', 
        'LIGHTS_FAN_PROJECTOR', 
        'WASHROOM_CLEANLINESS', 
        'FURNITURE_MAINTENANCE'
    )),
    ai_severity_score NUMERIC(5, 2) NOT NULL DEFAULT 5.00, -- Range: 1.00 to 100.00
    status VARCHAR(50) NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('REPORTED', 'DISPATCHED', 'RESOLVED')),
    duplicate_count INT NOT NULL DEFAULT 1,                -- Smart duplicate aggregation
    voice_transcript TEXT,
    assigned_staff_id UUID REFERENCES maintenance_staff(staff_id) ON DELETE SET NULL,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 5. Table: incident_media
CREATE TABLE IF NOT EXISTS incident_media (
    media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES incident_tickets(ticket_id) ON DELETE CASCADE,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('USER_PHOTO', 'VOICE_NOTE', 'FIXED_PHOTO')),
    file_url TEXT NOT NULL,
    ai_vision_tags JSONB DEFAULT '[]'::jsonb,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Fast Querying & Spatial/Duplicate Clustering
CREATE INDEX IF NOT EXISTS idx_tickets_location_time ON incident_tickets (location_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status_severity ON incident_tickets (status, ai_severity_score DESC);
CREATE INDEX IF NOT EXISTS idx_media_ticket ON incident_media (ticket_id);
CREATE INDEX IF NOT EXISTS idx_locations_floor ON campus_locations (building_name, floor_number);

