import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Camera,
  Mic,
  CheckCircle2,
  Clock,
  Sparkles,
  Volume2,
  RotateCcw,
  Check,
  Shield,
  Layers,
  ArrowRight,
  ChevronRight,
  Eye,
  AlertCircle,
} from 'lucide-react';
import {
  IncidentCategory,
  CATEGORY_META,
  STATUS_META,
  IncidentTicket,
  CampusLocation,
} from '../types';
import { useIncidents } from '../hooks/useIncidents';

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
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isAnalyzingCV, setIsAnalyzingCV] = useState(false);
  const [cvTags, setCvTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{
    ticket: IncidentTicket;
    isDuplicate: boolean;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

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

  // 5-second voice recording simulation with waveform visualizer
  const startRecording = () => {
    if (isRecording) {
      clearInterval(timerRef.current);
      setIsRecording(false);
      return;
    }

    setIsRecording(true);
    setVoiceSeconds(0);
    playAudioFeedback('Recording voice note. Bolna shuru kijiye.');

    let count = 0;
    timerRef.current = setInterval(() => {
      count += 1;
      setVoiceSeconds(count);
      if (count >= 5) {
        clearInterval(timerRef.current);
        setIsRecording(false);
        // Simulated Speech-to-Text output based on selected category
        const transcripts: Record<IncidentCategory, string> = {
          WATER_SUPPLY:
            'Paani leak ho raha hai aur tap se overflow chal raha hai yahan par.',
          LIGHTS_FAN_PROJECTOR:
            'Light band hai aur fan chal nahi raha hai, class me dikkat ho rahi hai.',
          WASHROOM_CLEANLINESS:
            'Washroom bahut dirty hai, safai ki sakht zaroorat hai.',
          FURNITURE_MAINTENANCE:
            'Desk toota hua hai aur bench hil raha hai gir sakta hai.',
        };
        setVoiceTranscript(transcripts[selectedCategory]);
        playAudioFeedback('Voice note recorded and transcribed.');
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Instant Camera Image Upload & Computer Vision simulation
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
      setIsAnalyzingCV(true);

      // Simulate real-time Computer Vision defect tag generation
      setTimeout(() => {
        setIsAnalyzingCV(false);
        const autoTags: Record<IncidentCategory, string[]> = {
          WATER_SUPPLY: ['water_leakage', 'pipe_rupture', 'standing_fluid'],
          LIGHTS_FAN_PROJECTOR: ['electrical_fixture', 'spark_hazard', 'fan_blade_jammed'],
          WASHROOM_CLEANLINESS: ['surface_stains', 'waste_accumulation', 'odor_risk'],
          FURNITURE_MAINTENANCE: ['broken_timber', 'bracket_shear', 'wobble_hazard'],
        };
        setCvTags(autoTags[selectedCategory] || ['defect_detected']);
        playAudioFeedback('Photo captured and defect detected.');
      }, 1200);
    };
    reader.readAsDataURL(file);
  };

  // Submit Report
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      const result = submitReport({
        locationId: currentSpot.location_id,
        category: selectedCategory,
        userPhotoUrl:
          photoPreview ||
          'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
        voiceTranscript: voiceTranscript || undefined,
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

            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#065F46' }}>
              {submittedResult.isDuplicate ? 'Report Clustered & Escalated!' : 'Issue Successfully Reported!'}
            </h3>
            <p style={{ fontSize: '0.825rem', color: '#047857', marginTop: 4 }}>
              {submittedResult.isDuplicate
                ? `Impact increased! Total ${submittedResult.ticket.duplicate_count} reports on this spot. Severity: ${submittedResult.ticket.ai_severity_score}/100.`
                : 'Directly routed to Facilities Administration. Maintenance team alerted.'}
            </p>

            <button
              onClick={() => {
                setSubmittedResult(null);
                setVoiceTranscript(null);
                setPhotoPreview(null);
                setCvTags([]);
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
                Tap Issue Category / समस्या चुनें
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

          {/* Section 2: Multi-Media Capture (§2) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0F172A' }}>
              Add Evidence (Photo / 5s Voice Note)
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Instant Camera Capture Button */}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handlePhotoCapture}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%',
                    height: 90,
                    borderRadius: 14,
                    border: '2px dashed #0288D1',
                    background: photoPreview ? '#F0F9FF' : 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <Camera size={26} color="#0288D1" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0288D1' }}>
                    {photoPreview ? 'Retake Photo 📸' : 'Snap Photo 📸'}
                  </span>
                </button>
              </div>

              {/* 5-Second Voice Note Button with Waveform Visualizer */}
              <div>
                <button
                  type="button"
                  onClick={startRecording}
                  style={{
                    width: '100%',
                    height: 90,
                    borderRadius: 14,
                    border: isRecording ? '2px solid #EF4444' : '2px dashed #F59E0B',
                    background: isRecording ? '#FEF2F2' : voiceTranscript ? '#FFFBEB' : 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Mic size={26} color={isRecording ? '#EF4444' : '#D97706'} className={isRecording ? 'animate-pulse' : ''} />
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: isRecording ? '#DC2626' : '#B45309',
                    }}
                  >
                    {isRecording ? `Recording... ${5 - voiceSeconds}s` : voiceTranscript ? 'Voice Note Added 🎙️' : 'Voice Note 🎙️'}
                  </span>

                  {/* Waveform indicator while recording */}
                  {isRecording && (
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center', height: 12 }}>
                      <span style={{ width: 3, height: 8, background: '#EF4444', borderRadius: 2 }} className="animate-pulse" />
                      <span style={{ width: 3, height: 14, background: '#EF4444', borderRadius: 2 }} className="animate-pulse" />
                      <span style={{ width: 3, height: 10, background: '#EF4444', borderRadius: 2 }} className="animate-pulse" />
                      <span style={{ width: 3, height: 16, background: '#EF4444', borderRadius: 2 }} className="animate-pulse" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Photo Preview & Computer Vision Defect Tags (§4) */}
            {photoPreview && (
              <div
                style={{
                  background: '#F8FAFC',
                  borderRadius: 12,
                  padding: 10,
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <img
                  src={photoPreview}
                  alt="Capture Preview"
                  style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Sparkles size={14} color="#0288D1" />
                    <span>AI Computer Vision Engine</span>
                  </div>
                  {isAnalyzingCV ? (
                    <div style={{ fontSize: '0.72rem', color: '#0288D1', fontWeight: 600, marginTop: 4 }}>
                      Detecting surface and equipment defects...
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {cvTags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '0.68rem',
                            background: '#E0F2FE',
                            color: '#0369A1',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontWeight: 700,
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Voice Transcript Display */}
            {voiceTranscript && (
              <div
                style={{
                  background: '#FFFBEB',
                  borderRadius: 10,
                  padding: '10px 14px',
                  border: '1px solid #FDE68A',
                  fontSize: '0.8rem',
                  color: '#92400E',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '0.72rem', color: '#B45309', marginBottom: 2 }}>
                  WHISPER TRANSCRIPT (Speech-to-Text):
                </div>
                "{voiceTranscript}"
              </div>
            )}
          </div>

          {/* Instant Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 16,
              border: 'none',
              background: 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
              color: 'white',
              fontSize: '1.05rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 6px 20px rgba(2, 136, 209, 0.4)',
              transition: 'transform 0.1s ease',
            }}
          >
            {isSubmitting ? (
              <span>Submitting to Maintenance...</span>
            ) : (
              <>
                <span>Submit Spot Report / शिकायत दर्ज करें</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
};
