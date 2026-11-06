import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Layers,
  MapPin,
  Clock,
  Sparkles,
  Phone,
  Send,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Filter,
  Check,
  ChevronDown,
  Eye,
  Camera,
  ExternalLink,
  MessageSquare,
  Flame,
  Wrench,
  QrCode,
  Compass,
  Building,
  UserPlus,
  Search,
  X,
  RotateCcw,
  SlidersHorizontal,
  ArrowUpDown,
  Globe,
} from 'lucide-react';
import {
  IncidentTicket,
  TicketStatus,
  IncidentCategory,
  AdminUser,
  MaintenanceStaff,
  CATEGORY_META,
  STATUS_META,
} from '../types';
import { useIncidents } from '../hooks/useIncidents';
import { AdminStaffManager } from '../components/AdminStaffManager';
import { AdminArchitectureManager } from '../components/AdminArchitectureManager';
import { CampusFloorCanvas } from '../components/CampusFloorCanvas';
import { getActiveAdminSession, signOutAdmin, ADMIN_SESSION_KEY } from '../lib/supabaseAuth';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    tickets,
    maintenanceStaff,
    campusLocations,
    addCampusLocation,
    addCampusLocations,
    deleteCampusLocation,
    deleteCampusLocationsByBuilding,
    deleteCampusLocationsByFloor,
    updateLocationCoords,
    addMaintenanceStaff,
    toggleStaffDuty,
    deleteMaintenanceStaff,
    dispatchStaff,
    resolveTicket,
    isSupabaseConnected,
  } = useIncidents();

  // Navigation tab
  const [activeNavTab, setActiveNavTab] = useState<'OPERATIONS' | 'ARCHITECTURE' | 'STAFF'>('OPERATIONS');

  // Admin Session Check (Supports both Supabase Auth & LinkedIn Evaluator Demo)
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    try {
      const sess = localStorage.getItem(ADMIN_SESSION_KEY);
      if (sess) {
        const parsed = JSON.parse(sess);
        if (parsed?.admin_id) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  useEffect(() => {
    async function verifyAuth() {
      const session = await getActiveAdminSession();
      if (!session) {
        navigate('/admin/login');
      } else {
        setCurrentUser(session);
      }
    }
    verifyAuth();
  }, [navigate]);

  const handleLogout = async () => {
    await signOutAdmin();
    navigate('/admin/login');
  };

  // Map Navigation State
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Dynamically extract buildings from campusLocations
  const campusBuildingNames = Array.from(
    new Set(campusLocations.map((l) => l.building_name))
  );

  const [selectedMapBuilding, setSelectedMapBuilding] = useState<string>(() => {
    return campusBuildingNames[0] || 'Engineering Block A';
  });

  useEffect(() => {
    if (campusBuildingNames.length > 0 && !campusBuildingNames.includes(selectedMapBuilding)) {
      setSelectedMapBuilding(campusBuildingNames[0]);
    }
  }, [campusBuildingNames, selectedMapBuilding]);

  // Floors for the selected map building
  const mapBuildingFloors = Array.from(
    new Set(
      campusLocations
        .filter((l) => l.building_name === selectedMapBuilding)
        .map((l) => l.floor_number)
    )
  ).sort((a, b) => a - b);

  const availableMapFloors = mapBuildingFloors.length > 0 ? mapBuildingFloors : [1, 2, 3];

  useEffect(() => {
    if (!availableMapFloors.includes(selectedFloor) && availableMapFloors.length > 0) {
      setSelectedFloor(availableMapFloors[0]);
    }
  }, [availableMapFloors, selectedFloor]);

  // =========================================================================
  // Comprehensive Omni-Channel Ticket Filters (Campus-Wide / Irrespective of Block)
  // =========================================================================
  const [ticketSearchQuery, setTicketSearchQuery] = useState<string>('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<TicketStatus | 'ALL' | 'CRITICAL'>('ALL');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<IncidentCategory | 'ALL'>('ALL');
  const [ticketBuildingFilter, setTicketBuildingFilter] = useState<string>('ALL');
  const [ticketFloorFilter, setTicketFloorFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'SEVERITY_DESC' | 'DUPLICATES_DESC' | 'NEWEST'>('SEVERITY_DESC');

  // Extract all unique building names across the entire institution
  const allCampusBuildingNames = useMemo(() => {
    const fromLocs = campusLocations.map((l) => l.building_name);
    const fromTickets = tickets.map((t) => t.location?.building_name).filter(Boolean) as string[];
    const unique = Array.from(new Set([...fromLocs, ...fromTickets])).filter(Boolean);
    return unique.sort();
  }, [campusLocations, tickets]);

  // Extract all unique floor numbers across the entire institution
  const allCampusFloors = useMemo(() => {
    const fromLocs = campusLocations.map((l) => l.floor_number);
    const fromTickets = tickets
      .map((t) => t.location?.floor_number)
      .filter((f) => typeof f === 'number') as number[];
    const unique = Array.from(new Set([...fromLocs, ...fromTickets]));
    return unique.sort((a, b) => a - b);
  }, [campusLocations, tickets]);

  // Count active filters
  const activeFiltersCount =
    (ticketStatusFilter !== 'ALL' ? 1 : 0) +
    (ticketCategoryFilter !== 'ALL' ? 1 : 0) +
    (ticketBuildingFilter !== 'ALL' ? 1 : 0) +
    (ticketFloorFilter !== 'ALL' ? 1 : 0) +
    (ticketSearchQuery.trim() ? 1 : 0);

  // Reset all filters back to campus-wide view
  const handleResetFilters = () => {
    setTicketSearchQuery('');
    setTicketStatusFilter('ALL');
    setTicketCategoryFilter('ALL');
    setTicketBuildingFilter('ALL');
    setTicketFloorFilter('ALL');
    setSortBy('SEVERITY_DESC');
  };

  // 1-Click Locate on Spatial Map: Switches building and floor, highlights room
  const handleLocateOnMap = (ticket: IncidentTicket) => {
    if (ticket.location?.building_name) {
      setSelectedMapBuilding(ticket.location.building_name);
    }
    if (typeof ticket.location?.floor_number === 'number') {
      setSelectedFloor(ticket.location.floor_number);
    }
    setSelectedTicketId(ticket.ticket_id);

    const mapEl = document.getElementById('spatial-campus-blueprint-container');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Filtered and Sorted Tickets (Irrespective of floor / building block by default)
  const filteredTickets = useMemo(() => {
    let result = [...tickets];

    // 1. Status / Critical Filter
    if (ticketStatusFilter === 'CRITICAL') {
      result = result.filter((t) => t.ai_severity_score >= 80 && t.status !== 'RESOLVED');
    } else if (ticketStatusFilter !== 'ALL') {
      result = result.filter((t) => t.status === ticketStatusFilter);
    }

    // 2. Category Filter
    if (ticketCategoryFilter !== 'ALL') {
      result = result.filter((t) => t.category === ticketCategoryFilter);
    }

    // 3. Building / Block Filter
    if (ticketBuildingFilter !== 'ALL') {
      result = result.filter(
        (t) => t.location?.building_name?.toLowerCase() === ticketBuildingFilter.toLowerCase()
      );
    }

    // 4. Floor Filter
    if (ticketFloorFilter !== 'ALL') {
      const flNum = Number(ticketFloorFilter);
      result = result.filter((t) => t.location?.floor_number === flNum);
    }

    // 5. Keyword & Room Search Filter
    if (ticketSearchQuery.trim()) {
      const q = ticketSearchQuery.trim().toLowerCase();
      result = result.filter((t) => {
        const room = (t.location?.room_number || '').toLowerCase();
        const bld = (t.location?.building_name || '').toLowerCase();
        const tid = (t.ticket_id || '').toLowerCase();
        const tags = (t.ai_vision_tags || []).join(' ').toLowerCase();
        const transcript = (t.voice_transcript || '').toLowerCase();
        const staffName = (t.assigned_staff?.full_name || '').toLowerCase();
        const categoryLabel = (CATEGORY_META[t.category]?.label || '').toLowerCase();
        return (
          room.includes(q) ||
          bld.includes(q) ||
          tid.includes(q) ||
          tags.includes(q) ||
          transcript.includes(q) ||
          staffName.includes(q) ||
          categoryLabel.includes(q)
        );
      });
    }

    // 6. Sorting Order
    if (sortBy === 'SEVERITY_DESC') {
      result.sort((a, b) => b.ai_severity_score - a.ai_severity_score);
    } else if (sortBy === 'DUPLICATES_DESC') {
      result.sort((a, b) => (b.duplicate_count || 1) - (a.duplicate_count || 1));
    } else if (sortBy === 'NEWEST') {
      result.sort(
        (a, b) => new Date(b.reported_at || 0).getTime() - new Date(a.reported_at || 0).getTime()
      );
    }

    return result;
  }, [
    tickets,
    ticketStatusFilter,
    ticketCategoryFilter,
    ticketBuildingFilter,
    ticketFloorFilter,
    ticketSearchQuery,
    sortBy,
  ]);

  // Dispatch Modal State
  const [dispatchModalTicket, setDispatchModalTicket] = useState<IncidentTicket | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState('');

  // Fixed Proof Upload Modal
  const [resolveModalTicket, setResolveModalTicket] = useState<IncidentTicket | null>(null);
  const [fixedPhotoInput, setFixedPhotoInput] = useState<string>('');

  // KPI calculations
  const totalReported = tickets.filter((t) => t.status === 'REPORTED').length;
  const totalDispatched = tickets.filter((t) => t.status === 'DISPATCHED').length;
  const totalResolved = tickets.filter((t) => t.status === 'RESOLVED').length;
  const criticalCount = tickets.filter((t) => t.ai_severity_score >= 80 && t.status !== 'RESOLVED').length;

  // Handle Dispatch to Staff & WhatsApp/SMS link generation
  const handleConfirmDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModalTicket || !selectedStaffId) return;

    dispatchStaff(dispatchModalTicket.ticket_id, selectedStaffId);
    const staff = maintenanceStaff.find((s) => s.staff_id === selectedStaffId);

    // Build WhatsApp job message with direct upload proof link
    const uploadUrl = `${window.location.origin}/maintenance?ticket=${dispatchModalTicket.ticket_id}`;
    const msg = encodeURIComponent(
      `🚨 *CampusPulse Job Dispatch* (Priority ${dispatchModalTicket.ai_severity_score}/100)\n` +
        `• Location: ${dispatchModalTicket.location?.building_name}, Floor ${dispatchModalTicket.location?.floor_number}, Room: ${dispatchModalTicket.location?.room_number}\n` +
        `• Category: ${CATEGORY_META[dispatchModalTicket.category].label}\n` +
        `• Duplicates: ${dispatchModalTicket.duplicate_count} students reported\n` +
        `• Note: Immediate attendance required. Gemini AI defect verified.\n` +
        `• Authorized by: ${currentUser?.full_name} (${currentUser?.role})\n\n` +
        `📸 *Submit Fixed Photo Proof when done:*\n${uploadUrl}`
    );

    const waUrl = `https://wa.me/${staff?.phone_number.replace('+', '')}?text=${msg}`;

    setDispatchSuccessMsg(`Work Order dispatched to ${staff?.full_name}! Opening WhatsApp...`);
    setTimeout(() => {
      window.open(waUrl, '_blank');
      setDispatchModalTicket(null);
      setDispatchSuccessMsg('');
    }, 1200);
  };

  // Handle Resolve Ticket
  const handleConfirmResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveModalTicket) return;

    resolveTicket(
      resolveModalTicket.ticket_id,
      fixedPhotoInput ||
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80'
    );
    setResolveModalTicket(null);
    setFixedPhotoInput('');
  };

  if (!currentUser) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', paddingBottom: 60 }}>
      {/* Admin Executive Top Bar */}
      <header
        style={{
          background: '#0F172A',
          color: 'white',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#0288D1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={22} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              CampusPulse Executive Command Center
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span>Direct Submission → AI Engine → Administrative Dispatch (Zero-CR Pipeline)</span>
              {isSupabaseConnected ? (
                <span style={{ fontSize: '0.65rem', background: '#064E3B', color: '#34D399', padding: '1px 6px', borderRadius: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34D399' }} />
                  Supabase Realtime
                </span>
              ) : (
                <span style={{ fontSize: '0.65rem', background: '#1E293B', color: '#CBD5E1', padding: '1px 6px', borderRadius: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3, border: '1px solid #334155' }} title="Add Supabase credentials to .env for live cloud sync">
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#F59E0B' }} />
                  Supabase Ready (Hybrid Mode)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* User Info & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {currentUser.admin_id.startsWith('demo-') && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'linear-gradient(135deg, rgba(10, 102, 194, 0.2) 0%, rgba(2, 136, 209, 0.25) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                padding: '4px 10px',
                borderRadius: 8,
              }}
              title="Public LinkedIn Showcase Evaluator Session"
            >
              <span style={{ fontSize: '0.85rem' }}>⚡</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.02em' }}>
                LinkedIn Demo Admin
              </span>
            </div>
          )}

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{currentUser.full_name}</div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 10,
                background:
                  currentUser.role === 'PRINCIPAL'
                    ? '#DC2626'
                    : currentUser.role === 'MANAGEMENT'
                    ? '#7C3AED'
                    : '#0288D1',
                color: 'white',
              }}
            >
              {currentUser.role}
            </span>
          </div>

          <button
            onClick={() => navigate('/report')}
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              color: '#38BDF8',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            View Public Reporter
          </button>

          <button
            onClick={() => setActiveNavTab('STAFF')}
            style={{
              background: activeNavTab === 'STAFF' ? '#0288D1' : '#059669',
              border: 'none',
              color: 'white',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
            }}
          >
            <UserPlus size={14} />
            <span>+ Add Staff</span>
          </button>

          <button
            onClick={() => navigate('/maintenance')}
            style={{
              background: '#F59E0B20',
              border: '1px solid #F59E0B50',
              color: '#FCD34D',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Wrench size={14} />
            <span>Staff Portal</span>
          </button>

          <button
            onClick={handleLogout}
            style={{
              background: '#EF444420',
              border: '1px solid #EF444450',
              color: '#F87171',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Primary Sub-Navigation Bar */}
      <div
        style={{
          background: '#1E293B',
          borderBottom: '1px solid #334155',
          padding: '0 20px',
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <motion.button
          onClick={() => setActiveNavTab('OPERATIONS')}
          whileTap={{ scale: 0.98 }}
          style={{
            padding: '12px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeNavTab === 'OPERATIONS' ? '3px solid #38BDF8' : '3px solid transparent',
            color: activeNavTab === 'OPERATIONS' ? '#38BDF8' : '#94A3B8',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            transition: 'border 0.15s ease, color 0.15s ease',
          }}
        >
          <Layers size={16} />
          <span>Live Operations & Spatial Map</span>
        </motion.button>

        <motion.button
          onClick={() => setActiveNavTab('ARCHITECTURE')}
          whileTap={{ scale: 0.98 }}
          style={{
            padding: '12px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeNavTab === 'ARCHITECTURE' ? '3px solid #38BDF8' : '3px solid transparent',
            color: activeNavTab === 'ARCHITECTURE' ? '#38BDF8' : '#94A3B8',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            transition: 'border 0.15s ease, color 0.15s ease',
          }}
        >
          <Compass size={16} />
          <span>Campus Architecture & QR Codes</span>
          <span
            style={{
              background: '#0288D1',
              color: 'white',
              fontSize: '0.65rem',
              padding: '2px 7px',
              borderRadius: 10,
              fontWeight: 800,
            }}
          >
            {campusBuildingNames.length} Bldgs • {campusLocations.length} Rms
          </span>
        </motion.button>

        <motion.button
          onClick={() => setActiveNavTab('STAFF')}
          whileTap={{ scale: 0.98 }}
          style={{
            padding: '12px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeNavTab === 'STAFF' ? '3px solid #38BDF8' : '3px solid transparent',
            color: activeNavTab === 'STAFF' ? '#38BDF8' : '#94A3B8',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            transition: 'border 0.15s ease, color 0.15s ease',
          }}
        >
          <Wrench size={16} />
          <span>Maintenance Staff Roster</span>
          <span
            style={{
              background: '#059669',
              color: 'white',
              fontSize: '0.65rem',
              padding: '2px 7px',
              borderRadius: 10,
              fontWeight: 800,
            }}
          >
            {maintenanceStaff.length}
          </span>
        </motion.button>
      </div>

      {/* Main Content Area */}
      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px' }}>
        {activeNavTab === 'ARCHITECTURE' ? (
          <AdminArchitectureManager
            campusLocations={campusLocations}
            tickets={tickets}
            onAddLocation={addCampusLocation}
            onAddLocations={addCampusLocations}
            onDeleteLocation={deleteCampusLocation}
            onDeleteBuildingLocations={deleteCampusLocationsByBuilding}
            onDeleteFloorLocations={deleteCampusLocationsByFloor}
            onUpdateLocationCoords={updateLocationCoords}
          />
        ) : activeNavTab === 'STAFF' ? (
          <AdminStaffManager
            maintenanceStaff={maintenanceStaff}
            onAddStaff={addMaintenanceStaff}
            onToggleDuty={toggleStaffDuty}
            onDeleteStaff={deleteMaintenanceStaff}
          />
        ) : (
          <>
            {/* KPI Summary Cards (Interactive Filters) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          {/* Active Reported Card */}
          <div
            onClick={() => setTicketStatusFilter(ticketStatusFilter === 'REPORTED' ? 'ALL' : 'REPORTED')}
            style={{
              background: 'white',
              borderRadius: 16,
              padding: '16px 20px',
              border: ticketStatusFilter === 'REPORTED' ? '2px solid #EF4444' : '1px solid #E2E8F0',
              borderLeft: '5px solid #EF4444',
              boxShadow: ticketStatusFilter === 'REPORTED' ? '0 4px 14px rgba(239, 68, 68, 0.2)' : '0 2px 6px rgba(0,0,0,0.03)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Active Reported</span>
              {ticketStatusFilter === 'REPORTED' && (
                <span style={{ fontSize: '0.62rem', background: '#FEE2E2', color: '#DC2626', padding: '1px 6px', borderRadius: 6, fontWeight: 900 }}>FILTERED</span>
              )}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#DC2626', marginTop: 4 }}>{totalReported}</div>
            <div style={{ fontSize: '0.72rem', color: '#EF4444', fontWeight: 700 }}>Awaiting Technician Dispatch</div>
          </div>

          {/* Dispatched & En Route Card */}
          <div
            onClick={() => setTicketStatusFilter(ticketStatusFilter === 'DISPATCHED' ? 'ALL' : 'DISPATCHED')}
            style={{
              background: 'white',
              borderRadius: 16,
              padding: '16px 20px',
              border: ticketStatusFilter === 'DISPATCHED' ? '2px solid #F59E0B' : '1px solid #E2E8F0',
              borderLeft: '5px solid #F59E0B',
              boxShadow: ticketStatusFilter === 'DISPATCHED' ? '0 4px 14px rgba(245, 158, 11, 0.2)' : '0 2px 6px rgba(0,0,0,0.03)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Dispatched & En Route</span>
              {ticketStatusFilter === 'DISPATCHED' && (
                <span style={{ fontSize: '0.62rem', background: '#FEF3C7', color: '#D97706', padding: '1px 6px', borderRadius: 6, fontWeight: 900 }}>FILTERED</span>
              )}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#D97706', marginTop: 4 }}>{totalDispatched}</div>
            <div style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 700 }}>Maintenance Team on Site</div>
          </div>

          {/* Resolved with Proof Card */}
          <div
            onClick={() => setTicketStatusFilter(ticketStatusFilter === 'RESOLVED' ? 'ALL' : 'RESOLVED')}
            style={{
              background: 'white',
              borderRadius: 16,
              padding: '16px 20px',
              border: ticketStatusFilter === 'RESOLVED' ? '2px solid #10B981' : '1px solid #E2E8F0',
              borderLeft: '5px solid #10B981',
              boxShadow: ticketStatusFilter === 'RESOLVED' ? '0 4px 14px rgba(16, 185, 129, 0.2)' : '0 2px 6px rgba(0,0,0,0.03)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Resolved with Proof</span>
              {ticketStatusFilter === 'RESOLVED' && (
                <span style={{ fontSize: '0.62rem', background: '#DCFCE7', color: '#15803D', padding: '1px 6px', borderRadius: 6, fontWeight: 900 }}>FILTERED</span>
              )}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#059669', marginTop: 4 }}>{totalResolved}</div>
            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>Fixed Photo Uploaded</div>
          </div>

          {/* Critical Urgency Card */}
          <div
            onClick={() => setTicketStatusFilter(ticketStatusFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
            style={{
              background: 'white',
              borderRadius: 16,
              padding: '16px 20px',
              border: ticketStatusFilter === 'CRITICAL' ? '2px solid #8B5CF6' : '1px solid #E2E8F0',
              borderLeft: '5px solid #8B5CF6',
              boxShadow: ticketStatusFilter === 'CRITICAL' ? '0 4px 14px rgba(139, 92, 246, 0.2)' : '0 2px 6px rgba(0,0,0,0.03)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Critical Urgency (&gt;80)</span>
              {ticketStatusFilter === 'CRITICAL' && (
                <span style={{ fontSize: '0.62rem', background: '#EDE9FE', color: '#6D28D9', padding: '1px 6px', borderRadius: 6, fontWeight: 900 }}>FILTERED</span>
              )}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#7C3AED', marginTop: 4 }}>{criticalCount}</div>
            <div style={{ fontSize: '0.72rem', color: '#7C3AED', fontWeight: 700 }}>Multi-Student Clustered</div>
          </div>
        </div>

        {/* 2-Column Main Section: Spatial Map (Left) & Prioritized Ticket Feed (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 24, alignItems: 'start' }}>
          {/* Column 1: LIVE SPATIAL CAMPUS MAP DASHBOARD (§3) */}
          <div
            id="spatial-campus-blueprint-container"
            style={{
              background: 'white',
              borderRadius: 20,
              padding: 20,
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={20} color="#0288D1" />
                  <span>Live Spatial Campus Floor Map</span>
                </h2>
                <p style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Floor-wise spatial pins colored by AI urgency and ticket progression
                </p>
              </div>

              {/* Dynamic Building & Multi-Floor Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {campusBuildingNames.length > 1 && (
                  <select
                    value={selectedMapBuilding}
                    onChange={(e) => setSelectedMapBuilding(e.target.value)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 8,
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      background: 'white',
                      color: '#0F172A',
                    }}
                  >
                    {campusBuildingNames.map((bName) => (
                      <option key={bName} value={bName}>
                        {bName}
                      </option>
                    ))}
                  </select>
                )}

                <div style={{ display: 'flex', gap: 6, background: '#F1F5F9', padding: 4, borderRadius: 10, overflowX: 'auto' }}>
                  {availableMapFloors.map((floor) => (
                    <button
                      key={floor}
                      type="button"
                      onClick={() => setSelectedFloor(floor)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: selectedFloor === floor ? '#0288D1' : 'transparent',
                        color: selectedFloor === floor ? 'white' : '#475569',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {floor === -1 ? 'Basement' : floor === 0 ? 'Ground' : `Floor ${floor}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive College Floor Plan Canvas */}
            <CampusFloorCanvas
              buildingName={selectedMapBuilding}
              floorNumber={selectedFloor}
              campusLocations={campusLocations}
              tickets={tickets}
              selectedTicketId={selectedTicketId}
              onSelectTicket={setSelectedTicketId}
              onUpdateLocationCoords={updateLocationCoords}
              onAddLocation={addCampusLocation}
              onDeleteLocation={deleteCampusLocation}
            />
          </div>

          {/* Column 2: INCIDENT MANAGEMENT FEED — OMNI-CHANNEL ACCESS (§3) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Comprehensive Filter Bar & Search Controls */}
            <div
              style={{
                background: 'white',
                borderRadius: 18,
                padding: '14px 18px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Top Row: Title, Result Count & Status Tabs */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: '#E0F2FE',
                      color: '#0288D1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Filter size={16} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Incident Feed</span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          background: '#F1F5F9',
                          color: '#475569',
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontWeight: 800,
                        }}
                      >
                        {filteredTickets.length} of {tickets.length}
                      </span>
                    </h3>
                  </div>
                </div>

                {/* Status Tabs */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[
                    { key: 'ALL' as const, label: 'ALL', count: tickets.length },
                    { key: 'REPORTED' as const, label: 'REPORTED', count: totalReported },
                    { key: 'DISPATCHED' as const, label: 'DISPATCHED', count: totalDispatched },
                    { key: 'RESOLVED' as const, label: 'RESOLVED', count: totalResolved },
                    { key: 'CRITICAL' as const, label: '🔥 CRITICAL', count: criticalCount },
                  ].map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setTicketStatusFilter(st.key)}
                      style={{
                        padding: '4px 9px',
                        borderRadius: 8,
                        border: 'none',
                        background: ticketStatusFilter === st.key ? '#0288D1' : '#F1F5F9',
                        color: ticketStatusFilter === st.key ? 'white' : '#475569',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{st.label}</span>
                      {st.count !== undefined && (
                        <span
                          style={{
                            fontSize: '0.62rem',
                            padding: '1px 5px',
                            borderRadius: 10,
                            background: ticketStatusFilter === st.key ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                            color: ticketStatusFilter === st.key ? 'white' : '#64748B',
                          }}
                        >
                          {st.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar Input */}
              <div style={{ position: 'relative', width: '100%' }}>
                <Search
                  size={15}
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
                />
                <input
                  type="text"
                  value={ticketSearchQuery}
                  onChange={(e) => setTicketSearchQuery(e.target.value)}
                  placeholder="Search by room (e.g. WASH-02), building, defect keyword, #tag..."
                  style={{
                    width: '100%',
                    padding: '8px 34px 8px 34px',
                    borderRadius: 10,
                    border: '1.5px solid #E2E8F0',
                    fontSize: '0.8rem',
                    background: '#F8FAFC',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {ticketSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTicketSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: 2,
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Multi-Faceted Filters Row: Building, Floor, Category, Sort */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                {/* Building / Block Filter */}
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 2 }}>
                    BUILDING / BLOCK
                  </label>
                  <select
                    value={ticketBuildingFilter}
                    onChange={(e) => setTicketBuildingFilter(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: ticketBuildingFilter !== 'ALL' ? '1.5px solid #0288D1' : '1px solid #CBD5E1',
                      background: ticketBuildingFilter !== 'ALL' ? '#F0F9FF' : 'white',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: ticketBuildingFilter !== 'ALL' ? '#0369A1' : '#0F172A',
                      outline: 'none',
                    }}
                  >
                    <option value="ALL">🏢 All Buildings / Blocks</option>
                    {allCampusBuildingNames.map((bName) => (
                      <option key={bName} value={bName}>
                        {bName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Floor Filter */}
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 2 }}>
                    FLOOR LEVEL
                  </label>
                  <select
                    value={ticketFloorFilter}
                    onChange={(e) => setTicketFloorFilter(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: ticketFloorFilter !== 'ALL' ? '1.5px solid #0288D1' : '1px solid #CBD5E1',
                      background: ticketFloorFilter !== 'ALL' ? '#F0F9FF' : 'white',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: ticketFloorFilter !== 'ALL' ? '#0369A1' : '#0F172A',
                      outline: 'none',
                    }}
                  >
                    <option value="ALL">🪜 All Floors (Campus-Wide)</option>
                    {allCampusFloors.map((fl) => (
                      <option key={fl} value={fl.toString()}>
                        {fl === -1 ? 'Basement' : fl === 0 ? 'Ground Floor' : `Floor ${fl}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Defect Category Filter */}
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 2 }}>
                    DEFECT CATEGORY
                  </label>
                  <select
                    value={ticketCategoryFilter}
                    onChange={(e) => setTicketCategoryFilter(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: ticketCategoryFilter !== 'ALL' ? '1.5px solid #0288D1' : '1px solid #CBD5E1',
                      background: ticketCategoryFilter !== 'ALL' ? '#F0F9FF' : 'white',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: ticketCategoryFilter !== 'ALL' ? '#0369A1' : '#0F172A',
                      outline: 'none',
                    }}
                  >
                    <option value="ALL">🏷️ All Categories</option>
                    <option value="WATER_SUPPLY">💧 Water Supply / Cooler</option>
                    <option value="LIGHTS_FAN_PROJECTOR">💡 Lights / Fan / Projector</option>
                    <option value="WASHROOM_CLEANLINESS">🧹 Washroom Cleanliness</option>
                    <option value="FURNITURE_MAINTENANCE">🪑 Furniture / Maintenance</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 2 }}>
                    SORT PRIORITY
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      background: 'white',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#0F172A',
                      outline: 'none',
                    }}
                  >
                    <option value="SEVERITY_DESC">⚡ Highest AI Score First</option>
                    <option value="DUPLICATES_DESC">👥 Most Clustered (+N)</option>
                    <option value="NEWEST">🕒 Newest First</option>
                  </select>
                </div>
              </div>

              {/* Active Filter Pills Bar & Quick Sync Switch */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                  paddingTop: 8,
                  borderTop: '1px dashed #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {/* Quick Blueprint Sync Pill */}
                  <button
                    type="button"
                    onClick={() => {
                      if (ticketBuildingFilter === selectedMapBuilding && ticketFloorFilter === selectedFloor.toString()) {
                        // Toggle back to campus-wide
                        setTicketBuildingFilter('ALL');
                        setTicketFloorFilter('ALL');
                      } else {
                        // Sync to map
                        setTicketBuildingFilter(selectedMapBuilding);
                        setTicketFloorFilter(selectedFloor.toString());
                      }
                    }}
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background:
                        ticketBuildingFilter === selectedMapBuilding && ticketFloorFilter === selectedFloor.toString()
                          ? '#0288D1'
                          : '#F8FAFC',
                      color:
                        ticketBuildingFilter === selectedMapBuilding && ticketFloorFilter === selectedFloor.toString()
                          ? 'white'
                          : '#0F172A',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <MapPin size={12} />
                    <span>
                      {ticketBuildingFilter === selectedMapBuilding && ticketFloorFilter === selectedFloor.toString()
                        ? `Locked to Map (${selectedMapBuilding} • Fl ${selectedFloor})`
                        : `Filter to Map View (${selectedMapBuilding} • Fl ${selectedFloor})`}
                    </span>
                  </button>

                  {/* Active Filter Badges */}
                  {ticketBuildingFilter !== 'ALL' && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: '#E0F2FE',
                        color: '#0369A1',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>🏢 {ticketBuildingFilter}</span>
                      <X size={11} style={{ cursor: 'pointer' }} onClick={() => setTicketBuildingFilter('ALL')} />
                    </span>
                  )}

                  {ticketFloorFilter !== 'ALL' && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: '#E0F2FE',
                        color: '#0369A1',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>🪜 Floor {ticketFloorFilter}</span>
                      <X size={11} style={{ cursor: 'pointer' }} onClick={() => setTicketFloorFilter('ALL')} />
                    </span>
                  )}

                  {ticketCategoryFilter !== 'ALL' && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: '#E0F2FE',
                        color: '#0369A1',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>🏷️ {CATEGORY_META[ticketCategoryFilter]?.label}</span>
                      <X size={11} style={{ cursor: 'pointer' }} onClick={() => setTicketCategoryFilter('ALL')} />
                    </span>
                  )}

                  {ticketStatusFilter !== 'ALL' && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: '#EDE9FE',
                        color: '#6D28D9',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>⚡ {ticketStatusFilter}</span>
                      <X size={11} style={{ cursor: 'pointer' }} onClick={() => setTicketStatusFilter('ALL')} />
                    </span>
                  )}

                  {ticketSearchQuery && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: '#FEF3C7',
                        color: '#92400E',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>🔍 "{ticketSearchQuery}"</span>
                      <X size={11} style={{ cursor: 'pointer' }} onClick={() => setTicketSearchQuery('')} />
                    </span>
                  )}
                </div>

                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: 'none',
                      border: 'none',
                      color: '#EF4444',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 6px',
                    }}
                  >
                    <RotateCcw size={11} />
                    <span>Clear All Filters</span>
                  </button>
                )}
              </div>
            </div>

            {/* List of Prioritized Tickets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              {filteredTickets.map((ticket) => {
                const meta = CATEGORY_META[ticket.category];
                const isSelected = selectedTicketId === ticket.ticket_id;

                return (
                  <div
                    key={ticket.ticket_id}
                    style={{
                      background: 'white',
                      borderRadius: 16,
                      padding: 16,
                      border: isSelected ? '2.5px solid #0288D1' : '1px solid #E2E8F0',
                      boxShadow: isSelected ? '0 8px 24px rgba(2, 136, 209, 0.2)' : '0 2px 8px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Top Row: Category, Spatial Location Badges, Urgency Score, Duplicates */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{meta.icon}</span>
                        <div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#0F172A' }}>
                            {meta.label}
                          </div>
                          {/* Location Badges (Omni-Channel Visibility across any block/floor) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                            <span style={{ fontSize: '0.7rem', background: '#F1F5F9', color: '#1E293B', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>
                              🏢 {ticket.location?.building_name || 'Campus Building'}
                            </span>
                            <span style={{ fontSize: '0.7rem', background: '#F1F5F9', color: '#1E293B', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>
                              🪜 Floor {ticket.location?.floor_number ?? 1}
                            </span>
                            <span style={{ fontSize: '0.7rem', background: '#E0F2FE', color: '#0369A1', padding: '2px 7px', borderRadius: 6, fontWeight: 800 }}>
                              🚪 Rm {ticket.location?.room_number || 'Zone'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* AI Urgency Score & Duplicate Count Badge (§3) */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 900,
                            padding: '3px 10px',
                            borderRadius: 20,
                            background: ticket.ai_severity_score >= 80 ? '#FEE2E2' : '#FEF3C7',
                            color: ticket.ai_severity_score >= 80 ? '#991B1B' : '#92400E',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Flame size={13} />
                          AI Score: {ticket.ai_severity_score}
                        </span>

                        {ticket.duplicate_count > 1 && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              background: '#E0F2FE',
                              color: '#0369A1',
                              padding: '2px 8px',
                              borderRadius: 12,
                            }}
                          >
                            +{ticket.duplicate_count} reports clustered
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Media Attachments & Gemini AI Tags */}
                    <div style={{ display: 'grid', gridTemplateColumns: ticket.user_photo_url ? '80px 1fr' : '1fr', gap: 12, alignItems: 'center' }}>
                      {ticket.user_photo_url && (
                        <img
                          src={ticket.user_photo_url}
                          alt="Defect"
                          style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover' }}
                        />
                      )}

                      <div>
                        {/* AI Vision Tags */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {ticket.ai_vision_tags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                fontSize: '0.65rem',
                                background: '#F1F5F9',
                                color: '#475569',
                                padding: '1px 6px',
                                borderRadius: 4,
                                fontWeight: 700,
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions Row: Dispatch to Maintenance OR Mark Resolved + Locate on Map */}
                    <div
                      style={{
                        paddingTop: 10,
                        borderTop: '1px solid #F1F5F9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: STATUS_META[ticket.status].bgColor,
                            color: STATUS_META[ticket.status].color,
                          }}
                        >
                          {STATUS_META[ticket.status].label}
                        </span>

                        {ticket.assigned_staff && (
                          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                            Assigned: <strong>{ticket.assigned_staff.full_name}</strong>
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {/* Locate on Map Button: Instantly switches map view to this problem's building/floor */}
                        <button
                          type="button"
                          onClick={() => handleLocateOnMap(ticket)}
                          style={{
                            background: '#F0F9FF',
                            color: '#0288D1',
                            border: '1px solid #BAE6FD',
                            borderRadius: 8,
                            padding: '6px 10px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'all 0.15s ease',
                          }}
                          title="Switch blueprint view to this room"
                        >
                          <MapPin size={13} />
                          <span>Locate on Map</span>
                        </button>

                        {ticket.status === 'REPORTED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setDispatchModalTicket(ticket);
                              // Auto-select staff by category specialization
                              const match = maintenanceStaff.find(
                                (s) => s.specialization === meta.defaultStaffSpec
                              );
                              setSelectedStaffId(match?.staff_id || maintenanceStaff[0]?.staff_id || '');
                            }}
                            style={{
                              background: '#0288D1',
                              color: 'white',
                              border: 'none',
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <Send size={13} />
                            <span>Dispatch to Maintenance</span>
                          </button>
                        )}

                        {ticket.status === 'DISPATCHED' && (
                          <button
                            type="button"
                            onClick={() => setResolveModalTicket(ticket)}
                            style={{
                              background: '#10B981',
                              color: 'white',
                              border: 'none',
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <CheckCircle2 size={13} />
                            <span>Mark Resolved & Upload Proof</span>
                          </button>
                        )}

                        {ticket.status === 'RESOLVED' && ticket.fixed_photo_url && (
                          <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check size={14} strokeWidth={3} />
                            <span>Verified Fixed</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Empty State when no incidents match the filters */}
              {filteredTickets.length === 0 && (
                <div
                  style={{
                    background: 'white',
                    borderRadius: 16,
                    border: '2px dashed #CBD5E1',
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: '#64748B',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: '#F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                      color: '#94A3B8',
                    }}
                  >
                    <Filter size={22} />
                  </div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B', margin: '0 0 6px' }}>
                    No Incidents Match Selected Filters
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', maxWidth: 360, margin: '0 auto 14px', lineHeight: 1.5 }}>
                    No campus problems found matching your current search or filter criteria.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 8,
                      background: '#0288D1',
                      color: 'white',
                      border: 'none',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>Clear All Filters & Show Campus-Wide</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        </>
      )}
      </main>

      {/* DISPATCH TO MAINTENANCE MODAL (§3) */}
      {dispatchModalTicket && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 20,
              padding: 24,
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>
              Dispatch Maintenance Work Order
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 16 }}>
              Sends instant job alert via WhatsApp/SMS to on-duty field technician.
            </p>

            <form onSubmit={handleConfirmDispatch} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Select On-Duty Staff Member:
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 10,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                  }}
                >
                  {maintenanceStaff.map((staff) => (
                    <option key={staff.staff_id} value={staff.staff_id}>
                      {staff.full_name} ({staff.specialization}) - {staff.phone_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Work Order Preview */}
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 12, border: '1px solid #E2E8F0', fontSize: '0.78rem' }}>
                <div style={{ fontWeight: 800, color: '#0F172A' }}>
                  Target: {dispatchModalTicket.location?.building_name} (Rm {dispatchModalTicket.location?.room_number})
                </div>
                <div style={{ color: '#64748B', marginTop: 2 }}>
                  Severity Score: {dispatchModalTicket.ai_severity_score}/100 • {dispatchModalTicket.duplicate_count} reports
                </div>
              </div>

              {dispatchSuccessMsg ? (
                <div style={{ color: '#059669', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>
                  {dispatchSuccessMsg}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setDispatchModalTicket(null)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      background: 'white',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#0288D1',
                      color: 'white',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Send size={14} />
                    <span>Send Dispatch via WhatsApp / SMS</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* MARK RESOLVED & FIXED PHOTO UPLOAD MODAL */}
      {resolveModalTicket && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 20,
              padding: 24,
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>
              Mark Resolved with Fixed Proof Photo (§2)
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 16 }}>
              The fixed photo proof will be immediately visible on the public spot QR badge.
            </p>

            <form onSubmit={handleConfirmResolve} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Fixed Proof Photo URL:
                </label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={fixedPhotoInput}
                  onChange={(e) => setFixedPhotoInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 10,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.85rem',
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: 4, display: 'block' }}>
                  (Leave empty to use high-res default repair proof photo)
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setResolveModalTicket(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    background: 'white',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#10B981',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Confirm & Update Public Spot Badge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

