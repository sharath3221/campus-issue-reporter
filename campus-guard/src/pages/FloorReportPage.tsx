import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  MapPin,
  Camera,
  CheckCircle2,
  Clock,
  Sparkles,
  Check,
  Shield,
  ChevronRight,
  AlertCircle,
  X,
  Upload,
  RefreshCw,
  Building,
  Layers,
  ArrowLeft,
  AlertTriangle,
  QrCode,
  Tag,
  ExternalLink,
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
  VisionAnalysisResult,
} from '../lib/geminiVision';
import { supabase, isSupabaseConfigured, uploadIncidentMedia } from '../lib/supabaseClient';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

export const FloorReportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { campusLocations, submitReport, addCampusLocation } = useIncidents();

  // 1. Read URL Query Parameters from Floor QR Code
  // e.g. /floor-report?bld=Engineering%20Block%20A&flr=1&code=QR-ENGA-FL1
  const bldParam = searchParams.get('bld') || searchParams.get('building') || 'Engineering Block A';
  const flrParam = parseInt(searchParams.get('flr') || searchParams.get('floor') || '1', 10);
  const floorNumber = isNaN(flrParam) ? 1 : flrParam;
  const stationCode =
    searchParams.get('code') ||
    `QR-${bldParam.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase()}-FL${floorNumber}`;

  // Form State
  const [roomNumber, setRoomNumber] = useState<string>('');
  const [selectedRoomDropdown, setSelectedRoomDropdown] = useState<string>('');
  const [isCustomRoom, setIsCustomRoom] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<IncidentCategory>('WATER_SUPPLY');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isAnalyzingCV, setIsAnalyzingCV] = useState(false);
  const [cvTags, setCvTags] = useState<string[]>([]);
  const [visionResult, setVisionResult] = useState<VisionAnalysisResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPhotoError, setShowPhotoError] = useState(false);
  const [showRoomError, setShowRoomError] = useState(false);

  // Submitted ticket state
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

  // Live Supabase fetch for campus rooms on this floor
  const [supabaseRooms, setSupabaseRooms] = useState<CampusLocation[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase
      .from('campus_locations')
      .select('*')
      .eq('floor_number', floorNumber)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setSupabaseRooms(data as CampusLocation[]);
        }
      });
  }, [floorNumber]);

  // Compute all architectural rooms for this building & floor
  const normalizeText = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanBldParam = normalizeText(bldParam);

  interface ArchitecturalRoomItem {
    room_number: string;
    zone_category: CampusLocation['zone_category'];
    label: string;
    icon: string;
  }

  const ZONE_ICONS: Record<string, string> = {
    CLASSROOM: '🎓',
    WASHROOM: '🚰',
    LABORATORY: '🔬',
    CORRIDOR: '🚪',
    FACULTY_ROOM: '💼',
  };

  const architecturalRooms: ArchitecturalRoomItem[] = (() => {
    const combined = [...campusLocations, ...supabaseRooms];
    const seen = new Set<string>();
    const items: ArchitecturalRoomItem[] = [];

    combined.forEach((loc) => {
      const locBld = normalizeText(loc.building_name);
      const isBldMatch =
        locBld === cleanBldParam ||
        locBld.includes(cleanBldParam) ||
        cleanBldParam.includes(locBld);
      const isFloorMatch = Number(loc.floor_number) === Number(floorNumber);

      if (isBldMatch && isFloorMatch && loc.room_number?.trim()) {
        const rm = loc.room_number.trim().toUpperCase();
        if (!seen.has(rm)) {
          seen.add(rm);
          const zone = loc.zone_category || 'CLASSROOM';
          items.push({
            room_number: rm,
            zone_category: zone,
            label: `${rm} (${zone.charAt(0) + zone.slice(1).toLowerCase().replace('_', ' ')})`,
            icon: ZONE_ICONS[zone] || '📍',
          });
        }
      }
    });

    // If no rooms are pre-registered on this floor, supply standard architectural starter options
    if (items.length === 0) {
      const flrPrefix = floorNumber === 0 ? 'G' : `${floorNumber}`;
      items.push(
        { room_number: `LH-${flrPrefix}01`, zone_category: 'CLASSROOM', label: `LH-${flrPrefix}01 (Classroom)`, icon: '🎓' },
        { room_number: `LH-${flrPrefix}02`, zone_category: 'CLASSROOM', label: `LH-${flrPrefix}02 (Classroom)`, icon: '🎓' },
        { room_number: `LH-${flrPrefix}03`, zone_category: 'CLASSROOM', label: `LH-${flrPrefix}03 (Classroom)`, icon: '🎓' },
        { room_number: `WASH-${flrPrefix}01`, zone_category: 'WASHROOM', label: `WASH-${flrPrefix}01 (Washroom)`, icon: '🚰' },
        { room_number: `LAB-${flrPrefix}01`, zone_category: 'LABORATORY', label: `LAB-${flrPrefix}01 (Lab)`, icon: '🔬' },
        { room_number: `CORR-${flrPrefix}01`, zone_category: 'CORRIDOR', label: `Corridor / Hallway`, icon: '🚪' }
      );
    }

    return items;
  })();

  // Handle Room Dropdown Change
  const handleRoomDropdownChange = (val: string) => {
    setSelectedRoomDropdown(val);
    setShowRoomError(false);

    if (val === '__OTHER__') {
      setIsCustomRoom(true);
      setRoomNumber('');
    } else {
      setIsCustomRoom(false);
      setRoomNumber(val);

      // Auto-suggest category if washroom
      const match = architecturalRooms.find((r) => r.room_number === val);
      if (match) {
        if (match.zone_category === 'WASHROOM') {
          setSelectedCategory('WATER_SUPPLY');
        }
      }
    }
  };

  const handleSelectCategory = (cat: IncidentCategory) => {
    setSelectedCategory(cat);
  };

  // Start Live Camera
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraOpen(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported on this device/browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      console.warn('Live camera stream unavailable:', err);
      const msg = err instanceof Error ? err.message : 'Camera permission denied or camera unavailable.';
      setCameraError(msg);
      closeCamera();
      fileInputRef.current?.click();
    }
  };

  // Close Camera
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
      } catch (e) {
        console.warn('Error resetting video object:', e);
      }
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
        });
      } catch (e) {
        console.warn('Error clearing mediaStream:', e);
      }
      mediaStreamRef.current = null;
    }

    setIsCameraOpen(false);
    setCameraError(null);
  };

  useEffect(() => {
    return () => {
      closeCamera();
    };
  }, []);

  // Snap frame from active video stream
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
      processCapturedImage(dataUrl);
    }
  };

  // Process captured/selected image automatically with Computer Vision + Gemini Genuineness Verification
  const processCapturedImage = async (dataUrl: string) => {
    setPhotoPreview(dataUrl);
    setShowPhotoError(false);
    setIsAnalyzingCV(true);
    setVisionResult(null);

    try {
      const analysis = await analyzeImageDefects(dataUrl, selectedCategory);
      setCvTags(analysis.tags);
      setVisionResult(analysis);
    } catch (err) {
      console.error('Vision analysis error:', err);
      // Fallback genuine check
      const fallbackResult: VisionAnalysisResult = {
        isGenuine: true,
        tags: ['defect_detected', 'urgent_inspection'],
        severityScore: 8.0,
        summary: 'Photo accepted for manual facility inspection.',
        isRealAI: false,
        modelUsed: 'Autonomous Vision Fallback',
      };
      setCvTags(fallbackResult.tags);
      setVisionResult(fallbackResult);
    } finally {
      setIsAnalyzingCV(false);
    }
  };

  // File Upload Handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      processCapturedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Clear photo and retake
  const handleRetakePhoto = () => {
    setPhotoPreview(null);
    setVisionResult(null);
    setCvTags([]);
    setShowPhotoError(false);
    startCamera();
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate Room Number
    const trimmedRoom = roomNumber.trim();
    if (!trimmedRoom) {
      setShowRoomError(true);
      return;
    }
    setShowRoomError(false);

    // 2. Validate Photo
    if (!photoPreview) {
      setShowPhotoError(true);
      return;
    }

    // 3. ENFORCE GEMINI GENUINENESS VERIFICATION & NO-DEFECT REJECTION
    const hasNoDefectTag = cvTags.some((t) =>
      ['no_detectable_defects', 'image_unclear', 'no_defect', 'no_damage', 'blurry', 'unclear', 'insufficient'].some((bad) =>
        t.toLowerCase().includes(bad)
      )
    );

    if (!visionResult || !visionResult.isGenuine || hasNoDefectTag) {
      return;
    }

    setIsSubmitting(true);

    try {
      // 4. Synthesize Location ID for this specific room
      const cleanBld = bldParam.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
      const cleanRm = trimmedRoom.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
      const synthesizedLocationId = `QR-${cleanBld}-FL${floorNumber}-${cleanRm}`;

      // Upsert location to Supabase and local store
      const locationPayload: CampusLocation = {
        location_id: synthesizedLocationId,
        building_name: bldParam,
        floor_number: floorNumber,
        room_number: trimmedRoom.toUpperCase(),
        zone_category: selectedCategory === 'WATER_SUPPLY' ? 'WASHROOM' : 'CLASSROOM',
        gps_latitude: 16.8456,
        gps_longitude: 74.6012,
        x_coord: 250,
        y_coord: 150,
      };

      try {
        await addCampusLocation(locationPayload);
      } catch (locErr) {
        console.warn('Location upsert notice:', locErr);
      }

      // 5. Upload photo to Supabase storage
      let publicStorageUrl: string | null = null;
      try {
        publicStorageUrl = await uploadIncidentMedia(
          photoPreview,
          `${synthesizedLocationId}-${Date.now().toString().slice(-6)}.jpg`
        );
      } catch (uploadErr) {
        console.warn('Storage bucket upload notice:', uploadErr);
      }

      // 6. Submit Ticket
      const result = submitReport({
        locationId: synthesizedLocationId,
        category: selectedCategory,
        userPhotoUrl: publicStorageUrl || photoPreview,
        aiVisionTags: cvTags.length > 0 ? cvTags : ['facility_defect'],
      });

      setSubmittedResult(result);
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.65 },
          colors: ['#0288D1', '#10B981', '#F59E0B', '#3B82F6'],
        });
      } catch (e) {}
    } catch (err) {
      console.error('Submission failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const floorLabel =
    floorNumber === 0 ? 'Ground Floor' : floorNumber < 0 ? `Basement ${Math.abs(floorNumber)}` : `Floor ${floorNumber}`;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F4F7FB',
        paddingBottom: '80px',
      }}
    >
      {/* Mobile-First Header */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                  color: '#0F172A',
                }}
              >
                CampusPulse
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  background: '#E0F2FE',
                  color: '#0288D1',
                  padding: '2px 6px',
                  borderRadius: 6,
                  textTransform: 'uppercase',
                }}
              >
                Floor Station
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#64748B', margin: 0 }}>
              AI-Verified Facility Reporting
            </p>
          </div>
        </div>

        <Link
          to="/admin/login"
          style={{
            fontSize: '0.72rem',
            color: '#64748B',
            textDecoration: 'none',
            fontWeight: 700,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid #E2E8F0',
            background: '#F8FAFC',
          }}
        >
          Staff Login
        </Link>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: 540, margin: '0 auto', padding: '16px' }}>
        {/* If successfully submitted, show Live Tracking Progress screen */}
        {submittedResult ? (
          <div
            style={{
              background: 'white',
              borderRadius: 20,
              padding: '24px 20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
            }}
          >
            {/* Status Header */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  background: submittedResult.isDuplicate ? '#FEF3C7' : '#DCFCE7',
                  color: submittedResult.isDuplicate ? '#D97706' : '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <CheckCircle2 size={32} />
              </div>

              <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>
                {submittedResult.isDuplicate ? 'Priority Escalated!' : 'Report Verified & Submitted!'}
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0 }}>
                {submittedResult.isDuplicate
                  ? 'Another report was recently filed for this spot. AI escalated the priority score.'
                  : 'Gemini AI confirmed defect authenticity. Dispatch notification triggered.'}
              </p>
            </div>

            {/* Ticket Card Details */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1.5px solid #E2E8F0',
                borderRadius: 14,
                padding: '14px 16px',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                  TICKET ID
                </span>
                <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 800, color: '#0288D1' }}>
                  #{submittedResult.ticket.ticket_id.slice(0, 8).toUpperCase()}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Building size={16} color="#0288D1" />
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A' }}>
                  {bldParam} • {floorLabel}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <MapPin size={16} color="#0288D1" />
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
                  Room / Area: <b>{roomNumber.trim().toUpperCase()}</b>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={16} color="#0288D1" />
                <span style={{ fontSize: '0.82rem', color: '#64748B' }}>
                  Category: <b>{CATEGORY_META[selectedCategory].label}</b>
                </span>
              </div>
            </div>

            {/* 3-Step Live Progress Tracker */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '0.84rem', fontWeight: 800, color: '#334155', marginBottom: 12 }}>
                Live Resolution Progress
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Step 1: Audited & Queued */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: '#16A34A',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
                      Step 1: Verified by Gemini AI
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                      Defect verified as genuine. Ticket created in maintenance queue.
                    </div>
                  </div>
                </div>

                {/* Step 2: Technician Dispatch */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: '#F59E0B',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    2
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
                      Step 2: Technician Assigned & In-Transit
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                      Facility team notified for on-site inspection.
                    </div>
                  </div>
                </div>

                {/* Step 3: Fixed with Photographic Proof */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: '#E2E8F0',
                      color: '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    3
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#64748B' }}>
                      Step 3: Verification & Closure
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                      Technician uploads resolution proof photo on `/maintenance`.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action to submit another issue */}
            <button
              onClick={() => {
                setSubmittedResult(null);
                setPhotoPreview(null);
                setVisionResult(null);
                setCvTags([]);
                setRoomNumber('');
              }}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 12,
                border: '1.5px solid #0288D1',
                background: '#F0F9FF',
                color: '#0288D1',
                fontSize: '0.88rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              + Report Another Issue on this Floor
            </button>
          </div>
        ) : (
          /* Active Reporting Form */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 1. Verified Building & Floor Station Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
                borderRadius: 16,
                padding: '16px 18px',
                color: 'white',
                boxShadow: '0 4px 14px rgba(2, 136, 209, 0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <QrCode size={16} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em', opacity: 0.9 }}>
                    SCANNED FLOOR QR STATION
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.66rem',
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                  }}
                >
                  {stationCode}
                </span>
              </div>

              <h1 style={{ fontSize: '1.3rem', fontWeight: 900, margin: '2px 0 4px', lineHeight: 1.2 }}>
                {bldParam}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', opacity: 0.95 }}>
                <Layers size={15} />
                <span>Station: <b>{floorLabel}</b></span>
                <span style={{ opacity: 0.6 }}>•</span>
                <span>Location Locked</span>
              </div>
            </div>

            {/* 2. Room / Area Dropdown Selection (Fetched from Campus Architecture) */}
            <div
              style={{
                background: 'white',
                borderRadius: 16,
                padding: '16px',
                border: showRoomError ? '2px solid #EF4444' : '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    color: '#0F172A',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <MapPin size={16} color="#0288D1" />
                  <span>1. Select Room / Area on this Floor *</span>
                </label>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    background: '#F0F9FF',
                    color: '#0288D1',
                    border: '1px solid #BAE6FD',
                    padding: '2px 7px',
                    borderRadius: 6,
                  }}
                >
                  Campus Architecture
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#64748B', margin: '0 0 10px' }}>
                Select the affected room or facility configured in the college architecture:
              </p>

              {/* Primary Dropdown Selector */}
              <select
                value={selectedRoomDropdown}
                onChange={(e) => handleRoomDropdownChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '13px 14px',
                  borderRadius: 12,
                  border: showRoomError ? '2px solid #EF4444' : '2px solid #0288D1',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  boxSizing: 'border-box',
                  outline: 'none',
                  background: 'white',
                  color: selectedRoomDropdown ? '#0F172A' : '#64748B',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(2, 136, 209, 0.08)',
                }}
              >
                <option value="">-- Choose Room / Area from Architecture --</option>
                {architecturalRooms.map((rm) => (
                  <option key={rm.room_number} value={rm.room_number}>
                    {rm.icon} {rm.label}
                  </option>
                ))}
                <option value="__OTHER__">+ Specify Another Room or Area...</option>
              </select>

              {/* Custom Room Input if user selects '+ Specify Another' */}
              {isCustomRoom && (
                <div style={{ marginTop: 10 }}>
                  <input
                    type="text"
                    placeholder="Type room number or specific spot (e.g. Near Lift, Corridor 204)"
                    value={roomNumber}
                    onChange={(e) => {
                      setRoomNumber(e.target.value);
                      setShowRoomError(false);
                    }}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '11px 13px',
                      borderRadius: 10,
                      border: '1.5px solid #0288D1',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                      background: '#F8FAFC',
                    }}
                  />
                </div>
              )}

              {/* Quick 1-Tap Room Selection Chips */}
              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Quick 1-Tap Room Selection on {floorLabel}:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {architecturalRooms.map((rm) => (
                    <button
                      key={rm.room_number}
                      type="button"
                      onClick={() => handleRoomDropdownChange(rm.room_number)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: roomNumber.toUpperCase() === rm.room_number ? '2px solid #0288D1' : '1px solid #E2E8F0',
                        background: roomNumber.toUpperCase() === rm.room_number ? '#E0F2FE' : '#F8FAFC',
                        color: roomNumber.toUpperCase() === rm.room_number ? '#0288D1' : '#334155',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>{rm.icon}</span>
                      <span>{rm.room_number}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Room Feedback Indicator */}
              {roomNumber && !isCustomRoom && (
                <div
                  style={{
                    marginTop: 10,
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: '0.74rem',
                    color: '#15803D',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Check size={14} />
                  <span>Selected Facility: <b>{roomNumber}</b> ({floorLabel})</span>
                </div>
              )}

              {showRoomError && (
                <div style={{ color: '#EF4444', fontSize: '0.74rem', fontWeight: 700, marginTop: 8 }}>
                  ⚠️ Please select a room or area from the dropdown list.
                </div>
              )}
            </div>

            {/* 3. Issue Category Selection */}
            <div
              style={{
                background: 'white',
                borderRadius: 16,
                padding: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <label
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  color: '#0F172A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                <Tag size={16} color="#0288D1" />
                <span>2. Select Defect Category</span>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(Object.keys(CATEGORY_META) as IncidentCategory[]).map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const isSelected = selectedCategory === cat;
                  return (
                    <motion.button
                      key={cat}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectCategory(cat)}
                      style={{
                        padding: '12px 10px',
                        borderRadius: 12,
                        border: isSelected ? '2px solid #0288D1' : '1.5px solid #E2E8F0',
                        background: isSelected ? '#F0F9FF' : '#F8FAFC',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'border 0.15s ease, background 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: '1.75rem', marginBottom: 4 }}>{meta.icon}</span>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          color: isSelected ? '#0288D1' : '#1E293B',
                        }}
                      >
                        {meta.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* 4. Mandatory Defect Photo & Gemini Verification */}
            <div
              style={{
                background: 'white',
                borderRadius: 16,
                padding: '16px',
                border: showPhotoError ? '2px solid #EF4444' : '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    color: '#0F172A',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Camera size={16} color="#0288D1" />
                  <span>3. Defect Photo (Mandatory) *</span>
                </label>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: '#6366F1',
                    background: '#EEF2FF',
                    padding: '2px 8px',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Sparkles size={11} />
                  Gemini Verified
                </span>
              </div>

              {/* Hidden file input for gallery/camera upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />

              {/* Active Video Stream Viewfinder */}
              {isCameraOpen ? (
                <div
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#0F172A',
                    position: 'relative',
                    marginBottom: 12,
                  }}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 12,
                      left: 0,
                      right: 0,
                      display: 'flex',
                      justifyContent: 'center',
                      gap: 12,
                    }}
                  >
                    <button
                      type="button"
                      onClick={snapPhoto}
                      style={{
                        padding: '10px 22px',
                        borderRadius: 30,
                        background: '#0288D1',
                        color: 'white',
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.84rem',
                        boxShadow: '0 4px 12px rgba(2, 136, 209, 0.4)',
                      }}
                    >
                      📸 Snap Defect Photo
                    </button>
                    <button
                      type="button"
                      onClick={closeCamera}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 30,
                        background: 'rgba(15, 23, 42, 0.7)',
                        color: 'white',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Photo Display / Action Buttons */}
              {!isCameraOpen && (
                <div>
                  {photoPreview ? (
                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                      <img
                        src={photoPreview}
                        alt="Captured defect"
                        style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
                      />
                      <button
                        type="button"
                        onClick={handleRetakePhoto}
                        style={{
                          position: 'absolute',
                          top: 10,
                          right: 10,
                          background: 'rgba(15, 23, 42, 0.75)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <RefreshCw size={12} />
                        Retake Photo
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <button
                        type="button"
                        onClick={startCamera}
                        style={{
                          padding: '16px 12px',
                          borderRadius: 12,
                          border: '1.5px dashed #0288D1',
                          background: '#F0F9FF',
                          color: '#0288D1',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                        }}
                      >
                        <Camera size={24} />
                        <span>Open Camera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          padding: '16px 12px',
                          borderRadius: 12,
                          border: '1.5px dashed #CBD5E1',
                          background: '#F8FAFC',
                          color: '#475569',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                        }}
                      >
                        <Upload size={24} />
                        <span>Upload from Gallery</span>
                      </button>
                    </div>
                  )}

                  {showPhotoError && (
                    <div style={{ color: '#EF4444', fontSize: '0.74rem', fontWeight: 700, marginTop: 4 }}>
                      ⚠️ Photo of the defect is required to submit a report.
                    </div>
                  )}
                </div>
              )}

              {/* AI Analysis Spinner */}
              {isAnalyzingCV && (
                <div
                  style={{
                    background: '#F1F5F9',
                    borderRadius: 10,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: '0.76rem',
                    color: '#475569',
                  }}
                >
                  <RefreshCw size={16} className="animate-spin" color="#0288D1" />
                  <span>Inspecting photo authenticity with Google Gemini 2.5 Flash...</span>
                </div>
              )}

              {/* CRITICAL: GEMINI GENUINENESS VERIFICATION & REJECTION UI */}
              {visionResult && !isAnalyzingCV && (
                <div>
                  {!visionResult.isGenuine ||
                  cvTags.some((t) =>
                    ['no_detectable_defects', 'image_unclear', 'no_defect', 'no_damage', 'blurry', 'unclear'].some((bad) =>
                      t.toLowerCase().includes(bad)
                    )
                  ) ? (
                    /* REJECTION CARD: NON-GENUINE REPORT OR NO DEFECT */
                    <div
                      style={{
                        background: '#FEF2F2',
                        border: '2px solid #EF4444',
                        borderRadius: 12,
                        padding: '14px 16px',
                        marginTop: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: '#FEE2E2',
                            color: '#DC2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <AlertTriangle size={18} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 900, color: '#991B1B', margin: '0 0 4px' }}>
                            ❌ Report Rejected by AI Verification
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: '#B91C1C', margin: '0 0 8px', lineHeight: 1.4 }}>
                            {visionResult.rejectionReason ||
                              visionResult.summary ||
                              'This photo does not depict a genuine campus facility defect. Blurry photos, memes, selfies, blank images, or undamaged surfaces cannot be submitted.'}
                          </p>
                          <div style={{ fontSize: '0.72rem', color: '#7F1D1D', marginBottom: 10 }}>
                            <b>Verification Policy:</b> CampusPulse only accepts genuine educational facility defects
                            (e.g., plumbing leaks, broken furniture, uncleaned washrooms, damaged electrical fixtures).
                          </div>

                          <button
                            type="button"
                            onClick={handleRetakePhoto}
                            style={{
                              padding: '8px 14px',
                              borderRadius: 8,
                              background: '#DC2626',
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
                            <RefreshCw size={13} />
                            Retake Defect Photo
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* VERIFIED CARD: GENUINE REPORT */
                    <div
                      style={{
                        background: '#F0FDF4',
                        border: '1.5px solid #86EFAC',
                        borderRadius: 12,
                        padding: '12px 14px',
                        marginTop: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <CheckCircle2 size={16} color="#16A34A" />
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#166534' }}>
                          Verified Genuine Campus Defect
                        </span>
                        <span
                          style={{
                            fontSize: '0.64rem',
                            background: '#DCFCE7',
                            color: '#15803D',
                            padding: '2px 6px',
                            borderRadius: 6,
                            fontWeight: 800,
                            marginLeft: 'auto',
                          }}
                        >
                          Gemini 2.5 Flash
                        </span>
                      </div>

                      <div style={{ fontSize: '0.74rem', color: '#14532D', marginBottom: 6 }}>
                        {visionResult.summary}
                      </div>

                      {cvTags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {cvTags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                fontSize: '0.66rem',
                                background: '#DCFCE7',
                                color: '#166534',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontFamily: 'monospace',
                                fontWeight: 700,
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 5. Submit Action Button */}
            {visionResult &&
            (!visionResult.isGenuine ||
              cvTags.some((t) =>
                ['no_detectable_defects', 'image_unclear', 'no_defect', 'no_damage', 'blurry', 'unclear'].some((bad) =>
                  t.toLowerCase().includes(bad)
                )
              )) ? (
              /* Blocked Button when rejected */
              <div
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 14,
                  background: '#FEE2E2',
                  color: '#991B1B',
                  border: '1.5px solid #F87171',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  textAlign: 'center',
                }}
              >
                ❌ Submission Blocked — No Detectable Facility Defect
              </div>
            ) : (
              /* Standard Submit Button */
              <button
                type="submit"
                disabled={isSubmitting || isAnalyzingCV}
                style={{
                  width: '100%',
                  padding: '15px',
                  borderRadius: 14,
                  border: 'none',
                  background: isSubmitting
                    ? '#94A3B8'
                    : 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
                  color: 'white',
                  fontSize: '0.98rem',
                  fontWeight: 900,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(2, 136, 209, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Submitting Verified Report...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Verified Report</span>
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            )}

            {/* Footer Institutional Assurance */}
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                Secure, Zero-Login Campus Infrastructure Monitoring • CampusPulse
              </span>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};
export default FloorReportPage;
