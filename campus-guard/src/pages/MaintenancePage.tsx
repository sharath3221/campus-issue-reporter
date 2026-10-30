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
} from 'lucide-react';
import {
  IncidentCategory,
  CATEGORY_META,
  STATUS_META,
  IncidentTicket,
  StaffSpecialization,
} from '../types';
import { useIncidents } from '../hooks/useIncidents';
import { uploadIncidentMedia } from '../lib/supabaseClient';

export const MaintenancePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { tickets, maintenanceStaff, resolveTicket, isSupabaseConnected } =
    useIncidents();

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
      // Immediately release camera hardware
      closeCamera();
    }

    if (dataUrl) {
      setFixedPhotoPreview(dataUrl);
      playAudioFeedback('Fixed photo proof captured.');
    }
  };

  const closeCamera = () => {
    // 1. Release tracks from video element directly
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

    // 2. Stop tracks from mediaStream reference
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

  // Cleanup camera stream on unmount
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

  // Submit Resolution & Fixed Photo Proof (Upload to Supabase Storage)
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

  // Filtered Tickets
  const filteredTickets = tickets.filter((t) => {
    const matchesTab =
      activeTab === 'DISPATCHED'
        ? t.status === 'DISPATCHED' || t.status === 'REPORTED'
        : t.status === 'RESOLVED';

    if (!matchesTab) return false;

    if (selectedSpecialization === 'ALL') return true;

    const staffSpecializationMap: Record<IncidentCategory, StaffSpecialization> = {
      WATER_SUPPLY: 'PLUMBING',
      LIGHTS_FAN_PROJECTOR: 'ELECTRICAL',
      WASHROOM_CLEANLINESS: 'CLEANING',
      FURNITURE_MAINTENANCE: 'CARPENTRY',
    };

    return staffSpecializationMap[t.category] === selectedSpecialization;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', paddingBottom: 80 }}>
      {/* High-Contrast Mobile Header for Maintenance Staff */}
      <header
        style={{
          background: '#0F172A',
          color: 'white',
          padding: '14px 20px',
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
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            <Wrench size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Maintenance Field Portal
            </div>
            <div style={{ fontSize: '0.72rem', color: '#FCD34D', fontWeight: 700 }}>
              CampusPulse On-Duty Staff
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              background: '#1E293B',
              color: '#38BDF8',
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #334155',
            }}
          >
            {isSupabaseConnected ? '🟢 Live Cloud' : '🟡 Offline Mode'}
          </span>
          <button
            onClick={() => navigate('/report')}
            style={{
              background: '#334155',
              border: 'none',
              borderRadius: 8,
              padding: '6px 10px',
              color: 'white',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Exit
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
        {/* Banner with Duty Staff info */}
        <div
          style={{
            background: 'white',
            borderRadius: 16,
            padding: '14px 18px',
            border: '1px solid #CBD5E1',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>
              FIELD REPAIR DISPATCH CENTER
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0F172A', marginTop: 2 }}>
              Upload Fixed Photo Proof to close work orders
            </div>
          </div>
          <div
            style={{
              background: '#FEF3C7',
              color: '#B45309',
              padding: '6px 12px',
              borderRadius: 10,
              fontWeight: 900,
              fontSize: '0.85rem',
              textAlign: 'center',
            }}
          >
            {tickets.filter((t) => t.status !== 'RESOLVED').length} Active Jobs
          </div>
        </div>

        {/* Specialization Filter Pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }}>
          {(
            [
              { id: 'ALL', label: 'All Jobs 📋' },
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

        {/* Status Tabs (Dispatched Jobs vs Completed History) */}
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
            Pending Repair ({tickets.filter((t) => t.status !== 'RESOLVED').length})
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
                {activeTab === 'DISPATCHED' ? 'No Pending Work Orders!' : 'No Resolved Jobs in this category.'}
              </div>
              <p style={{ fontSize: '0.8rem', marginTop: 4 }}>
                {activeTab === 'DISPATCHED'
                  ? 'All campus facility incidents are currently serviced or waiting for dispatch.'
                  : 'Resolved tickets will appear here with proof photos.'}
              </p>
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const meta = CATEGORY_META[ticket.category];
              const isTarget = targetTicketId === ticket.ticket_id;

              return (
                <div
                  key={ticket.ticket_id}
                  style={{
                    background: 'white',
                    borderRadius: 16,
                    padding: 16,
                    border: isTarget ? '2px solid #0288D1' : '1px solid #E2E8F0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {/* Top Row: Ticket ID + Category + Duplicate Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

                  {/* Assigned Staff if dispatched */}
                  {ticket.assigned_staff && (
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
                          background: 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
                          color: 'white',
                          border: 'none',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
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

