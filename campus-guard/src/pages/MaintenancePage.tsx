import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Wrench,
  CheckCircle2,
  Camera,
  Upload,
  AlertCircle,
  Clock,
  MapPin,
  Sparkles,
  Check,
  ChevronRight,
  X,
  Phone,
  Shield,
  Layers,
  ArrowLeft,
  Image as ImageIcon,
  CheckCheck,
  LogIn,
  LogOut,
  Lock,
  UserCheck,
  UserX,
  RefreshCw,
  Briefcase,
  AlertTriangle,
  User,
  KeyRound,
} from 'lucide-react';
import {
  IncidentCategory,
  CATEGORY_META,
  STATUS_META,
  IncidentTicket,
  StaffSpecialization,
  MaintenanceStaff,
} from '../types';
import { useIncidents } from '../hooks/useIncidents';
import { uploadIncidentMedia } from '../lib/supabaseClient';
import {
  getActiveStaffSession,
  signInMaintenanceStaff,
  signOutMaintenanceStaff,
  STAFF_SESSION_KEY,
} from '../lib/staffAuth';

const SPECIALIZATION_BADGES: Record<StaffSpecialization, { label: string; icon: string; color: string; bg: string }> = {
  PLUMBING: { label: 'Plumbing & Water', icon: '🚰', color: '#0288D1', bg: '#E0F2FE' },
  ELECTRICAL: { label: 'Electrical & Power', icon: '⚡', color: '#D97706', bg: '#FEF3C7' },
  CLEANING: { label: 'Sanitation & Hygiene', icon: '🧹', color: '#059669', bg: '#D1FAE5' },
  CARPENTRY: { label: 'Carpentry & Desks', icon: '🪑', color: '#B45309', bg: '#FDE68A' },
  GENERAL: { label: 'General Facilities', icon: '🔧', color: '#6366F1', bg: '#EEF2FF' },
};

