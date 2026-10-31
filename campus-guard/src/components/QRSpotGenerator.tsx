import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  MapPin,
  Download,
  Printer,
  Plus,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
  Building,
  Shield,
  Search,
  Check,
  Globe,
} from 'lucide-react';
import { CampusLocation } from '../types';

interface QRSpotGeneratorProps {
  campusLocations: CampusLocation[];
  onAddLocation: (loc: CampusLocation) => Promise<boolean>;
}

export const QRSpotGenerator: React.FC<QRSpotGeneratorProps> = ({
  campusLocations,
  onAddLocation,
}) => {
  // Mode: FLOOR (1 unique QR per floor - recommended) vs SPOT (1 QR per fixture/room)
  const [qrMode, setQrMode] = useState<'FLOOR' | 'SPOT'>('FLOOR');

  // Form State
  const [buildingOption, setBuildingOption] = useState<string>('Engineering Block A');
  const [customBuilding, setCustomBuilding] = useState<string>('');
  const [floorNumber, setFloorNumber] = useState<number>(1);
  const [roomNumber, setRoomNumber] = useState<string>('LH-101');
  const [zoneCategory, setZoneCategory] =
    useState<CampusLocation['zone_category']>('CLASSROOM');
  const [fixtureId, setFixtureId] = useState<string>('FAN-01');

  // Custom Domain Setting (Persisted)
  const [customDomain, setCustomDomain] = useState<string>(() => {
    return localStorage.getItem('campuspulse_custom_prod_domain') || '';
  });
  const [showDomainEdit, setShowDomainEdit] = useState(false);

  // Target Domain: Auto-detects production origin or defaults to live Vercel URL
  const effectiveDomain = (() => {
    if (customDomain.trim()) return customDomain.trim().replace(/\/$/, '');
    if (
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return window.location.origin;
    }
    return 'https://campus-issue-reporter.vercel.app';
  })().replace(/\/$/, '');

  // Generated QR & Card State
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [selectedSpotForPreview, setSelectedSpotForPreview] = useState<CampusLocation | null>(null);

  // Search & Filter in Registered Spots Directory
  const [searchQuery, setSearchQuery] = useState('');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');

  // Compute final building name
  const effectiveBuilding =
    buildingOption === 'CUSTOM' ? (customBuilding.trim() || 'Academic Building') : buildingOption;

  // Auto-generate standardized Location ID for specific spot
  const generateLocationId = (bld: string, flr: number, rm: string, fix?: string) => {
    const cleanBld = bld.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
    const cleanRm = rm.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
    const cleanFix = fix ? '-' + fix.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase() : '';
    return `QR-${cleanBld}-FL${flr}-${cleanRm}${cleanFix}`;
  };

  // Standardized Floor Station Code & URL
  const cleanBldCode = effectiveBuilding.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
  const floorStationCode = `QR-${cleanBldCode}-FL${floorNumber}`;
  const floorReportUrl = `${effectiveDomain}/floor-report?bld=${encodeURIComponent(
    effectiveBuilding
  )}&flr=${floorNumber}&code=${floorStationCode}`;

  const activeSpot: CampusLocation = selectedSpotForPreview || {
    location_id: generateLocationId(effectiveBuilding, floorNumber, roomNumber, fixtureId),
    building_name: effectiveBuilding,
    floor_number: floorNumber,
    room_number: roomNumber.trim().toUpperCase(),
    zone_category: zoneCategory,
    fixture_id: fixtureId.trim().toUpperCase(),
    gps_latitude: 16.845612,
    gps_longitude: 74.601245,
    x_coord: 200,
    y_coord: 150,
  };

  // Spot reporting URL encoded in the spot sticker
  const spotReportUrl = `${effectiveDomain}/report?loc=${encodeURIComponent(
    activeSpot.location_id
  )}`;

  // Active Target URL based on mode
  const activeTargetUrl = qrMode === 'FLOOR' ? floorReportUrl : spotReportUrl;

  // Direct test URL for local machine
  const localDirectUrl =
    qrMode === 'FLOOR'
      ? `${window.location.origin}/floor-report?bld=${encodeURIComponent(
          effectiveBuilding
        )}&flr=${floorNumber}&code=${floorStationCode}`
      : `${window.location.origin}/report?loc=${encodeURIComponent(activeSpot.location_id)}`;

  // Generate QR Code data URL whenever target URL changes (Production Standard: Pure Black on White, ErrorCorrection M)
  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(activeTargetUrl, {
      width: 480,
      margin: 3,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTargetUrl]);

  // Handle Save to Campus Database
  const handleSaveSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    const success = await onAddLocation(activeSpot);
    setIsSaving(false);

    if (success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    }
  };

  // Download QR Sticker as PNG
  const handleDownloadPNG = () => {
    if (!qrDataUrl) return;

    // Create an offscreen canvas to render the complete branded sticker
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 780;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.roundRect(0, 0, 600, 780, 24);
    ctx.fill();

    // Outer Border
    ctx.strokeStyle = '#0288D1';
    ctx.lineWidth = 12;
    ctx.roundRect(6, 6, 588, 768, 20);
    ctx.stroke();

    // Header Band
    ctx.fillStyle = '#0288D1';
    ctx.fillRect(12, 12, 576, 110);

    // Header Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      qrMode === 'FLOOR' ? 'CampusPulse Floor Station' : 'CampusPulse Spot QR',
      300,
      58
    );

    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = '#E0F2FE';
    ctx.fillText(
      qrMode === 'FLOOR'
        ? 'SCAN WITH CAMERA TO REPORT DEFECTS ON THIS FLOOR'
        : 'SCAN WITH CAMERA TO REPORT FACILITY DEFECT',
      300,
      92
    );

    // QR Image
    const img = new Image();
    const isFloorMode = qrMode === 'FLOOR';
    const floorLabel =
      floorNumber === 0
        ? 'Ground Floor'
        : floorNumber < 0
        ? `Basement ${Math.abs(floorNumber)}`
        : `Floor ${floorNumber}`;

    img.onload = () => {
      ctx.drawImage(img, 110, 140, 380, 380);

      // Location Info Box
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.roundRect(30, 540, 540, 160, 16);
      ctx.fill();
      ctx.stroke();

      // Info Texts
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(effectiveBuilding, 300, 580);

      ctx.fillStyle = '#475569';
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillText(
        isFloorMode
          ? `Station: ${floorLabel} (All Rooms)`
          : `Floor ${activeSpot.floor_number} • Room: ${activeSpot.room_number}`,
        300,
        615
      );

      ctx.fillStyle = '#0288D1';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(
        isFloorMode
          ? '📱 Reporter specifies Room Number on screen'
          : `ZONE: ${activeSpot.zone_category} ${activeSpot.fixture_id ? `• FIXTURE: ${activeSpot.fixture_id}` : ''}`,
        300,
        650
      );

      ctx.fillStyle = '#64748B';
      ctx.font = '14px monospace';
      ctx.fillText(`Code: ${isFloorMode ? floorStationCode : activeSpot.location_id}`, 300, 680);

      // Footer
      ctx.fillStyle = '#0288D1';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText('Zero-Login • Gemini AI Genuineness Verification • Quick Dispatch', 300, 740);

      // Trigger download
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = isFloorMode
        ? `CampusPulse-FloorStation-${floorStationCode}.png`
        : `CampusPulse-Sticker-${activeSpot.location_id}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };
    img.src = qrDataUrl;
  };

  // Print Sticker Placard
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=700,height=900');
    if (!printWindow) return;

    const isFloorMode = qrMode === 'FLOOR';
    const floorLabel =
      floorNumber === 0
        ? 'Ground Floor'
        : floorNumber < 0
        ? `Basement ${Math.abs(floorNumber)}`
        : `Floor ${floorNumber}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print CampusPulse ${isFloorMode ? 'Floor Station QR' : 'Spot QR'} - ${
            isFloorMode ? floorStationCode : activeSpot.location_id
          }</title>
          <style>
            @page {
              size: 4in 6in;
              margin: 0.2in;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              margin: 0;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background: white;
            }
            .card {
              width: 100%;
              max-width: 380px;
              border: 4px solid #0288D1;
              border-radius: 16px;
              overflow: hidden;
              text-align: center;
              background: white;
              box-sizing: border-box;
            }
            .header {
              background: #0288D1;
              color: white;
              padding: 16px 12px;
            }
            .header h1 {
              margin: 0;
              font-size: 21px;
              font-weight: 900;
              letter-spacing: -0.02em;
            }
            .header p {
              margin: 4px 0 0;
              font-size: 11px;
              font-weight: 700;
              color: #E0F2FE;
              text-transform: uppercase;
            }
            .qr-wrap {
              padding: 20px 10px;
            }
            .qr-wrap img {
              width: 240px;
              height: 240px;
              display: block;
              margin: 0 auto;
            }
            .info-box {
              background: #F8FAFC;
              border-top: 2px dashed #CBD5E1;
              padding: 16px 12px;
            }
            .bld {
              font-size: 18px;
              font-weight: 900;
              color: #0F172A;
              margin-bottom: 4px;
            }
            .meta {
              font-size: 13px;
              font-weight: 700;
              color: #475569;
              margin-bottom: 6px;
            }
            .code {
              font-family: monospace;
              font-size: 11px;
              background: #E0F2FE;
              color: #0369A1;
              padding: 3px 8px;
              border-radius: 4px;
              display: inline-block;
              font-weight: 800;
            }
            .footer {
              padding: 10px;
              font-size: 10px;
              font-weight: 800;
              color: #0288D1;
              border-top: 1px solid #E2E8F0;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>${isFloorMode ? 'CampusPulse Floor Station' : 'CampusPulse Spot QR'}</h1>
              <p>${
                isFloorMode
                  ? 'Scan to report any defect on this floor'
                  : 'Scan to report water, electric, or hygiene defects'
              }</p>
            </div>
            <div class="qr-wrap">
              <img src="${qrDataUrl}" alt="QR Code" />
            </div>
            <div class="info-box">
              <div class="bld">${effectiveBuilding}</div>
              <div class="meta">${
                isFloorMode
                  ? `Station: ${floorLabel} (All Rooms on Floor)`
                  : `Floor ${activeSpot.floor_number} • Room ${activeSpot.room_number} (${activeSpot.zone_category})`
              }</div>
              ${
                !isFloorMode && activeSpot.fixture_id
                  ? `<div class="meta" style="color:#0288D1">Fixture: ${activeSpot.fixture_id}</div>`
                  : ''
              }
              ${
                isFloorMode
                  ? `<div style="font-size:12px;color:#0288D1;font-weight:700;margin-bottom:6px;">Reporter enters room number on phone screen</div>`
                  : ''
              }
              <div class="code">${isFloorMode ? floorStationCode : activeSpot.location_id}</div>
            </div>
            <div class="footer">
              Zero-Login • Gemini AI Genuineness Verification • Quick Dispatch
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filtered Directory spots
  const filteredSpots = campusLocations.filter((spot) => {
    if (floorFilter !== 'ALL' && spot.floor_number !== Number(floorFilter)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        spot.building_name.toLowerCase().includes(q) ||
        spot.room_number.toLowerCase().includes(q) ||
        spot.location_id.toLowerCase().includes(q) ||
        spot.zone_category.toLowerCase().includes(q) ||
        (spot.fixture_id && spot.fixture_id.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Dynamically extract all known buildings from registered locations
  const knownBuildings = Array.from(
    new Set([
      'Engineering Block A',
      'Science Block B',
      'Academic Complex C',
      'Central Library',
      ...campusLocations.map((l) => l.building_name),
    ])
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* SECTION 1: QR CODE GENERATOR STUDIO */}
      <div
        style={{
          background: 'white',
          borderRadius: 20,
          border: '1px solid #E2E8F0',
          padding: 24,
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#0288D1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                <QrCode size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.2 }}>
                  Campus Spot & Floor QR Generator Studio
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>
                  Create printable QR stickers for Buildings, Floors, Rooms, or Fixtures
                </p>
              </div>
            </div>

            {/* Target Production Domain Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: 10,
                padding: '6px 12px',
                fontSize: '0.74rem',
                color: '#166534',
                fontWeight: 700,
              }}
            >
              <Globe size={14} color="#16A34A" />
              <span>Production Target: <b>{effectiveDomain}</b></span>
              <button
                type="button"
                onClick={() => setShowDomainEdit(!showDomainEdit)}
                style={{
                  background: 'white',
                  border: '1px solid #CBD5E1',
                  borderRadius: 6,
                  padding: '2px 6px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer',
                  marginLeft: 4,
                }}
              >
                {showDomainEdit ? 'Close' : 'Edit Domain'}
              </button>
            </div>
          </div>

          {/* Optional Domain Customizer */}
          {showDomainEdit && (
            <div
              style={{
                marginTop: 12,
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155' }}>Custom Domain:</span>
              <input
                type="url"
                placeholder="https://campus-issue-reporter.vercel.app"
                value={customDomain}
                onChange={(e) => {
                  setCustomDomain(e.target.value);
                  localStorage.setItem('campuspulse_custom_prod_domain', e.target.value);
                }}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  fontSize: '0.78rem',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setCustomDomain('');
                  localStorage.removeItem('campuspulse_custom_prod_domain');
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  background: 'white',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reset Default
              </button>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={() => {
                setQrMode('FLOOR');
                setSelectedSpotForPreview(null);
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: qrMode === 'FLOOR' ? '2px solid #0288D1' : '1.5px solid #E2E8F0',
                background: qrMode === 'FLOOR' ? '#F0F9FF' : '#F8FAFC',
                color: qrMode === 'FLOOR' ? '#0288D1' : '#64748B',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: qrMode === 'FLOOR' ? '0 2px 8px rgba(2, 136, 209, 0.2)' : 'none',
              }}
            >
              <Building size={18} />
              <span>🏢 Unique Floor Station QR (1 per Floor)</span>
            </button>

            <button
              type="button"
              onClick={() => setQrMode('SPOT')}
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: qrMode === 'SPOT' ? '2px solid #0288D1' : '1.5px solid #E2E8F0',
                background: qrMode === 'SPOT' ? '#F0F9FF' : '#F8FAFC',
                color: qrMode === 'SPOT' ? '#0288D1' : '#64748B',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: qrMode === 'SPOT' ? '0 2px 8px rgba(2, 136, 209, 0.2)' : 'none',
              }}
            >
              <MapPin size={18} />
              <span>🎯 Specific Spot QR (1 per Fixture/Room)</span>
            </button>
          </div>
        </div>

        {/* 2-Column Grid: Form (Left) vs Live High-Res Card Preview (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24, alignItems: 'start' }}>
          {/* Left: Input Parameters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Building Selection */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: 6 }}>
                1. Campus Building Name
              </label>
              <select
                value={buildingOption}
                onChange={(e) => {
                  setBuildingOption(e.target.value);
                  setSelectedSpotForPreview(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  background: 'white',
                }}
              >
                {knownBuildings.map((bName) => (
                  <option key={bName} value={bName}>
                    {bName}
                  </option>
                ))}
                <option value="CUSTOM">+ Add Custom Building Name...</option>
              </select>

              {buildingOption === 'CUSTOM' && (
                <input
                  type="text"
                  placeholder="e.g. Mechanical Workshop or Sports Pavilion"
                  value={customBuilding}
                  onChange={(e) => {
                    setCustomBuilding(e.target.value);
                    setSelectedSpotForPreview(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1.5px solid #0288D1',
                    fontSize: '0.88rem',
                    marginTop: 8,
                    boxSizing: 'border-box',
                  }}
                  required
                />
              )}
            </div>

            {/* Floor Number Selection */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: 6 }}>
                2. Floor Number
              </label>
              <select
                value={floorNumber}
                onChange={(e) => {
                  setFloorNumber(Number(e.target.value));
                  setSelectedSpotForPreview(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  background: 'white',
                }}
              >
                <option value={-1}>Basement (-1)</option>
                <option value={0}>Ground Floor (0)</option>
                <option value={1}>Floor 1</option>
                <option value={2}>Floor 2</option>
                <option value={3}>Floor 3</option>
                <option value={4}>Floor 4</option>
                <option value={5}>Floor 5</option>
              </select>
            </div>

            {/* Mode-Specific Form Fields */}
            {qrMode === 'FLOOR' ? (
              /* FLOOR STATION DETAILS */
              <div
                style={{
                  background: '#F0F9FF',
                  border: '1.5px solid #BAE6FD',
                  borderRadius: 14,
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0369A1', fontWeight: 800, fontSize: '0.84rem', marginBottom: 6 }}>
                  <Building size={16} />
                  <span>Unique Floor Station Specification</span>
                </div>
                <p style={{ fontSize: '0.76rem', color: '#0C4A6E', margin: '0 0 10px', lineHeight: 1.4 }}>
                  Every floor has a unique placard (<b>{floorStationCode}</b>). When students or faculty scan this placard,
                  they are taken directly to the <b>Floor Reporting Page</b> where they enter their room number, snap a defect photo,
                  and Gemini AI verifies defect genuineness before submission.
                </p>

                <div style={{ background: 'white', borderRadius: 10, padding: '10px 12px', border: '1px solid #BAE6FD' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700 }}>STATION PLACARD ID:</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.92rem', fontWeight: 900, color: '#0288D1', marginTop: 2 }}>
                    {floorStationCode}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 4 }}>
                    Station Scope: <b>{effectiveBuilding}</b> • <b>{floorNumber === 0 ? 'Ground Floor' : `Floor ${floorNumber}`}</b>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={handleDownloadPNG}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 10,
                      background: '#0288D1',
                      color: 'white',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Download size={14} />
                    <span>Download Floor PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 10,
                      background: 'white',
                      color: '#0F172A',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Printer size={14} color="#0288D1" />
                    <span>Print Floor Placard</span>
                  </button>
                </div>
              </div>
            ) : (
              /* SPOT-SPECIFIC FORM */
              <form onSubmit={handleSaveSpot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: 6 }}>
                      3. Room / Hall / Area
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. LH-201, WASH-02, LAB-3"
                      value={roomNumber}
                      onChange={(e) => {
                        setRoomNumber(e.target.value);
                        setSelectedSpotForPreview(null);
                      }}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1.5px solid #CBD5E1',
                        fontSize: '0.88rem',
                        boxSizing: 'border-box',
                        fontWeight: 700,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: 6 }}>
                      4. Zone Category
                    </label>
                    <select
                      value={zoneCategory}
                      onChange={(e) => {
                        setZoneCategory(e.target.value as CampusLocation['zone_category']);
                        setSelectedSpotForPreview(null);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1.5px solid #CBD5E1',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        background: 'white',
                      }}
                    >
                      <option value="WASHROOM">Washroom / Restroom</option>
                      <option value="CLASSROOM">Classroom / Lecture Hall</option>
                      <option value="CORRIDOR">Corridor / Common Passage</option>
                      <option value="FACULTY_ROOM">Faculty Office / Staff Room</option>
                      <option value="LABORATORY">Practical Science Lab</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: 6 }}>
                    5. Specific Fixture ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FAN-04, TAP-01, COOLER-02"
                    value={fixtureId}
                    onChange={(e) => {
                      setFixtureId(e.target.value);
                      setSelectedSpotForPreview(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box',
                      fontWeight: 600,
                    }}
                  />
                </div>

                {/* Computed Location ID Display */}
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                    Unique Spot Identifier:
                  </div>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.92rem',
                      fontWeight: 900,
                      color: '#0288D1',
                      marginTop: 4,
                      wordBreak: 'break-all',
                    }}
                  >
                    {activeSpot.location_id}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: 'none',
                    background: savedSuccess ? '#10B981' : '#0288D1',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 12px rgba(2, 136, 209, 0.3)',
                  }}
                >
                  {savedSuccess ? (
                    <>
                      <Check size={18} strokeWidth={3} />
                      <span>Saved to Supabase & Active!</span>
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      <span>{isSaving ? 'Registering Spot...' : 'Save & Register Spot'}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Right: Printable Sticker Card Live Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            {/* Physical Sticker Placard Card */}
            <div
              style={{
                width: '100%',
                maxWidth: 320,
                background: 'white',
                borderRadius: 20,
                border: '3.5px solid #0288D1',
                boxShadow: '0 12px 30px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                textAlign: 'center',
              }}
            >
              {/* Header Band */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
                  color: 'white',
                  padding: '14px 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Shield size={20} />
                  <span style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                    CampusPulse
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: '#E0F2FE',
                    marginTop: 3,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {qrMode === 'FLOOR' ? 'Floor Reporting Station' : 'Facility Quick Report Spot'}
                </div>
              </div>

              {/* QR Image Box */}
              <div style={{ padding: '16px 12px 10px' }}>
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Campus QR Code"
                    style={{
                      width: 200,
                      height: 200,
                      margin: '0 auto',
                      display: 'block',
                      borderRadius: 8,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 200,
                      height: 200,
                      background: '#F1F5F9',
                      borderRadius: 8,
                      margin: '0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8',
                    }}
                  >
                    Generating QR...
                  </div>
                )}

                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: '#0288D1',
                    marginTop: 6,
                  }}
                >
                  📱 SCAN WITH ANY PHONE CAMERA
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748B' }}>
                  No app download • No login required
                </div>
              </div>

              {/* Location Details Box */}
              <div
                style={{
                  background: '#F8FAFC',
                  borderTop: '1.5px dashed #CBD5E1',
                  padding: '12px 14px',
                }}
              >
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.2 }}>
                  {effectiveBuilding}
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginTop: 3 }}>
                  {qrMode === 'FLOOR'
                    ? `Station: ${floorNumber === 0 ? 'Ground Floor' : `Floor ${floorNumber}`} (All Rooms)`
                    : `Floor ${activeSpot.floor_number} • Room: ${activeSpot.room_number}`}
                </div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: '#0369A1',
                    fontWeight: 800,
                    marginTop: 3,
                    textTransform: 'uppercase',
                  }}
                >
                  {qrMode === 'FLOOR'
                    ? '📱 Reporter specifies room on mobile screen'
                    : `${activeSpot.zone_category} ${activeSpot.fixture_id ? `• ${activeSpot.fixture_id}` : ''}`}
                </div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.65rem',
                    background: '#E0F2FE',
                    color: '#0369A1',
                    padding: '2px 8px',
                    borderRadius: 4,
                    display: 'inline-block',
                    marginTop: 6,
                    fontWeight: 700,
                  }}
                >
                  {qrMode === 'FLOOR' ? floorStationCode : activeSpot.location_id}
                </div>
              </div>

              {/* Placard Footer */}
              <div
                style={{
                  background: '#F1F5F9',
                  padding: '8px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: '#64748B',
                  borderTop: '1px solid #E2E8F0',
                }}
              >
                Gemini AI Genuineness Verification • Facilities Administration
              </div>
            </div>

            {/* Encoded Destination Indicator */}
            <div
              style={{
                width: '100%',
                maxWidth: 320,
                background: '#F1F5F9',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: '0.7rem',
                color: '#475569',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 5 }}>
                <QrCode size={13} color="#0288D1" />
                <span>Encoded Destination:</span>
              </div>
              <span
                style={{
                  fontFamily: 'monospace',
                  color: '#0288D1',
                  wordBreak: 'break-all',
                  fontSize: '0.68rem',
                }}
              >
                {activeTargetUrl}
              </span>
            </div>

            {/* Direct Open in Browser Action */}
            <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <a
                href={localDirectUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1.5px solid #0288D1',
                  background: '#0288D1',
                  color: 'white',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 8px rgba(2, 136, 209, 0.3)',
                }}
              >
                <ExternalLink size={15} />
                <span>{qrMode === 'FLOOR' ? 'Open & Test Floor Reporter' : 'Open & Test Spot Reporter'}</span>
              </a>

              {activeTargetUrl !== localDirectUrl && (
                <a
                  href={activeTargetUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    background: '#F8FAFC',
                    color: '#64748B',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxSizing: 'border-box',
                  }}
                >
                  <Globe size={13} />
                  <span>Open Encoded Production URL</span>
                </a>
              )}
            </div>

            {/* Sticker Output Actions */}
            <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 320 }}>
              <button
                type="button"
                onClick={handleDownloadPNG}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  background: '#0288D1',
                  color: 'white',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Download size={14} />
                <span>Download PNG</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: '1.5px solid #CBD5E1',
                  background: 'white',
                  color: '#0F172A',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Printer size={14} color="#0288D1" />
                <span>Print Placard</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: REGISTERED CAMPUS SPOTS DIRECTORY */}
      <div
        style={{
          background: 'white',
          borderRadius: 20,
          border: '1px solid #E2E8F0',
          padding: 24,
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building size={20} color="#0288D1" />
              <span>Campus Spots Directory ({campusLocations.length} Registered Spots)</span>
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
              All campus QR locations registered in Supabase. Click any spot to preview, reprint, or download sticker.
            </p>
          </div>

          {/* Search & Floor Filter */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 10, top: 10 }} />
              <input
                type="text"
                placeholder="Search building, room, id..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '7px 12px 7px 30px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8rem',
                  width: 200,
                }}
              />
            </div>

            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              style={{
                padding: '7px 10px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: '0.8rem',
                background: 'white',
                fontWeight: 600,
              }}
            >
              <option value="ALL">All Floors</option>
              <option value="0">Ground Floor (0)</option>
              <option value="1">Floor 1</option>
              <option value="2">Floor 2</option>
              <option value="3">Floor 3</option>
              <option value="4">Floor 4</option>
            </select>
          </div>
        </div>

        {/* Spots Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                <th style={{ padding: '10px 14px', fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>SPOT ID</th>
                <th style={{ padding: '10px 14px', fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>BUILDING</th>
                <th style={{ padding: '10px 14px', fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>FLOOR & ROOM</th>
                <th style={{ padding: '10px 14px', fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>ZONE / FIXTURE</th>
                <th style={{ padding: '10px 14px', fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredSpots.map((spot) => (
                <tr
                  key={spot.location_id}
                  style={{
                    borderBottom: '1px solid #F1F5F9',
                    background:
                      activeSpot.location_id === spot.location_id ? '#F0F9FF' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 800, color: '#0369A1' }}>
                    {spot.location_id}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>
                    {spot.building_name}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#475569' }}>
                    Floor {spot.floor_number} • {spot.room_number}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: '#E2E8F0',
                        color: '#334155',
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {spot.zone_category}
                    </span>
                    {spot.fixture_id && (
                      <span style={{ fontSize: '0.72rem', color: '#64748B', marginLeft: 6 }}>
                        ({spot.fixture_id})
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedSpotForPreview(spot)}
                        style={{
                          background: '#F1F5F9',
                          border: '1px solid #CBD5E1',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          color: '#334155',
                        }}
                      >
                        Preview Sticker
                      </button>

                      <a
                        href={`/report?loc=${encodeURIComponent(spot.location_id)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: '#E0F2FE',
                          border: '1px solid #BAE6FD',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                          color: '#0288D1',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <span>Test URL</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
