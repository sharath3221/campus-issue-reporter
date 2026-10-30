import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Camera,
  CheckCircle2,
  Clock,
  Sparkles,
  Volume2,
  Check,
  Shield,
  ChevronRight,
  AlertCircle,
  X,
  Upload,
  RefreshCw,
  Key,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import {
  IncidentCategory,
  CATEGORY_META,
  STATUS_META,
  IncidentTicket,
  CampusLocation,
} from '../types';
import { useIncidents } from '../hooks/useIncidents';
import {
  analyzeImageDefects,
  getGeminiApiKey,
  saveGeminiApiKey,
  VisionAnalysisResult,
} from '../lib/geminiVision';

export const ReportPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { campusLocations, submitReport, getActiveSpotTicket } = useIncidents();

  // Read location query parameter e.g., ?loc=QR-BLD-A-FL1-WASH-02
  const locParam = searchParams.get('loc') || 'QR-BLD-A-FL1-WASH-02';
  const currentSpot: CampusLocation =
    campusLocations.find((l) => l.location_id === locParam) || campusLocations[0];

  // Active Spot Ticket (if an issue is already open or resolved at this QR location)
  const spotTicket = getActiveSpotTicket(currentSpot.location_id);

  // Form State (Zero-Login)
  const [selectedCategory, setSelectedCategory] =
    useState<IncidentCategory>('WATER_SUPPLY');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isAnalyzingCV, setIsAnalyzingCV] = useState(false);
  const [cvTags, setCvTags] = useState<string[]>([]);
  const [visionResult, setVisionResult] = useState<VisionAnalysisResult | null>(null);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(() => Boolean(getGeminiApiKey()));
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPhotoError, setShowPhotoError] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{
    ticket: IncidentTicket;
    isDuplicate: boolean;
  } | null>(null);

  // Live Camera Stream State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio speech synthesis feedback when tapping category buttons
  const playAudioFeedback = (text: string) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.log('Audio feedback not available', e);
    }
  };

  const handleSelectCategory = (cat: IncidentCategory) => {
    setSelectedCategory(cat);
    playAudioFeedback(CATEGORY_META[cat].audioText);
  };

  // Process captured/selected image and analyze with Gemini Vision / Edge Engine
  const processCapturedImage = async (dataUrl: string) => {
    setPhotoPreview(dataUrl);
    setShowPhotoError(false);
    setIsAnalyzingCV(true);

    try {
      const analysis = await analyzeImageDefects(dataUrl, selectedCategory);
      setCvTags(analysis.tags);
      setVisionResult(analysis);
      playAudioFeedback(
        analysis.isRealAI
          ? 'Photo analyzed by Google Gemini Vision. Defect identified.'
          : 'Photo captured and defect detected.'
      );
    } catch (err) {
      console.error('Vision analysis failure:', err);
      setCvTags(['defect_detected', 'urgent_inspection']);
    } finally {
      setIsAnalyzingCV(false);
    }
  };

  const handleSaveGeminiKey = (e: React.FormEvent) => {
    e.preventDefault();
    saveGeminiApiKey(geminiKeyInput);
    setHasGeminiKey(Boolean(getGeminiApiKey()));
    setShowKeyModal(false);
    // If photo already exists, re-analyze with the new key!
    if (photoPreview) {
      processCapturedImage(photoPreview);
    }
  };

  // Open Live Device Camera Viewfinder
  const openCamera = async () => {
    setCameraError(null);
    setIsCameraOpen(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera stream not supported in this browser environment. Use Upload Photo instead.');
      }

      let stream: MediaStream;
      try {
        // Try back/environment camera first (mobile)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        // Fallback to default camera (laptop/webcam)
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
      console.warn('Camera access issue:', err);
      setCameraError(err.message || 'Camera access denied or unavailable. Please use file upload below.');
    }
  };

  // Snap frame from active video stream
  const snapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      processCapturedImage(dataUrl);
    }
    closeCamera();
  };

  // Close Camera Stream
  const closeCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraOpen(false);
    setCameraError(null);
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // File Input Handler (Mobile Camera / Gallery / Files)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      processCapturedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Fast Sample Photo for Testing
  const handleUseSamplePhoto = () => {
    const samplePhotos: Record<IncidentCategory, string> = {
      WATER_SUPPLY:
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
      LIGHTS_FAN_PROJECTOR:
        'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=600&q=80',
      WASHROOM_CLEANLINESS:
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
      FURNITURE_MAINTENANCE:
        'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=600&q=80',
    };
    processCapturedImage(samplePhotos[selectedCategory]);
  };

  // Submit Report (Enforce Mandatory Photo)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!photoPreview) {
      setShowPhotoError(true);
      playAudioFeedback('Photo is mandatory. Please capture or upload a photo first.');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const result = submitReport({
        locationId: currentSpot.location_id,
        category: selectedCategory,
        userPhotoUrl: photoPreview,
        aiVisionTags: cvTags,
      });

      setSubmittedResult(result);
      setIsSubmitting(false);
      playAudioFeedback(
        result.isDuplicate
          ? 'Duplicate report recorded! Priority score upgraded.'
          : 'Report submitted successfully to campus administration.'
      );
    }, 1000);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F4F7FB',
        paddingBottom: '80px',
      }}
    >
      {/* Ultra Clean Mobile-First Public Header (Strict Constraint 2) */}
      <header
        style={{
          background: 'white',
          borderBottom: '1px solid #E2E8F0',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 2px 6px rgba(2, 136, 209, 0.35)',
            }}
          >
            <Shield size={22} />
          </div>
          <div>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 900,
                color: '#0F172A',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              CampusPulse
            </div>
            <div style={{ fontSize: '0.72rem', color: '#0288D1', fontWeight: 700 }}>
              Zero-Login Quick Reporter
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Gemini AI Key Status Pill */}
          <button
            type="button"
            onClick={() => {
              setGeminiKeyInput(getGeminiApiKey() || '');
              setShowKeyModal(true);
            }}
            style={{
              background: hasGeminiKey ? '#ECFDF5' : '#FFFBEB',
              border: `1px solid ${hasGeminiKey ? '#A7F3D0' : '#FDE68A'}`,
              borderRadius: 20,
              padding: '5px 10px',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: hasGeminiKey ? '#065F46' : '#92400E',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Sparkles size={13} color={hasGeminiKey ? '#10B981' : '#D97706'} />
            <span>{hasGeminiKey ? 'Gemini 1.5 Active' : 'Connect AI Key'}</span>
          </button>

          {/* Discreet Principal / Admin Portal Link (Constraint 3) */}
          <button
            onClick={() => navigate('/admin/login')}
            style={{
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: 20,
              padding: '5px 12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>Admin Portal</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 520, margin: '0 auto', padding: '16px' }}>
        {/* SPOT QR CODE METADATA BANNER (§2) */}
        <div
          style={{
            background: 'white',
            borderRadius: 16,
            padding: '14px 18px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0288D1', fontWeight: 800, fontSize: '0.78rem' }}>
              <MapPin size={16} />
              <span>SPOT QR LOCATION VERIFIED</span>
            </div>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.72rem',
                background: '#E0F2FE',
                color: '#0369A1',
                padding: '2px 8px',
                borderRadius: 6,
                fontWeight: 700,
              }}
            >
              {currentSpot.fixture_id || 'SPOT'}
            </span>
          </div>

          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.3 }}>
            {currentSpot.building_name}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600, marginTop: 2 }}>
            Floor {currentSpot.floor_number} • Room / Zone: {currentSpot.room_number} ({currentSpot.zone_category})
          </div>

          {/* Demo Spot QR Switcher */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Simulate another Spot QR:</span>
            <select
              style={{
                fontSize: '0.75rem',
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                color: '#334155',
                fontWeight: 600,
              }}
              value={currentSpot.location_id}
              onChange={(e) => setSearchParams({ loc: e.target.value })}
            >
              {campusLocations.map((loc) => (
                <option key={loc.location_id} value={loc.location_id}>
                  {loc.building_name} - {loc.room_number}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* PUBLIC SPOT STATUS BADGE (§2) */}
        {spotTicket && (
          <div
            style={{
              background: 'white',
              borderRadius: 16,
              padding: '16px',
              border: `1.5px solid ${STATUS_META[spotTicket.status].color}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              marginBottom: 16,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: STATUS_META[spotTicket.status].color,
                    display: 'inline-block',
                  }}
                  className={spotTicket.status !== 'RESOLVED' ? 'animate-pulse' : ''}
                />
                <span style={{ fontWeight: 800, fontSize: '0.875rem', color: '#0F172A' }}>
                  Spot Status: {STATUS_META[spotTicket.status].label}
                </span>
              </div>

              {spotTicket.duplicate_count > 1 && (
                <span
                  style={{
                    background: '#FEE2E2',
                    color: '#991B1B',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 12,
                  }}
                >
                  +{spotTicket.duplicate_count} reports clustered
                </span>
              )}
            </div>

            {/* 3-Step Progress Indicator: [ Report Submitted ➔ Technician Dispatched ➔ Issue Resolved ] */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              {(['REPORTED', 'DISPATCHED', 'RESOLVED'] as const).map((stepKey, idx) => {
                const stepMeta = STATUS_META[stepKey];
                const activeIndex = STATUS_META[spotTicket.status].stepIndex;
                const isPassed = idx + 1 <= activeIndex;
                const isCurrent = idx + 1 === activeIndex;

                return (
                  <React.Fragment key={stepKey}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: isPassed ? stepMeta.color : '#E2E8F0',
                          color: isPassed ? 'white' : '#94A3B8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          boxShadow: isCurrent ? `0 0 0 4px ${stepMeta.bgColor}` : 'none',
                        }}
                      >
                        {isPassed ? <Check size={14} strokeWidth={3} /> : idx + 1}
                      </div>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: isCurrent ? 800 : 600,
                          color: isCurrent ? stepMeta.color : '#64748B',
                          textAlign: 'center',
                        }}
                      >
                        {stepKey === 'REPORTED' && 'Submitted'}
                        {stepKey === 'DISPATCHED' && 'Dispatched'}
                        {stepKey === 'RESOLVED' && 'Resolved'}
                      </span>
                    </div>

                    {idx < 2 && (
                      <div
                        style={{
                          flex: 1,
                          height: 3,
                          background: idx + 1 < activeIndex ? '#10B981' : '#E2E8F0',
                          marginBottom: 16,
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Technician En Route info if Dispatched */}
            {spotTicket.status === 'DISPATCHED' && spotTicket.assigned_staff && (
              <div
                style={{
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: '0.8125rem',
                  color: '#92400E',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Clock size={16} color="#D97706" />
                <span>
                  Technician <strong>{spotTicket.assigned_staff.full_name}</strong> is en route.
                </span>
              </div>
            )}

            {/* Fixed Photo Proof if Resolved (§2) */}
            {spotTicket.status === 'RESOLVED' && spotTicket.fixed_photo_url && (
              <div style={{ marginTop: 10, background: '#F0FDF4', borderRadius: 10, padding: '10px', border: '1px solid #BBF7D0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 800, fontSize: '0.78rem', marginBottom: 6 }}>
                  <CheckCircle2 size={16} />
                  <span>MAINTENANCE PROOF: ISSUE FIXED PHOTO</span>
                </div>
                <img
                  src={spotTicket.fixed_photo_url}
                  alt="Fixed Proof"
                  style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8 }}
                />
              </div>
            )}
          </div>
        )}

        {/* SUBMISSION CONFIRMATION MESSAGE */}
        {submittedResult && (
          <div
            style={{
              background: '#ECFDF5',
              border: '2px solid #10B981',
              borderRadius: 16,
              padding: '18px',
              textAlign: 'center',
              marginBottom: 16,
              animation: 'fadeIn 0.3s ease-out',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#10B981',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
              }}
            >
              <Check size={28} strokeWidth={3} />
            </div>

            {submittedResult.isDuplicate && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800, marginBottom: 8 }}>
                <Layers size={14} />
                <span>SMART DUPLICATE DETECTED (+{submittedResult.ticket.duplicate_count} Reports Clustered)</span>
              </div>
            )}

            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#065F46' }}>
              {submittedResult.isDuplicate ? 'Report Clustered & Escalated!' : 'Issue Successfully Reported!'}
            </h3>
            <p style={{ fontSize: '0.825rem', color: '#047857', marginTop: 4 }}>
              {submittedResult.isDuplicate
                ? `Active issue clustered! Total ${submittedResult.ticket.duplicate_count} students/staff reported this spot. Escalated to Priority ${submittedResult.ticket.ai_severity_score}/100.`
                : 'Directly routed to Facilities Administration. Maintenance team alerted.'}
            </p>

            <button
              onClick={() => {
                setSubmittedResult(null);
                setPhotoPreview(null);
                setCvTags([]);
                setShowPhotoError(false);
              }}
              style={{
                marginTop: 12,
                background: '#065F46',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Report Another Problem Here
            </button>
          </div>
        )}

        {/* PICTOGRAPHIC REPORTING FORM (§2) */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'white',
            borderRadius: 20,
            padding: '20px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Section 1: 4 Large Pictographic Buttons for Non-Literate Staff (Aayas) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0F172A' }}>
                1. Tap Issue Category / समस्या चुनें
              </label>
              <span style={{ fontSize: '0.72rem', color: '#0288D1', fontWeight: 700 }}>
                Audio Guided 🔊
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {(
                [
                  'WATER_SUPPLY',
                  'LIGHTS_FAN_PROJECTOR',
                  'WASHROOM_CLEANLINESS',
                  'FURNITURE_MAINTENANCE',
                ] as IncidentCategory[]
              ).map((cat) => {
                const meta = CATEGORY_META[cat];
                const isSelected = selectedCategory === cat;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    style={{
                      padding: '16px 12px',
                      borderRadius: 16,
                      border: isSelected ? `3px solid ${meta.color}` : '2px solid #E2E8F0',
                      background: isSelected ? meta.bgColor : '#FAFAFA',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-out',
                      textAlign: 'center',
                      boxShadow: isSelected ? `0 4px 14px ${meta.color}30` : 'none',
                      transform: isSelected ? 'scale(1.02)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{meta.icon}</span>
                    <div>
                      <div
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 800,
                          color: isSelected ? meta.color : '#1E293B',
                          lineHeight: 1.2,
                        }}
                      >
                        {meta.label}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 2 }}>
                        {meta.sublabel}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Photo Capture (Mandatory Proof) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0F172A' }}>
                2. Photo Proof / फोटो प्रमाण
              </label>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: photoPreview ? '#059669' : '#DC2626',
                  background: photoPreview ? '#ECFDF5' : '#FEF2F2',
                  border: `1px solid ${photoPreview ? '#A7F3D0' : '#FECACA'}`,
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                {photoPreview ? '✓ Photo Attached' : '* Photo Required'}
              </span>
            </div>

            {/* Hidden file input for file upload / camera fallback */}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
            />

            {/* Interactive Live Camera Viewfinder Modal / Card */}
            {isCameraOpen ? (
              <div
                style={{
                  background: '#0F172A',
                  borderRadius: 16,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  alignItems: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: 'white', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Camera size={18} color="#38BDF8" />
                    <span>Live Camera Viewfinder</span>
                  </div>
                  <button
                    type="button"
                    onClick={closeCamera}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: 'none',
                      color: 'white',
                      borderRadius: 8,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.75rem',
                    }}
                  >
                    <X size={14} />
                    <span>Cancel</span>
                  </button>
                </div>

                {cameraError ? (
                  <div style={{ background: '#451A1A', border: '1px solid #7F1D1D', color: '#FCA5A5', padding: 12, borderRadius: 10, fontSize: '0.8rem', textAlign: 'center', width: '100%' }}>
                    {cameraError}
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          background: '#0288D1',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Choose File Instead
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      autoPlay
                      muted
                      style={{
                        width: '100%',
                        height: 240,
                        objectFit: 'cover',
                        borderRadius: 12,
                        background: '#1E293B',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                      <button
                        type="button"
                        onClick={snapPhoto}
                        style={{
                          flex: 1,
                          padding: '12px',
                          borderRadius: 12,
                          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                          color: 'white',
                          border: 'none',
                          fontSize: '0.9rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                      >
                        <Camera size={20} />
                        <span>Snap Photo Now / फोटो खींचें</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Capture Action Buttons */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* Button 1: Live Camera Stream */}
                <button
                  type="button"
                  onClick={openCamera}
                  style={{
                    padding: '14px 10px',
                    borderRadius: 14,
                    border: '2px solid #0288D1',
                    background: '#F0F9FF',
                    color: '#0288D1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                  }}
                >
                  <Camera size={24} color="#0288D1" />
                  <span>Open Camera 📸</span>
                  <span style={{ fontSize: '0.65rem', color: '#0369A1', fontWeight: 600 }}>Use Device Camera</span>
                </button>

                {/* Button 2: Upload File or Gallery */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '14px 10px',
                    borderRadius: 14,
                    border: '2px dashed #94A3B8',
                    background: '#F8FAFC',
                    color: '#475569',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                  }}
                >
                  <Upload size={24} color="#475569" />
                  <span>Upload Photo 📁</span>
                  <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600 }}>From Gallery / Files</span>
                </button>
              </div>
            )}

            {/* Quick Demo Sample Photo Link (Helpful on Desktop without webcam) */}
            {!photoPreview && !isCameraOpen && (
              <div style={{ textAlign: 'center', marginTop: 2 }}>
                <button
                  type="button"
                  onClick={handleUseSamplePhoto}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#0288D1',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  💡 Testing on desktop? Click here to use sample {CATEGORY_META[selectedCategory].label} photo
                </button>
              </div>
            )}

            {/* Photo Preview & Computer Vision Defect Tags */}
            {photoPreview && (
              <div
                style={{
                  background: '#F8FAFC',
                  borderRadius: 14,
                  padding: 12,
                  border: '1px solid #CBD5E1',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <img
                  src={photoPreview}
                  alt="Captured Issue"
                  style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', border: '1px solid #CBD5E1' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Sparkles size={14} color="#0288D1" />
                        AI Defect Vision
                      </span>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontWeight: 800,
                          background: visionResult?.isRealAI ? '#ECFDF5' : '#F1F5F9',
                          color: visionResult?.isRealAI ? '#059669' : '#64748B',
                          border: `1px solid ${visionResult?.isRealAI ? '#A7F3D0' : '#CBD5E1'}`,
                        }}
                      >
                        {visionResult?.isRealAI ? 'Google Gemini 1.5 Flash' : 'Edge Defect Engine'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPreview(null);
                        setCvTags([]);
                        setVisionResult(null);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#EF4444',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  {isAnalyzingCV ? (
                    <div style={{ fontSize: '0.75rem', color: '#0288D1', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Inspecting image with Computer Vision...</span>
                    </div>
                  ) : (
                    <>
                      {visionResult?.summary && (
                        <div style={{ fontSize: '0.72rem', color: '#334155', fontWeight: 600, marginBottom: 6, fontStyle: 'italic', lineHeight: 1.3 }}>
                          "{visionResult.summary}"
                        </div>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {cvTags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: '0.68rem',
                              background: '#E0F2FE',
                              color: '#0369A1',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontWeight: 700,
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Error Message if User Tries to Submit Without Photo */}
            {showPhotoError && !photoPreview && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 10,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#B91C1C',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                <AlertCircle size={18} />
                <span>Photo proof is required before submission! Please snap or upload a photo.</span>
              </div>
            )}
          </div>

          {/* Instant Submit Button (Disabled until Photo is provided) */}
          <button
            type="submit"
            disabled={isSubmitting || !photoPreview}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 16,
              border: 'none',
              background: !photoPreview
                ? '#CBD5E1'
                : 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
              color: !photoPreview ? '#64748B' : 'white',
              fontSize: '1.05rem',
              fontWeight: 900,
              cursor: !photoPreview ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: !photoPreview ? 'none' : '0 6px 20px rgba(2, 136, 209, 0.4)',
              transition: 'all 0.15s ease',
            }}
          >
            {isSubmitting ? (
              <span>Transmitting Incident to Administration...</span>
            ) : !photoPreview ? (
              <>
                <Camera size={20} />
                <span>Photo Required to Submit / फोटो अनिवार्य है</span>
              </>
            ) : (
              <>
                <span>Submit Spot Report / शिकायत दर्ज करें</span>
                <Check size={20} strokeWidth={3} />
              </>
            )}
          </button>
        </form>

        {/* Gemini API Key Configuration Modal */}
        {showKeyModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: 20,
                padding: 24,
                maxWidth: 440,
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0288D1', fontWeight: 900, fontSize: '1.05rem' }}>
                  <Sparkles size={20} />
                  <span>Google Gemini Vision API Key</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                >
                  <X size={20} />
                </button>
              </div>

              <p style={{ fontSize: '0.82rem', color: '#64748B', lineHeight: 1.4, marginBottom: 14 }}>
                Enter your Google Gemini API key to activate live multimodal AI defect detection directly on photos taken by students and staff.
              </p>

              <form onSubmit={handleSaveGeminiKey}>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    marginBottom: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
                      color: 'white',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Save & Activate Live AI
                  </button>
                  {hasGeminiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        saveGeminiApiKey('');
                        setHasGeminiKey(false);
                        setGeminiKeyInput('');
                        setShowKeyModal(false);
                      }}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: '#FEE2E2',
                        color: '#B91C1C',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      Clear Key
                    </button>
                  )}
                </div>

                <div style={{ marginTop: 12, fontSize: '0.72rem', color: '#94A3B8', textAlign: 'center' }}>
                  You can also permanently set <code>VITE_GEMINI_API_KEY</code> in <code>campus-guard/.env</code>.
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