export const MaintenancePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    tickets,
    maintenanceStaff,
    toggleStaffDuty,
    resolveTicket,
    isSupabaseConnected,
  } = useIncidents();

  // Technician Authentication State
  const [currentStaff, setCurrentStaff] = useState<MaintenanceStaff | null>(() =>
    getActiveStaffSession()
  );

  // Login form state
  const [loginPhoneOrId, setLoginPhoneOrId] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Work Scope filter for authenticated technician
  const [workScope, setWorkScope] = useState<'MY_JOBS' | 'ALL'>('MY_JOBS');

  // Target ticket parameter from WhatsApp dispatch link e.g. /maintenance?ticket=tick-1002
  const targetTicketId = searchParams.get('ticket');

  // Filter states
  const [selectedSpecialization, setSelectedSpecialization] = useState<
    StaffSpecialization | 'ALL'
  >('ALL');
  const [activeTab, setActiveTab] = useState<'DISPATCHED' | 'RESOLVED'>('DISPATCHED');

  // Active resolution card state
  const [resolvingTicket, setResolvingTicket] = useState<IncidentTicket | null>(null);
  const [fixedPhotoPreview, setFixedPhotoPreview] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolveSuccess, setResolveSuccess] = useState<string | null>(null);

  // Live Camera Viewfinder State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep current staff session in sync if admin updates duty or details in live maintenanceStaff roster
  useEffect(() => {
    if (currentStaff) {
      const live = maintenanceStaff.find((s) => s.staff_id === currentStaff.staff_id);
      if (live && live.is_on_duty !== currentStaff.is_on_duty) {
        setCurrentStaff(live);
        try {
          localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(live));
        } catch (e) {}
      }
    }
  }, [maintenanceStaff, currentStaff]);

  // If a ticket query param is present, automatically open resolution card for it
  useEffect(() => {
    if (targetTicketId && tickets.length > 0) {
      const found = tickets.find((t) => t.ticket_id === targetTicketId);
      if (found) {
        setResolvingTicket(found);
        if (found.status === 'RESOLVED') {
          setActiveTab('RESOLVED');
        } else {
          setActiveTab('DISPATCHED');
        }
      }
    }
  }, [targetTicketId, tickets]);

  // Audio speech synthesis feedback
  const playAudioFeedback = (text: string) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.log('Audio feedback error', e);
    }
  };

  // Staff Login Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const authStaff = await signInMaintenanceStaff(
        loginPhoneOrId,
        loginPasscode,
        maintenanceStaff
      );
      setCurrentStaff(authStaff);
      playAudioFeedback(`Welcome on duty, ${authStaff.full_name}.`);
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Staff Logout Handler
  const handleLogout = () => {
    signOutMaintenanceStaff();
    setCurrentStaff(null);
    setLoginPhoneOrId('');
    setLoginPasscode('');
    setLoginError(null);
    setResolvingTicket(null);
    playAudioFeedback('Signed out from maintenance portal.');
  };

  // Toggle On-Duty / Off-Duty by technician
  const handleToggleDutyStatus = async () => {
    if (!currentStaff) return;
    const newStatus = !currentStaff.is_on_duty;
    const updated = { ...currentStaff, is_on_duty: newStatus };
    setCurrentStaff(updated);
    try {
      localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(updated));
    } catch (e) {}
    await toggleStaffDuty(currentStaff.staff_id, newStatus);
    playAudioFeedback(newStatus ? 'You are now marked ON DUTY.' : 'You are now marked OFF DUTY.');
  };

  // Live Camera Handlers
  const openCamera = async () => {
    setCameraError(null);
    setIsCameraOpen(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser. Use file upload below.');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(err.message || 'Unable to access device camera.');
    }
  };

  const snapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    let dataUrl: string | null = null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }
    } catch (e) {
      console.error('Snapshot capture error:', e);
    } finally {
      closeCamera();
    }

    if (dataUrl) {
      setFixedPhotoPreview(dataUrl);
      playAudioFeedback('Fixed photo proof captured.');
    }
  };

  const closeCamera = () => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        if (videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((track) => {
            track.enabled = false;
            track.stop();
          });
          videoRef.current.srcObject = null;
        }
      } catch (err) {
        console.warn('Error clearing video srcObject:', err);
      }
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
        });
      } catch (err) {
        console.warn('Error stopping mediaStream tracks:', err);
      }
      mediaStreamRef.current = null;
    }

    setIsCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      closeCamera();
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFixedPhotoPreview(reader.result as string);
      playAudioFeedback('Proof photo uploaded successfully.');
    };
    reader.readAsDataURL(file);
  };

  // Submit Resolution & Fixed Photo Proof
  const handleSubmitResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingTicket || !fixedPhotoPreview) return;

    setIsSubmitting(true);

    try {
      let publicStorageUrl: string | null = null;
      try {
        publicStorageUrl = await uploadIncidentMedia(
          fixedPhotoPreview,
          `fixed_${resolvingTicket.ticket_id}.jpg`
        );
      } catch (uploadErr) {
        console.warn('Storage upload notice:', uploadErr);
      }

      resolveTicket(resolvingTicket.ticket_id, publicStorageUrl || fixedPhotoPreview);
      setResolveSuccess(resolvingTicket.ticket_id);
      playAudioFeedback('Work order marked resolved. Fixed proof published.');

      setTimeout(() => {
        setResolvingTicket(null);
        setFixedPhotoPreview(null);
        setResolutionNote('');
        setResolveSuccess(null);
        setActiveTab('RESOLVED');
      }, 1500);
    } catch (err) {
      console.error('Resolution submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Category to specialization mapping
  const staffSpecializationMap: Record<IncidentCategory, StaffSpecialization> = {
    WATER_SUPPLY: 'PLUMBING',
    LIGHTS_FAN_PROJECTOR: 'ELECTRICAL',
    WASHROOM_CLEANLINESS: 'CLEANING',
    FURNITURE_MAINTENANCE: 'CARPENTRY',
  };

  // Filtered Tickets
  const filteredTickets = tickets.filter((t) => {
    const matchesTab =
      activeTab === 'DISPATCHED'
        ? t.status === 'DISPATCHED' || t.status === 'REPORTED'
        : t.status === 'RESOLVED';

    if (!matchesTab) return false;

    // Scope check: If current technician has "MY_JOBS" selected
    if (currentStaff && workScope === 'MY_JOBS') {
      const isDirectlyAssigned =
        t.assigned_staff_id === currentStaff.staff_id ||
        t.assigned_staff?.staff_id === currentStaff.staff_id;
      const isMyTrade = staffSpecializationMap[t.category] === currentStaff.specialization;

      if (!isDirectlyAssigned && !isMyTrade) {
        return false;
      }
    }

    if (selectedSpecialization === 'ALL') return true;

    return staffSpecializationMap[t.category] === selectedSpecialization;
  });

  // Calculate my jobs count vs all jobs count
  const myPendingCount = currentStaff
    ? tickets.filter((t) => {
        if (t.status === 'RESOLVED') return false;
        const isAssigned =
          t.assigned_staff_id === currentStaff.staff_id ||
          t.assigned_staff?.staff_id === currentStaff.staff_id;
        const isTrade = staffSpecializationMap[t.category] === currentStaff.specialization;
        return isAssigned || isTrade;
      }).length
    : 0;

  const allPendingCount = tickets.filter((t) => t.status !== 'RESOLVED').length;

  // -------------------------------------------------------------
  // VIEW A: UNAUTHENTICATED TECHNICIAN LOGIN SCREEN
  // -------------------------------------------------------------
  if (!currentStaff) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', flexDirection: 'column' }}>
        {/* Simple Header */}
        <header
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid #1E293B',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
              }}
            >
              <Wrench size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>
                CampusPulse
              </div>
              <div style={{ fontSize: '0.72rem', color: '#FCD34D', fontWeight: 700 }}>
                Maintenance Staff Portal
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/report')}
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '6px 12px',
              color: '#94A3B8',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ArrowLeft size={14} />
            <span>Public Report</span>
          </button>
        </header>

        {/* Login Body */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              background: '#1E293B',
              borderRadius: 20,
              border: '1px solid #334155',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              padding: 28,
            }}
          >
            {/* Title & Badge */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  margin: '0 auto 14px',
                  boxShadow: '0 8px 24px rgba(245, 158, 11, 0.35)',
                }}
              >
                <LogIn size={28} />
              </div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'white', marginBottom: 6 }}>
                Technician Duty Sign In
              </h1>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.4 }}>
                Sign in with your registered phone number or Staff ID and 4-digit PIN to access work orders.
              </p>
            </div>

            {/* Error Banner */}
            {loginError && (
              <div
                style={{
                  background: '#7F1D1D',
                  border: '1px solid #DC2626',
                  borderRadius: 10,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#FECACA',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                <AlertCircle size={16} color="#F87171" style={{ flexShrink: 0 }} />
                <span>{loginError}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#CBD5E1',
                    marginBottom: 6,
                  }}
                >
                  Phone Number or Staff ID:
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone
                    size={16}
                    color="#64748B"
                    style={{ position: 'absolute', left: 12, top: 12, pointerEvents: 'none' }}
                  />
                  <input
                    type="text"
                    required
                    placeholder="e.g. +91 98765 43210 or stf-101"
                    value={loginPhoneOrId}
                    onChange={(e) => setLoginPhoneOrId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 36px',
                      borderRadius: 10,
                      background: '#0F172A',
                      border: '1px solid #334155',
                      color: 'white',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#CBD5E1',
                    marginBottom: 6,
                  }}
                >
                  Passcode / PIN (Default: 1234):
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    color="#64748B"
                    style={{ position: 'absolute', left: 12, top: 12, pointerEvents: 'none' }}
                  />
                  <input
                    type="password"
                    required
                    placeholder="Enter 4-digit PIN"
                    value={loginPasscode}
                    onChange={(e) => setLoginPasscode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 36px',
                      borderRadius: 10,
                      background: '#0F172A',
                      border: '1px solid #334155',
                      color: 'white',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                      letterSpacing: '0.2em',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                style={{
                  marginTop: 6,
                  padding: 13,
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  color: 'white',
                  fontWeight: 900,
                  fontSize: '0.95rem',
                  cursor: isLoggingIn ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
                }}
              >
                {isLoggingIn ? (
                  <span>Verifying Credentials...</span>
                ) : (
                  <>
                    <LogIn size={18} />
                    <span>Sign In to Field Portal ➔</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Staff Demo Picker for Testing */}
            {maintenanceStaff.length > 0 && (
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 18,
                  borderTop: '1px solid #334155',
                }}
              >
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: '#94A3B8',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Sparkles size={13} color="#F59E0B" />
                  <span>Tap to Auto-Fill Registered Technician:</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {maintenanceStaff.slice(0, 4).map((s) => {
                    const badge = SPECIALIZATION_BADGES[s.specialization] || SPECIALIZATION_BADGES.GENERAL;
                    return (
                      <button
                        key={s.staff_id}
                        type="button"
                        onClick={() => {
                          setLoginPhoneOrId(s.phone_number);
                          setLoginPasscode(s.passcode || '1234');
                          setLoginError(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: 8,
                          background: '#0F172A',
                          border: '1px solid #334155',
                          color: '#E2E8F0',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{badge.icon}</span>
                          <span>{s.full_name}</span>
                          <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>({badge.label})</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#38BDF8', fontFamily: 'monospace' }}>
                          PIN: {s.passcode || '1234'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Administrator Notice */}
            <div
              style={{
                marginTop: 18,
                background: '#0F172A',
                borderRadius: 10,
                padding: '10px 12px',
                border: '1px solid #334155',
                fontSize: '0.72rem',
                color: '#94A3B8',
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <Shield size={16} color="#60A5FA" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Admin Provisioned:</strong> New staff members can be added and managed by administrators in the{' '}
                <span
                  onClick={() => navigate('/admin/dashboard')}
                  style={{ color: '#38BDF8', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Admin Portal Roster
                </span>
                .
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW B: AUTHENTICATED TECHNICIAN FIELD PORTAL
  // -------------------------------------------------------------
  const staffBadge = SPECIALIZATION_BADGES[currentStaff.specialization] || SPECIALIZATION_BADGES.GENERAL;

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', paddingBottom: 80 }}>
      {/* High-Contrast Mobile Header with Technician Info & Controls */}
      <header
        style={{
          background: '#0F172A',
          color: 'white',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
            }}
          >
            <Wrench size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {currentStaff.full_name}
              </span>
              <span
                style={{
                  background: staffBadge.bg,
                  color: staffBadge.color,
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  padding: '1px 6px',
                  borderRadius: 6,
                }}
              >
                {staffBadge.icon} {staffBadge.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              {/* Duty Toggle Pill */}
              <button
                type="button"
                onClick={handleToggleDutyStatus}
                style={{
                  background: currentStaff.is_on_duty ? '#065F46' : '#7F1D1D',
                  color: currentStaff.is_on_duty ? '#A7F3D0' : '#FECACA',
                  border: `1px solid ${currentStaff.is_on_duty ? '#059669' : '#DC2626'}`,
                  borderRadius: 12,
                  padding: '2px 8px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Tap to switch between On-Duty and Off-Duty"
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: currentStaff.is_on_duty ? '#10B981' : '#EF4444' }} />
                <span>{currentStaff.is_on_duty ? 'ON DUTY' : 'OFF DUTY'}</span>
              </button>

              <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                ID: {currentStaff.staff_id}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls: Live Status & Sign Out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              background: '#1E293B',
              color: '#38BDF8',
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #334155',
            }}
          >
            {isSupabaseConnected ? '🟢 Live' : '🟡 Local'}
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: '#334155',
              border: '1px solid #475569',
              borderRadius: 8,
              padding: '6px 10px',
              color: '#F1F5F9',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Sign out of technician duty"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
        {/* Off Duty Alert (if technician is off duty) */}
        {!currentStaff.is_on_duty && (
          <div
            style={{
              background: '#FEF3C7',
              borderRadius: 14,
              padding: '12px 16px',
              border: '1px solid #F59E0B',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400E' }}>
                  You are currently marked OFF DUTY
                </div>
                <div style={{ fontSize: '0.72rem', color: '#B45309' }}>
                  Live dispatches are paused. Toggle to On Duty to receive new campus tasks.
                </div>
              </div>
            </div>
            <button
              onClick={handleToggleDutyStatus}
              style={{
                background: '#10B981',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Go On Duty
            </button>
          </div>
        )}

        {/* WORK SCOPE SWITCHER (My Assigned Tasks vs All Jobs) */}
        <div
          style={{
            background: 'white',
            borderRadius: 16,
            padding: 4,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            border: '1px solid #CBD5E1',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            onClick={() => setWorkScope('MY_JOBS')}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: 'none',
              background: workScope === 'MY_JOBS' ? '#0F172A' : 'transparent',
              color: workScope === 'MY_JOBS' ? 'white' : '#64748B',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <Briefcase size={15} />
            <span>My Assigned & Trade Tasks</span>
            <span
              style={{
                background: workScope === 'MY_JOBS' ? '#F59E0B' : '#E2E8F0',
                color: workScope === 'MY_JOBS' ? 'white' : '#475569',
                fontSize: '0.7rem',
                padding: '1px 6px',
                borderRadius: 10,
                fontWeight: 900,
              }}
            >
              {myPendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setWorkScope('ALL')}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: 'none',
              background: workScope === 'ALL' ? '#0F172A' : 'transparent',
              color: workScope === 'ALL' ? 'white' : '#64748B',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={15} />
            <span>All Campus Jobs</span>
            <span
              style={{
                background: workScope === 'ALL' ? '#3B82F6' : '#E2E8F0',
                color: workScope === 'ALL' ? 'white' : '#475569',
                fontSize: '0.7rem',
                padding: '1px 6px',
                borderRadius: 10,
                fontWeight: 900,
              }}
            >
              {allPendingCount}
            </span>
          </button>
        </div>

        {/* Trade Category Filter Pills (When Viewing All Jobs or filtering) */}
        {workScope === 'ALL' && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }}>
            {(
              [
                { id: 'ALL', label: 'All Trades 📋' },
                { id: 'PLUMBING', label: '🚰 Plumbing' },
                { id: 'ELECTRICAL', label: '⚡ Electrical' },
                { id: 'CLEANING', label: '🧹 Cleaning' },
                { id: 'CARPENTRY', label: '🪑 Carpentry' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedSpecialization(item.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: selectedSpecialization === item.id ? '2px solid #0288D1' : '1px solid #CBD5E1',
                  background: selectedSpecialization === item.id ? '#0288D1' : 'white',
                  color: selectedSpecialization === item.id ? 'white' : '#475569',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* Status Tabs (Pending Repair vs Completed History) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: '#E2E8F0',
            borderRadius: 12,
            padding: 3,
            marginBottom: 16,
          }}
        >
          <button
            onClick={() => setActiveTab('DISPATCHED')}
            style={{
              padding: '10px 0',
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'DISPATCHED' ? 'white' : 'transparent',
              color: activeTab === 'DISPATCHED' ? '#0F172A' : '#64748B',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'DISPATCHED' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            Pending Repair ({workScope === 'MY_JOBS' ? myPendingCount : allPendingCount})
          </button>
          <button
            onClick={() => setActiveTab('RESOLVED')}
            style={{
              padding: '10px 0',
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'RESOLVED' ? 'white' : 'transparent',
              color: activeTab === 'RESOLVED' ? '#065F46' : '#64748B',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'RESOLVED' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            Resolved & Proof ({tickets.filter((t) => t.status === 'RESOLVED').length})
          </button>
        </div>

        {/* RESOLUTION MODAL / DRAWER (When a technician taps "Upload Proof") */}
        {resolvingTicket && (
          <div
            style={{
              background: 'white',
              borderRadius: 20,
              border: '2px solid #0288D1',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              padding: 20,
              marginBottom: 20,
              animation: 'fadeIn 0.25s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: '#0288D1',
                    color: 'white',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: '0.75rem',
                    fontWeight: 900,
                  }}
                >
                  {resolvingTicket.ticket_id}
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0F172A' }}>
                  {CATEGORY_META[resolvingTicket.category].label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResolvingTicket(null);
                  setFixedPhotoPreview(null);
                }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Location Reference */}
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, border: '1px solid #E2E8F0', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0288D1', fontWeight: 800, fontSize: '0.78rem' }}>
                <MapPin size={15} />
                <span>SPOT LOCATION:</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
                {resolvingTicket.location?.building_name}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                Floor {resolvingTicket.location?.floor_number} • Room: {resolvingTicket.location?.room_number} ({resolvingTicket.location_id})
              </div>
            </div>

            {/* Before vs After Photo Proof Comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {/* Before Photo */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#DC2626', marginBottom: 6 }}>
                  1. Issue Photo (Before)
                </div>
                {resolvingTicket.user_photo_url ? (
                  <img
                    src={resolvingTicket.user_photo_url}
                    alt="Issue Before"
                    style={{
                      width: '100%',
                      height: 140,
                      objectFit: 'cover',
                      borderRadius: 10,
                      border: '2px solid #FECACA',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: 140,
                      borderRadius: 10,
                      background: '#F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    No photo uploaded
                  </div>
                )}
              </div>

              {/* After Photo (Fixed Proof) */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669', marginBottom: 6 }}>
                  2. Fixed Proof (After) *
                </div>
                {fixedPhotoPreview ? (
                  <div style={{ position: 'relative' }}>
                    <img
                      src={fixedPhotoPreview}
                      alt="Fixed After"
                      style={{
                        width: '100%',
                        height: 140,
                        objectFit: 'cover',
                        borderRadius: 10,
                        border: '2px solid #A7F3D0',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setFixedPhotoPreview(null)}
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: 'rgba(239, 68, 68, 0.9)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        padding: '3px 6px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Retake
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: 140,
                      borderRadius: 10,
                      border: '2px dashed #10B981',
                      background: '#F0FDF4',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: 10,
                      textAlign: 'center',
                    }}
                  >
                    <CheckCircle2 size={28} color="#059669" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#065F46' }}>
                      Snap Fixed Photo
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />

            {/* Live Camera Viewfinder Modal (If open) */}
            {isCameraOpen ? (
              <div
                style={{
                  background: '#0F172A',
                  borderRadius: 16,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 800 }}>
                    Live Camera: Snap Completed Repair
                  </span>
                  <button
                    type="button"
                    onClick={closeCamera}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {cameraError ? (
                  <div style={{ background: '#7F1D1D', color: '#FECACA', padding: 10, borderRadius: 8, fontSize: '0.75rem' }}>
                    {cameraError}
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      autoPlay
                      muted
                      style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 10, background: '#1E293B' }}
                    />
                    <button
                      type="button"
                      onClick={snapPhoto}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: '#10B981',
                        color: 'white',
                        border: 'none',
                        fontWeight: 900,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <Camera size={20} />
                      <span>Snap Completed Photo Proof</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              /* Capture Buttons */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={openCamera}
                  style={{
                    padding: '12px 10px',
                    borderRadius: 12,
                    border: '2px solid #10B981',
                    background: '#ECFDF5',
                    color: '#059669',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Camera size={18} />
                  <span>Open Camera 📸</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '12px 10px',
                    borderRadius: 12,
                    border: '2px dashed #94A3B8',
                    background: '#F8FAFC',
                    color: '#475569',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Upload size={18} />
                  <span>Upload from Gallery 📁</span>
                </button>
              </div>
            )}

            {/* Work Performed Quick Chips */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: 6 }}>
                Quick Repair Action / काम का विवरण:
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {[
                  'Replaced Gasket & Repaired Pipe',
                  'Cleaned & Disinfected Washroom',
                  'Fitted New Switch / LED Bulb',
                  'Tightened Bolts & Secured Furniture',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setResolutionNote(chip)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: resolutionNote === chip ? '1.5px solid #0288D1' : '1px solid #CBD5E1',
                      background: resolutionNote === chip ? '#E0F2FE' : '#F8FAFC',
                      color: resolutionNote === chip ? '#0369A1' : '#475569',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Optional notes: e.g., Replaced ball valve in toilet tank..."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Submit Resolution Button */}
            <form onSubmit={handleSubmitResolution}>
              <button
                type="submit"
                disabled={isSubmitting || !fixedPhotoPreview}
                style={{
                  width: '100%',
                  padding: 14,
                  borderRadius: 14,
                  border: 'none',
                  background: !fixedPhotoPreview
                    ? '#CBD5E1'
                    : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: !fixedPhotoPreview ? '#64748B' : 'white',
                  fontWeight: 900,
                  fontSize: '0.95rem',
                  cursor: !fixedPhotoPreview ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: !fixedPhotoPreview ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.4)',
                }}
              >
                {isSubmitting ? (
                  <span>Publishing Resolution Proof to Campus...</span>
                ) : !fixedPhotoPreview ? (
                  <span>Attach Fixed Photo to Complete Job</span>
                ) : (
                  <>
                    <CheckCheck size={20} strokeWidth={3} />
                    <span>Confirm Repair & Publish Proof ➔</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* WORK ORDERS LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredTickets.length === 0 ? (
            <div
              style={{
                background: 'white',
                borderRadius: 16,
                padding: '40px 20px',
                textAlign: 'center',
                border: '1px solid #E2E8F0',
                color: '#64748B',
              }}
            >
              <CheckCircle2 size={40} color="#10B981" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                {activeTab === 'DISPATCHED'
                  ? workScope === 'MY_JOBS'
                    ? 'No Pending Tasks Assigned to You!'
                    : 'No Pending Work Orders on Campus!'
                  : 'No Resolved Jobs in this category.'}
              </div>
              <p style={{ fontSize: '0.8rem', marginTop: 4 }}>
                {activeTab === 'DISPATCHED'
                  ? workScope === 'MY_JOBS'
                    ? 'All tasks matching your trade or assigned queue are completed. Switch to "All Campus Jobs" to see other departments.'
                    : 'All campus facility incidents are currently serviced or waiting for dispatch.'
                  : 'Resolved tickets will appear here with proof photos.'}
              </p>
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const meta = CATEGORY_META[ticket.category];
              const isTarget = targetTicketId === ticket.ticket_id;
              const isAssignedToMe =
                ticket.assigned_staff_id === currentStaff.staff_id ||
                ticket.assigned_staff?.staff_id === currentStaff.staff_id;

              return (
                <div
                  key={ticket.ticket_id}
                  style={{
                    background: 'white',
                    borderRadius: 16,
                    padding: 16,
                    border: isTarget
                      ? '2px solid #0288D1'
                      : isAssignedToMe
                      ? '2px solid #F59E0B'
                      : '1px solid #E2E8F0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {/* Top Row: Ticket ID + Category + Duplicate Badge + Assigned to You Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontFamily: 'monospace',
                          background: '#F1F5F9',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontWeight: 800,
                          color: '#475569',
                        }}
                      >
                        {ticket.ticket_id}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: meta.color,
                          background: meta.bgColor,
                          padding: '2px 8px',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </span>

                      {isAssignedToMe && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 900,
                            background: '#FEF3C7',
                            color: '#B45309',
                            padding: '2px 8px',
                            borderRadius: 10,
                            border: '1px solid #FDE68A',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <User size={12} />
                          <span>Assigned to You</span>
                        </span>
                      )}
                    </div>

                    {/* Duplicate Count Badge */}
                    {ticket.duplicate_count > 1 && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          background: '#FEE2E2',
                          color: '#DC2626',
                          padding: '2px 8px',
                          borderRadius: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Layers size={11} />
                        +{ticket.duplicate_count} reports
                      </span>
                    )}
                  </div>

                  {/* Spot Location */}
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={16} color="#0288D1" />
                      <span>{ticket.location?.building_name}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600, marginTop: 2, paddingLeft: 22 }}>
                      Floor {ticket.location?.floor_number} • Room: {ticket.location?.room_number} ({ticket.location?.zone_category})
                    </div>
                  </div>

                  {/* Assigned Staff if dispatched to someone else */}
                  {ticket.assigned_staff && !isAssignedToMe && (
                    <div
                      style={{
                        background: '#FFFBEB',
                        borderRadius: 8,
                        padding: '6px 10px',
                        border: '1px solid #FDE68A',
                        fontSize: '0.75rem',
                        color: '#92400E',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Clock size={14} color="#D97706" />
                      <span>
                        Assigned to: <strong>{ticket.assigned_staff.full_name}</strong> ({ticket.assigned_staff.specialization})
                      </span>
                    </div>
                  )}

                  {/* Photo Proof Display (If Resolved) or Action Button (If Dispatched) */}
                  {ticket.status === 'RESOLVED' ? (
                    <div style={{ background: '#F0FDF4', borderRadius: 12, padding: 12, border: '1px solid #BBF7D0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 800, fontSize: '0.78rem', marginBottom: 8 }}>
                        <CheckCircle2 size={16} />
                        <span>WORK COMPLETED: FIXED PROOF VERIFIED</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: ticket.user_photo_url ? '1fr 1fr' : '1fr', gap: 10 }}>
                        {ticket.user_photo_url && (
                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, marginBottom: 4 }}>Before:</div>
                            <img
                              src={ticket.user_photo_url}
                              alt="Before"
                              style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8 }}
                            />
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700, marginBottom: 4 }}>Fixed Proof (After):</div>
                          <img
                            src={ticket.fixed_photo_url || ''}
                            alt="Fixed Proof"
                            style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8, border: '2px solid #86EFAC' }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingTicket(ticket);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{
                          flex: 1,
                          padding: '12px',
                          borderRadius: 12,
                          background: isAssignedToMe
                            ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                            : 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
                          color: 'white',
                          border: 'none',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: isAssignedToMe
                            ? '0 4px 12px rgba(245, 158, 11, 0.3)'
                            : '0 4px 12px rgba(2, 136, 209, 0.3)',
                        }}
                      >
                        <Camera size={16} />
                        <span>Complete Repair & Upload Proof 📸</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};
