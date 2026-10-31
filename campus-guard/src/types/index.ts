// CampusPulse Type Definitions

export type IncidentCategory =
  | 'WATER_SUPPLY'
  | 'LIGHTS_FAN_PROJECTOR'
  | 'WASHROOM_CLEANLINESS'
  | 'FURNITURE_MAINTENANCE';

export type TicketStatus = 'REPORTED' | 'DISPATCHED' | 'RESOLVED';

export type AdminRole = 'PRINCIPAL' | 'MANAGEMENT' | 'ADMIN';

export type StaffSpecialization = 'PLUMBING' | 'ELECTRICAL' | 'CLEANING' | 'CARPENTRY' | 'GENERAL';

export interface CampusLocation {
  location_id: string; // e.g., 'QR-BLD-A-FL1-WASH-02'
  building_name: string;
  floor_number: number;
  room_number: string;
  zone_category: 'WASHROOM' | 'CLASSROOM' | 'CORRIDOR' | 'FACULTY_ROOM' | 'LABORATORY';
  gps_latitude: number;
  gps_longitude: number;
  fixture_id?: string;
  x_coord?: number; // Spatial Map 2D Coordinate
  y_coord?: number;
}

export interface CampusBuildingConfig {
  building_id: string;
  building_name: string;
  building_code: string;
  floors_count: number;
  description?: string;
}

export interface MaintenanceStaff {
  staff_id: string;
  full_name: string;
  specialization: StaffSpecialization;
  phone_number: string;
  is_on_duty: boolean;
  passcode?: string; // 4-digit PIN or password for technician duty login
}

export interface AdminUser {
  admin_id: string;
  email: string;
  role: AdminRole;
  full_name: string;
  department?: string;
}

export interface IncidentMedia {
  media_id: string;
  ticket_id: string;
  media_type: 'USER_PHOTO' | 'VOICE_NOTE' | 'FIXED_PHOTO';
  file_url: string;
  ai_vision_tags: string[];
  uploaded_at: string;
}

export interface IncidentTicket {
  ticket_id: string;
  location_id: string;
  location?: CampusLocation;
  category: IncidentCategory;
  ai_severity_score: number; // 1.0 to 100.0
  status: TicketStatus;
  duplicate_count: number;
  voice_transcript?: string;
  voice_audio_url?: string;
  assigned_staff_id?: string;
  assigned_staff?: MaintenanceStaff;
  reported_at: string;
  dispatched_at?: string;
  resolved_at?: string;
  user_photo_url?: string;
  fixed_photo_url?: string;
  ai_vision_tags: string[];
}

export const CATEGORY_META: Record<
  IncidentCategory,
  {
    label: string;
    sublabel: string;
    audioText: string;
    icon: string;
    color: string;
    bgColor: string;
    defaultStaffSpec: StaffSpecialization;
  }
> = {
  WATER_SUPPLY: {
    label: 'Water Supply / Cooler',
    sublabel: 'Leaks, Empty Cooler, Taps',
    audioText: 'Water Supply or Cooler Problem reported',
    icon: '🚰',
    color: '#0288D1',
    bgColor: '#E1F5FE',
    defaultStaffSpec: 'PLUMBING',
  },
  LIGHTS_FAN_PROJECTOR: {
    label: 'Lights / Fan / Projector',
    sublabel: 'Wiring, Sparks, Display',
    audioText: 'Electrical, Fan, or Projector fault reported',
    icon: '💡',
    color: '#F57C00',
    bgColor: '#FFF3E0',
    defaultStaffSpec: 'ELECTRICAL',
  },
  WASHROOM_CLEANLINESS: {
    label: 'Washroom / Cleanliness',
    sublabel: 'Hygiene, Garbage, Odor',
    audioText: 'Washroom or cleaning needed',
    icon: '🧹',
    color: '#388E3C',
    bgColor: '#E8F5E9',
    defaultStaffSpec: 'CLEANING',
  },
  FURNITURE_MAINTENANCE: {
    label: 'Furniture / Maintenance',
    sublabel: 'Broken Desk, Door, Ceiling',
    audioText: 'Furniture or structural maintenance needed',
    icon: '🪑',
    color: '#7B1FA2',
    bgColor: '#F3E5F5',
    defaultStaffSpec: 'CARPENTRY',
  },
};

export const STATUS_META: Record<
  TicketStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    stepIndex: number;
  }
> = {
  REPORTED: {
    label: 'Report Submitted',
    color: '#D32F2F',
    bgColor: '#FFEBEE',
    stepIndex: 1,
  },
  DISPATCHED: {
    label: 'Technician Dispatched',
    color: '#F57F17',
    bgColor: '#FFF8E1',
    stepIndex: 2,
  },
  RESOLVED: {
    label: 'Issue Resolved',
    color: '#2E7D32',
    bgColor: '#E8F5E9',
    stepIndex: 3,
  },
};
