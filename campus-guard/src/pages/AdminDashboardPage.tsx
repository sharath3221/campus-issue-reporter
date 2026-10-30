import React, { useState, useEffect } from 'react';
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
  Volume2,
  Eye,
  Camera,
  ExternalLink,
  MessageSquare,
  Flame,
  Wrench,
  QrCode,
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
import { QRSpotGenerator } from '../components/QRSpotGenerator';
import { getActiveAdminSession, signOutAdmin, ADMIN_SESSION_KEY } from '../lib/supabaseAuth';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    tickets,
    maintenanceStaff,
    campusLocations,
    addCampusLocation,
    dispatchStaff,
    resolveTicket,
    isSupabaseConnected,
  } = useIncidents();

  // Navigation tab
  const [activeNavTab, setActiveNavTab] = useState<'OPERATIONS' | 'QR_STUDIO'>('OPERATIONS');

  // Admin Session Check (Strict Constraint 3)
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    try {
      const sess = localStorage.getItem(ADMIN_SESSION_KEY);
      if (sess) return JSON.parse(sess);
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

  // Filters & State
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'ALL'>('ALL');
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Dispatch Modal State
  const [dispatchModalTicket, setDispatchModalTicket] = useState<IncidentTicket | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState('');

  // Fixed Proof Upload Modal
  const [resolveModalTicket, setResolveModalTicket] = useState<IncidentTicket | null>(null);
  const [fixedPhotoInput, setFixedPhotoInput] = useState<string>('');

  // Sort tickets by AI Severity Score (highest first)
  const sortedTickets = [...tickets].sort((a, b) => b.ai_severity_score - a.ai_severity_score);

  const filteredTickets = sortedTickets.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (selectedFloor !== 0 && t.location?.floor_number !== selectedFloor) return false;
    return true;
  });

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
        `• Note: ${dispatchModalTicket.voice_transcript || 'Immediate attendance required.'}\n` +
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
          padding: '0 24px',
          display: 'flex',
          gap: 12,
        }}
      >
        <button
          onClick={() => setActiveNavTab('OPERATIONS')}
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
            transition: 'all 0.15s ease',
          }}
        >
          <Layers size={16} />
          <span>Live Operations & Spatial Map</span>
        </button>

        <button
          onClick={() => setActiveNavTab('QR_STUDIO')}
          style={{
            padding: '12px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeNavTab === 'QR_STUDIO' ? '3px solid #38BDF8' : '3px solid transparent',
            color: activeNavTab === 'QR_STUDIO' ? '#38BDF8' : '#94A3B8',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <QrCode size={16} />
          <span>Spot QR Sticker Generator & Directory</span>
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
            {campusLocations.length}
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px' }}>
        {activeNavTab === 'QR_STUDIO' ? (
          <QRSpotGenerator
            campusLocations={campusLocations}
            onAddLocation={addCampusLocation}
          />
        ) : (
          <>
            {/* KPI Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '16px 20px', border: '1px solid #E2E8F0', borderLeft: '5px solid #EF4444', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Active Reported</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#DC2626', marginTop: 4 }}>{totalReported}</div>
            <div style={{ fontSize: '0.72rem', color: '#EF4444', fontWeight: 700 }}>Awaiting Technician Dispatch</div>
          </div>

          <div style={{ background: 'white', borderRadius: 16, padding: '16px 20px', border: '1px solid #E2E8F0', borderLeft: '5px solid #F59E0B', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Dispatched & En Route</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#D97706', marginTop: 4 }}>{totalDispatched}</div>
            <div style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 700 }}>Maintenance Team on Site</div>
          </div>

          <div style={{ background: 'white', borderRadius: 16, padding: '16px 20px', border: '1px solid #E2E8F0', borderLeft: '5px solid #10B981', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Resolved with Proof</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#059669', marginTop: 4 }}>{totalResolved}</div>
            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>Fixed Photo Uploaded</div>
          </div>

          <div style={{ background: 'white', borderRadius: 16, padding: '16px 20px', border: '1px solid #E2E8F0', borderLeft: '5px solid #8B5CF6', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Critical Urgency (&gt;80)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#7C3AED', marginTop: 4 }}>{criticalCount}</div>
            <div style={{ fontSize: '0.72rem', color: '#7C3AED', fontWeight: 700 }}>Multi-Student Clustered</div>
          </div>
        </div>

        {/* 2-Column Main Section: Spatial Map (Left) & Prioritized Ticket Feed (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 24, alignItems: 'start' }}>
          {/* Column 1: LIVE SPATIAL CAMPUS MAP DASHBOARD (§3) */}
          <div
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

              {/* Multi-Floor Selector (§3) */}
              <div style={{ display: 'flex', gap: 6, background: '#F1F5F9', padding: 4, borderRadius: 10 }}>
                {[1, 2, 3].map((floor) => (
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
                    }}
                  >
                    Floor {floor}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive SVG Floor Map */}
            <div
              style={{
                position: 'relative',
                background: '#F8FAFC',
                borderRadius: 14,
                border: '1.5px solid #E2E8F0',
                overflow: 'hidden',
              }}
            >
              <svg viewBox="0 0 760 420" style={{ width: '100%', height: 'auto', display: 'block' }}>
                {/* Floor Blueprint Grid */}
                <defs>
                  <pattern id="admin-grid" width="25" height="25" patternUnits="userSpaceOnUse">
                    <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#E2E8F0" strokeWidth="0.8" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#admin-grid)" />

                {/* Building Zones on Floor */}
                {/* Zone 1: Washrooms */}
                <rect x="80" y="80" width="180" height="150" rx="10" fill="#E0F2FE" stroke="#7DD3FC" strokeWidth="2" />
                <text x="170" y="150" textAnchor="middle" fill="#0369A1" fontSize="12" fontWeight="800">
                  Washroom Cluster
                </text>
                <text x="170" y="168" textAnchor="middle" fill="#0284C7" fontSize="9" fontWeight="600">
                  Floor {selectedFloor} Zone
                </text>

                {/* Zone 2: Lecture Halls */}
                <rect x="290" y="70" width="220" height="180" rx="10" fill="#FEF3C7" stroke="#FCD34D" strokeWidth="2" />
                <text x="400" y="150" textAnchor="middle" fill="#92400E" fontSize="12" fontWeight="800">
                  Lecture Halls & Classrooms
                </text>
                <text x="400" y="168" textAnchor="middle" fill="#B45309" fontSize="9" fontWeight="600">
                  LH-{selectedFloor}01 to LH-{selectedFloor}06
                </text>

                {/* Zone 3: Corridor / Water Coolers */}
                <rect x="540" y="110" width="160" height="190" rx="10" fill="#F3E8FF" stroke="#D8B4FE" strokeWidth="2" />
                <text x="620" y="190" textAnchor="middle" fill="#6B21A8" fontSize="12" fontWeight="800">
                  Faculty & Amenities
                </text>
                <text x="620" y="208" textAnchor="middle" fill="#7E22CE" fontSize="9" fontWeight="600">
                  Cooler & Faculty Suites
                </text>

                {/* Corridor Path */}
                <path d="M 80 250 L 680 250" stroke="#CBD5E1" strokeWidth="18" strokeLinecap="round" opacity="0.6" />
                <text x="380" y="254" textAnchor="middle" fill="#64748B" fontSize="10" fontWeight="700">
                  MAIN CORRIDOR (FLOOR {selectedFloor})
                </text>

                {/* Spatial Pins (§3) */}
                {tickets
                  .filter((t) => t.location?.floor_number === selectedFloor)
                  .map((t) => {
                    const x = t.location?.x_coord || 200;
                    const y = t.location?.y_coord || 150;
                    const isSelected = selectedTicketId === t.ticket_id;

                    // Color code pins: 🔴 Red (REPORTED), 🟡 Yellow (DISPATCHED), 🟢 Green (RESOLVED)
                    const pinColor =
                      t.status === 'REPORTED'
                        ? '#EF4444'
                        : t.status === 'DISPATCHED'
                        ? '#F59E0B'
                        : '#10B981';

                    return (
                      <g
                        key={t.ticket_id}
                        transform={`translate(${x}, ${y})`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedTicketId(t.ticket_id)}
                      >
                        {/* Pulse circle for critical reports */}
                        {t.status === 'REPORTED' && t.ai_severity_score >= 80 && (
                          <circle r="18" fill="none" stroke="#EF4444" strokeWidth="2.5" className="animate-pulse" />
                        )}

                        <circle
                          r={isSelected ? 14 : 11}
                          fill={pinColor}
                          stroke="white"
                          strokeWidth="3"
                          filter="drop-shadow(0 3px 6px rgba(0,0,0,0.25))"
                        />
                        <text x="0" y="4" textAnchor="middle" fill="white" fontSize="10" fontWeight="900">
                          {CATEGORY_META[t.category].icon}
                        </text>

                        {/* Floating spot tag */}
                        <rect x="-35" y="-28" width="70" height="16" rx="4" fill="#0F172A" opacity="0.85" />
                        <text x="0" y="-17" textAnchor="middle" fill="white" fontSize="8" fontWeight="700">
                          {t.location?.room_number}
                        </text>
                      </g>
                    );
                  })}
              </svg>
            </div>

            {/* Map Legend */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: '0.75rem', color: '#64748B' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
                  <strong>🔴 Active Critical</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
                  <strong>🟡 Dispatched En Route</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
                  <strong>🟢 Resolved Proof</strong>
                </span>
              </div>
              <span>Click pin to inspect ticket</span>
            </div>
          </div>

          {/* Column 2: INCIDENT MANAGEMENT FEED (§3) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Filter Bar */}
            <div
              style={{
                background: 'white',
                borderRadius: 16,
                padding: '12px 18px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.85rem', color: '#0F172A' }}>
                <Filter size={16} />
                <span>Ticket Feed ({filteredTickets.length})</span>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                {(['ALL', 'REPORTED', 'DISPATCHED', 'RESOLVED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background: statusFilter === st ? '#0288D1' : '#F1F5F9',
                      color: statusFilter === st ? 'white' : '#475569',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Prioritized Tickets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
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
                    {/* Top Row: Category, Urgency Score, Duplicates */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.5rem' }}>{meta.icon}</span>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>
                            {meta.label}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                            {ticket.location?.building_name} • Floor {ticket.location?.floor_number} • Rm {ticket.location?.room_number}
                          </div>
                        </div>
                      </div>

                      {/* AI Urgency Score & Duplicate Count Badge (§3) */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
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

                    {/* Media Attachments & Voice Note */}
                    <div style={{ display: 'grid', gridTemplateColumns: ticket.user_photo_url ? '80px 1fr' : '1fr', gap: 12, alignItems: 'center' }}>
                      {ticket.user_photo_url && (
                        <img
                          src={ticket.user_photo_url}
                          alt="Defect"
                          style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover' }}
                        />
                      )}

                      <div>
                        {/* Voice Note Audio Player & Transcript */}
                        {ticket.voice_transcript && (
                          <div
                            style={{
                              background: '#FFFBEB',
                              borderRadius: 8,
                              padding: '8px 10px',
                              border: '1px solid #FDE68A',
                              fontSize: '0.75rem',
                              color: '#92400E',
                              marginBottom: 6,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800, color: '#B45309' }}>
                              <Volume2 size={13} />
                              <span>Voice Note Transcript:</span>
                            </div>
                            <div style={{ fontStyle: 'italic', marginTop: 2 }}>
                              "{ticket.voice_transcript}"
                            </div>
                          </div>
                        )}

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

                    {/* Actions Row: Dispatch to Maintenance OR Mark Resolved */}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

                      <div style={{ display: 'flex', gap: 6 }}>
                        {ticket.status === 'REPORTED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setDispatchModalTicket(ticket);
                              // Auto-select staff by category specialization
                              const match = maintenanceStaff.find(
                                (s) => s.specialization === meta.defaultStaffSpec
                              );
                              setSelectedStaffId(match?.staff_id || maintenanceStaff[0].staff_id);
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
                  Fixed Proof Photo URL or Demo Image:
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

