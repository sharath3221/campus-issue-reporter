import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Building,
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Download,
  Printer,
  Sparkles,
  Search,
  Check,
  X,
  Compass,
  MapPin,
  Flame,
  ArrowRight,
  Shield,
  Eye,
  Sliders,
  Maximize2,
  LayoutGrid,
} from 'lucide-react';
import { CampusLocation, CampusBuildingConfig, IncidentTicket } from '../types';
import { CampusFloorCanvas } from './CampusFloorCanvas';

interface AdminArchitectureManagerProps {
  campusLocations: CampusLocation[];
  tickets: IncidentTicket[];
  onAddLocation: (loc: CampusLocation) => Promise<boolean>;
  onAddLocations: (locs: CampusLocation[]) => Promise<boolean>;
  onDeleteLocation: (locationId: string) => Promise<boolean>;
  onDeleteBuildingLocations: (buildingName: string) => Promise<boolean>;
  onDeleteFloorLocations: (buildingName: string, floorNumber: number) => Promise<boolean>;
  onUpdateLocationCoords: (locationId: string, x: number, y: number) => Promise<boolean>;
}

const DEFAULT_BUILDINGS: CampusBuildingConfig[] = [
  { building_id: 'bld-eng-a', building_name: 'Engineering Block A', building_code: 'ENG-A', floors_count: 3 },
  { building_id: 'bld-sci-b', building_name: 'Science Block B', building_code: 'SCI-B', floors_count: 3 },
  { building_id: 'bld-acad-c', building_name: 'Academic Complex C', building_code: 'ACAD-C', floors_count: 4 },
  { building_id: 'bld-lib', building_name: 'Central Library', building_code: 'LIB', floors_count: 2 },
  { building_id: 'bld-hostel-1', building_name: 'Hostel Block 1', building_code: 'HOSTEL-1', floors_count: 4 },
  { building_id: 'bld-admin', building_name: 'Administrative Center', building_code: 'ADMIN', floors_count: 2 },
];

const ZONE_CONFIG: Record<
  CampusLocation['zone_category'],
  { label: string; icon: string; color: string; bg: string }
> = {
  CLASSROOM: { label: 'Classroom / Lecture Hall', icon: '🎓', color: '#0288D1', bg: '#E0F2FE' },
  WASHROOM: { label: 'Washroom / Restroom', icon: '🚰', color: '#059669', bg: '#D1FAE5' },
  LABORATORY: { label: 'Practical Science/Tech Lab', icon: '🔬', color: '#7C3AED', bg: '#EDE9FE' },
  CORRIDOR: { label: 'Corridor & Common Area', icon: '🚪', color: '#D97706', bg: '#FEF3C7' },
  FACULTY_ROOM: { label: 'Faculty / Department Office', icon: '💼', color: '#4F46E5', bg: '#EEF2FF' },
};

const BUILDINGS_STORAGE_KEY = 'campuspulse_building_configs_v1';

export const AdminArchitectureManager: React.FC<AdminArchitectureManagerProps> = ({
  campusLocations,
  tickets,
  onAddLocation,
  onAddLocations,
  onDeleteLocation,
  onDeleteBuildingLocations,
  onDeleteFloorLocations,
  onUpdateLocationCoords,
}) => {
  // View mode: Interactive Canvas (default) vs Grid List
  const [viewMode, setViewMode] = useState<'CANVAS' | 'LIST'>('CANVAS');
  // Buildings State
  const [buildings, setBuildings] = useState<CampusBuildingConfig[]>(() => {
    try {
      const saved = localStorage.getItem(BUILDINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_BUILDINGS;
  });

  // Sync buildings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(BUILDINGS_STORAGE_KEY, JSON.stringify(buildings));
    } catch (e) {
      console.error(e);
    }
  }, [buildings]);

  // Active Building & Floor Selection
  const [selectedBuildingName, setSelectedBuildingName] = useState<string>(() => {
    return buildings[0]?.building_name || 'Engineering Block A';
  });
  const [selectedFloorNumber, setSelectedFloorNumber] = useState<number>(1);

  // Modals state
  const [showAddBuildingModal, setShowAddBuildingModal] = useState(false);
  const [showAddFloorModal, setShowAddFloorModal] = useState(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [previewStickerLoc, setPreviewStickerLoc] = useState<CampusLocation | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Add Building Form
  const [newBldName, setNewBldName] = useState('');
  const [newBldCode, setNewBldCode] = useState('');
  const [newBldFloorsCount, setNewBldFloorsCount] = useState<number>(3);
  const [newBldIncludeGround, setNewBldIncludeGround] = useState(true);
  const [newBldTemplate, setNewBldTemplate] = useState<
    'EMPTY' | 'ACADEMIC' | 'LABS' | 'HOSTEL'
  >('ACADEMIC');
  const [isSubmittingBuilding, setIsSubmittingBuilding] = useState(false);

  // Add Floor Form
  const [newFloorNum, setNewFloorNum] = useState<number>(1);

  // Add Room Form
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomZone, setNewRoomZone] = useState<CampusLocation['zone_category']>('CLASSROOM');
  const [newRoomFixture, setNewRoomFixture] = useState('');
  const [isSubmittingRoom, setIsSubmittingRoom] = useState(false);

  // Batch Wizard Form
  const [batchPrefix, setBatchPrefix] = useState('LH-');
  const [batchStart, setBatchStart] = useState<number>(101);
  const [batchEnd, setBatchEnd] = useState<number>(106);
  const [batchZone, setBatchZone] = useState<CampusLocation['zone_category']>('CLASSROOM');
  const [batchIncludeWashrooms, setBatchIncludeWashrooms] = useState(true);
  const [batchIncludeCooler, setBatchIncludeCooler] = useState(true);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  // Search in Rooms
  const [roomSearch, setRoomSearch] = useState('');

  // Merge any dynamically discovered buildings from campusLocations
  const allBuildingNames = Array.from(
    new Set([
      ...buildings.map((b) => b.building_name),
      ...campusLocations.map((l) => l.building_name),
    ])
  );

  const activeBuilding =
    buildings.find((b) => b.building_name === selectedBuildingName) || {
      building_id: `bld-${selectedBuildingName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      building_name: selectedBuildingName,
      building_code: selectedBuildingName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase(),
      floors_count: 3,
    };

  // Get all floors present for the active building
  const locationsInBuilding = campusLocations.filter(
    (l) => l.building_name === selectedBuildingName
  );

  const discoveredFloors = Array.from(
    new Set(locationsInBuilding.map((l) => l.floor_number))
  ).sort((a, b) => a - b);

  // If no locations exist yet on building, show 1..floors_count
  const availableFloors =
    discoveredFloors.length > 0
      ? discoveredFloors
      : Array.from({ length: activeBuilding.floors_count }, (_, i) => i + 1);

  // If selected floor is not in available floors, snap to first available
  useEffect(() => {
    if (availableFloors.length > 0 && !availableFloors.includes(selectedFloorNumber)) {
      setSelectedFloorNumber(availableFloors[0]);
    }
  }, [availableFloors, selectedFloorNumber]);

  // Rooms on current floor
  const roomsOnFloor = locationsInBuilding.filter(
    (l) => l.floor_number === selectedFloorNumber
  );

  const filteredRooms = roomsOnFloor.filter((r) => {
    if (!roomSearch.trim()) return true;
    const q = roomSearch.toLowerCase();
    return (
      r.room_number.toLowerCase().includes(q) ||
      r.location_id.toLowerCase().includes(q) ||
      r.zone_category.toLowerCase().includes(q) ||
      (r.fixture_id && r.fixture_id.toLowerCase().includes(q))
    );
  });

  // Effective production origin for QR codes
  const effectiveOrigin = (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
      ? window.location.origin
      : 'https://campus-issue-reporter.vercel.app'
  ).replace(/\/$/, '');

  // Generate QR for Preview Modal
  useEffect(() => {
    if (!previewStickerLoc) return;
    const targetUrl = `${effectiveOrigin}/report?loc=${encodeURIComponent(
      previewStickerLoc.location_id
    )}`;
    QRCode.toDataURL(targetUrl, {
      width: 480,
      margin: 3,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [previewStickerLoc, effectiveOrigin]);

  // -------------------------------------------------------------
  // ACTIONS: ADD BUILDING WITH TEMPLATE
  // -------------------------------------------------------------
  const handleAddBuildingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBldName.trim()) return;

    setIsSubmittingBuilding(true);
    const bldName = newBldName.trim();
    const bldCode = (newBldCode.trim() || bldName.slice(0, 5)).toUpperCase();
    const totalFloors = Math.max(1, newBldFloorsCount);

    const newBuildingConfig: CampusBuildingConfig = {
      building_id: `bld-${Date.now().toString().slice(-6)}`,
      building_name: bldName,
      building_code: bldCode,
      floors_count: totalFloors,
    };

    setBuildings((prev) => [...prev, newBuildingConfig]);

    // Template Generation
    const starterRooms: CampusLocation[] = [];
    const floorList: number[] = [];
    if (newBldIncludeGround) floorList.push(0);
    for (let f = 1; f <= totalFloors; f++) floorList.push(f);

    if (newBldTemplate === 'ACADEMIC') {
      floorList.forEach((flr) => {
        const prefix = flr === 0 ? 'G' : `${flr}`;
        // 4 classrooms
        for (let i = 1; i <= 4; i++) {
          const rmNum = `LH-${prefix}0${i}`;
          starterRooms.push({
            location_id: `QR-${bldCode}-FL${flr}-${rmNum}`,
            building_name: bldName,
            floor_number: flr,
            room_number: rmNum,
            zone_category: 'CLASSROOM',
            gps_latitude: 16.8456,
            gps_longitude: 74.6012,
            fixture_id: `FAN-0${i}`,
            x_coord: 150 + i * 90,
            y_coord: 120,
          });
        }
        // 1 Washroom
        starterRooms.push({
          location_id: `QR-${bldCode}-FL${flr}-WASH-01`,
          building_name: bldName,
          floor_number: flr,
          room_number: `WASH-${prefix}01`,
          zone_category: 'WASHROOM',
          gps_latitude: 16.8456,
          gps_longitude: 74.6012,
          fixture_id: 'TAP-MAIN',
          x_coord: 100,
          y_coord: 250,
        });
        // 1 Lab
        starterRooms.push({
          location_id: `QR-${bldCode}-FL${flr}-LAB-01`,
          building_name: bldName,
          floor_number: flr,
          room_number: `LAB-${prefix}01`,
          zone_category: 'LABORATORY',
          gps_latitude: 16.8456,
          gps_longitude: 74.6012,
          fixture_id: 'WORKBENCH-01',
          x_coord: 580,
          y_coord: 140,
        });
      });
    } else if (newBldTemplate === 'LABS') {
      floorList.forEach((flr) => {
        const prefix = flr === 0 ? 'G' : `${flr}`;
        for (let i = 1; i <= 3; i++) {
          starterRooms.push({
            location_id: `QR-${bldCode}-FL${flr}-LAB-0${i}`,
            building_name: bldName,
            floor_number: flr,
            room_number: `LAB-${prefix}0${i}`,
            zone_category: 'LABORATORY',
            gps_latitude: 16.8456,
            gps_longitude: 74.6012,
            fixture_id: `BENCH-0${i}`,
            x_coord: 200 + i * 110,
            y_coord: 130,
          });
        }
        starterRooms.push({
          location_id: `QR-${bldCode}-FL${flr}-WASH-01`,
          building_name: bldName,
          floor_number: flr,
          room_number: `WASH-${prefix}01`,
          zone_category: 'WASHROOM',
          gps_latitude: 16.8456,
          gps_longitude: 74.6012,
          fixture_id: 'DRAIN-01',
          x_coord: 100,
          y_coord: 240,
        });
      });
    } else if (newBldTemplate === 'HOSTEL') {
      floorList.forEach((flr) => {
        const prefix = flr === 0 ? 'G' : `${flr}`;
        for (let i = 1; i <= 6; i++) {
          starterRooms.push({
            location_id: `QR-${bldCode}-FL${flr}-ROOM-0${i}`,
            building_name: bldName,
            floor_number: flr,
            room_number: `RM-${prefix}0${i}`,
            zone_category: 'CLASSROOM',
            gps_latitude: 16.8456,
            gps_longitude: 74.6012,
            fixture_id: `BED-0${i}`,
            x_coord: 120 + i * 80,
            y_coord: 120,
          });
        }
        starterRooms.push({
          location_id: `QR-${bldCode}-FL${flr}-WASH-01`,
          building_name: bldName,
          floor_number: flr,
          room_number: `WASH-${prefix}01`,
          zone_category: 'WASHROOM',
          gps_latitude: 16.8456,
          gps_longitude: 74.6012,
          fixture_id: 'SHOWER-01',
          x_coord: 600,
          y_coord: 220,
        });
      });
    }

    if (starterRooms.length > 0) {
      await onAddLocations(starterRooms);
    }

    setSelectedBuildingName(bldName);
    setSelectedFloorNumber(floorList[0] || 1);
    setNewBldName('');
    setNewBldCode('');
    setIsSubmittingBuilding(false);
    setShowAddBuildingModal(false);
  };

  // -------------------------------------------------------------
  // ACTIONS: ADD FLOOR
  // -------------------------------------------------------------
  const handleAddFloorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedFloorNumber(newFloorNum);
    // Update building floors_count if higher
    setBuildings((prev) =>
      prev.map((b) =>
        b.building_name === selectedBuildingName
          ? { ...b, floors_count: Math.max(b.floors_count, newFloorNum) }
          : b
      )
    );
    setShowAddFloorModal(false);
  };

  // -------------------------------------------------------------
  // ACTIONS: ADD SINGLE ROOM
  // -------------------------------------------------------------
  const handleAddRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber.trim()) return;

    setIsSubmittingRoom(true);
    const cleanRoom = newRoomNumber.trim().toUpperCase();
    const cleanBldCode = activeBuilding.building_code || 'BLD';
    const locId = `QR-${cleanBldCode}-FL${selectedFloorNumber}-${cleanRoom.replace(/[^A-Z0-9]/g, '-')}`;

    const newLoc: CampusLocation = {
      location_id: locId,
      building_name: selectedBuildingName,
      floor_number: selectedFloorNumber,
      room_number: cleanRoom,
      zone_category: newRoomZone,
      gps_latitude: 16.8456,
      gps_longitude: 74.6012,
      fixture_id: newRoomFixture.trim().toUpperCase() || undefined,
      x_coord: 250 + Math.floor(Math.random() * 200),
      y_coord: 150 + Math.floor(Math.random() * 100),
    };

    await onAddLocation(newLoc);
    setNewRoomNumber('');
    setNewRoomFixture('');
    setIsSubmittingRoom(false);
    setShowAddRoomModal(false);
  };

  // -------------------------------------------------------------
  // ACTIONS: BATCH ROOM GENERATOR
  // -------------------------------------------------------------
  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchStart > batchEnd) return;

    setIsSubmittingBatch(true);
    const generated: CampusLocation[] = [];
    const cleanBldCode = activeBuilding.building_code || 'BLD';

    for (let num = batchStart; num <= batchEnd; num++) {
      const roomNum = `${batchPrefix}${num}`;
      generated.push({
        location_id: `QR-${cleanBldCode}-FL${selectedFloorNumber}-${roomNum.replace(/[^A-Z0-9]/g, '-')}`,
        building_name: selectedBuildingName,
        floor_number: selectedFloorNumber,
        room_number: roomNum,
        zone_category: batchZone,
        gps_latitude: 16.8456,
        gps_longitude: 74.6012,
        fixture_id: `FIXTURE-${num}`,
        x_coord: 120 + ((num - batchStart) % 5) * 110,
        y_coord: 100 + Math.floor((num - batchStart) / 5) * 120,
      });
    }

    if (batchIncludeWashrooms) {
      generated.push({
        location_id: `QR-${cleanBldCode}-FL${selectedFloorNumber}-WASH-MALE`,
        building_name: selectedBuildingName,
        floor_number: selectedFloorNumber,
        room_number: `WASH-${selectedFloorNumber}01-M`,
        zone_category: 'WASHROOM',
        gps_latitude: 16.8456,
        gps_longitude: 74.6012,
        fixture_id: 'WASH-MALE',
        x_coord: 640,
        y_coord: 120,
      });
      generated.push({
        location_id: `QR-${cleanBldCode}-FL${selectedFloorNumber}-WASH-FEMALE`,
        building_name: selectedBuildingName,
        floor_number: selectedFloorNumber,
        room_number: `WASH-${selectedFloorNumber}02-F`,
        zone_category: 'WASHROOM',
        gps_latitude: 16.8456,
        gps_longitude: 74.6012,
        fixture_id: 'WASH-FEMALE',
        x_coord: 640,
        y_coord: 220,
      });
    }

    if (batchIncludeCooler) {
      generated.push({
        location_id: `QR-${cleanBldCode}-FL${selectedFloorNumber}-COOLER-01`,
        building_name: selectedBuildingName,
        floor_number: selectedFloorNumber,
        room_number: `COOLER-FL${selectedFloorNumber}`,
        zone_category: 'CORRIDOR',
        gps_latitude: 16.8456,
        gps_longitude: 74.6012,
        fixture_id: 'WATER-COOLER',
        x_coord: 380,
        y_coord: 250,
      });
    }

    await onAddLocations(generated);
    setIsSubmittingBatch(false);
    setShowBatchModal(false);
  };

  // -------------------------------------------------------------
  // ACTIONS: DELETE BUILDING & FLOOR
  // -------------------------------------------------------------
  const handleDeleteBuilding = async (bldName: string) => {
    const count = campusLocations.filter((l) => l.building_name === bldName).length;
    if (
      !window.confirm(
        `Are you sure you want to remove "${bldName}" and its ${count} configured room locations?`
      )
    ) {
      return;
    }
    setBuildings((prev) => prev.filter((b) => b.building_name !== bldName));
    await onDeleteBuildingLocations(bldName);
    const remaining = buildings.filter((b) => b.building_name !== bldName);
    if (remaining.length > 0) {
      setSelectedBuildingName(remaining[0].building_name);
    }
  };

  const handleDeleteFloor = async () => {
    const count = roomsOnFloor.length;
    if (
      !window.confirm(
        `Remove Floor ${selectedFloorNumber} of "${selectedBuildingName}" with all its ${count} rooms?`
      )
    ) {
      return;
    }
    await onDeleteFloorLocations(selectedBuildingName, selectedFloorNumber);
  };

  // -------------------------------------------------------------
  // ACTIONS: PRINT STICKER & PLACARDS
  // -------------------------------------------------------------
  const handlePrintAllFloorStickers = () => {
    if (roomsOnFloor.length === 0) return;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CampusPulse Batch Stickers - ${selectedBuildingName} Floor ${selectedFloorNumber}</title>
          <style>
            @page { size: auto; margin: 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; background: white; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; page-break-inside: auto; }
            .card { border: 3px solid #0288D1; border-radius: 12px; padding: 14px; text-align: center; page-break-inside: avoid; }
            .head { background: #0288D1; color: white; padding: 8px; border-radius: 6px; font-weight: 900; font-size: 14px; }
            .meta { font-size: 11px; color: #475569; margin: 6px 0; font-weight: 700; }
            .code { font-family: monospace; font-size: 10px; background: #E0F2FE; color: #0288D1; padding: 2px 6px; border-radius: 4px; display: inline-block; font-weight: 800; }
          </style>
        </head>
        <body>
          <h2 style="text-align: center; margin-bottom: 20px;">
            ${selectedBuildingName} • Floor ${selectedFloorNumber} Placards (${roomsOnFloor.length} Spots)
          </h2>
          <div class="grid">
            ${roomsOnFloor
              .map(
                (r) => `
              <div class="card">
                <div class="head">CampusPulse Spot QR</div>
                <div style="font-size: 16px; font-weight: 900; color: #0F172A; margin-top: 8px;">${r.room_number}</div>
                <div class="meta">${r.building_name} • Floor ${r.floor_number} (${r.zone_category})</div>
                ${r.fixture_id ? `<div class="meta" style="color:#0288D1;">Fixture: ${r.fixture_id}</div>` : ''}
                <div class="code">${r.location_id}</div>
                <div style="font-size: 9px; color: #64748B; margin-top: 8px;">Scan with smartphone camera to report facility issues</div>
              </div>
            `
              )
              .join('')}
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // -------------------------------------------------------------
  // RENDER UI
  // -------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Header & Overview KPIs */}
      <div
        style={{
          background: 'white',
          borderRadius: 20,
          border: '1px solid #E2E8F0',
          padding: 24,
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 4px 12px rgba(2, 136, 209, 0.3)',
              }}
            >
              <Compass size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
                College Campus Architecture Builder
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '3px 0 0' }}>
                Construct and manage your complete campus infrastructure: Buildings, Floors, Classrooms, Labs, and Restrooms
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddBuildingModal(true)}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
              color: 'white',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(2, 136, 209, 0.35)',
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>+ Add New Building / Wing</span>
          </button>
        </div>

        {/* KPI Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '14px 18px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Campus Buildings</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#0F172A', marginTop: 2 }}>{allBuildingNames.length}</div>
            <div style={{ fontSize: '0.72rem', color: '#0288D1', fontWeight: 700 }}>Academic Blocks & Wings</div>
          </div>

          <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '14px 18px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Total Configured Floors</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#0F172A', marginTop: 2 }}>
              {allBuildingNames.reduce((acc, bldName) => {
                const flrs = new Set(campusLocations.filter((l) => l.building_name === bldName).map((l) => l.floor_number));
                return acc + Math.max(1, flrs.size);
              }, 0)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>Active Spatial Levels</div>
          </div>

          <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '14px 18px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Rooms & Facility Spots</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#0F172A', marginTop: 2 }}>{campusLocations.length}</div>
            <div style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 700 }}>QR Placards Registered</div>
          </div>

          <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '14px 18px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Active Reported Defects</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#DC2626', marginTop: 2 }}>
              {tickets.filter((t) => t.status !== 'RESOLVED').length}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 700 }}>Requiring Technician Service</div>
          </div>
        </div>
      </div>

      {/* 2. Campus Buildings Selector Cards */}
      <div
        style={{
          background: 'white',
          borderRadius: 20,
          border: '1px solid #E2E8F0',
          padding: 20,
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.04em' }}>
          Select Campus Building / Block to Inspect & Edit Architecture:
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {allBuildingNames.map((bldName) => {
            const isSelected = selectedBuildingName === bldName;
            const bldConfig = buildings.find((b) => b.building_name === bldName);
            const bldRooms = campusLocations.filter((l) => l.building_name === bldName);
            const bldFloors = Array.from(new Set(bldRooms.map((l) => l.floor_number)));
            const bldTickets = tickets.filter(
              (t) => t.status !== 'RESOLVED' && t.location?.building_name === bldName
            );

            return (
              <div
                key={bldName}
                onClick={() => setSelectedBuildingName(bldName)}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: isSelected ? '2.5px solid #0288D1' : '1.5px solid #E2E8F0',
                  background: isSelected ? '#F0F9FF' : '#F8FAFC',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building size={18} color={isSelected ? '#0288D1' : '#64748B'} />
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: 'monospace',
                          background: isSelected ? '#E0F2FE' : '#E2E8F0',
                          color: isSelected ? '#0369A1' : '#475569',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontWeight: 800,
                        }}
                      >
                        {bldConfig?.building_code || 'BLD'}
                      </span>
                    </div>

                    {bldTickets.length > 0 && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          background: '#FEE2E2',
                          color: '#DC2626',
                          padding: '2px 8px',
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Flame size={11} />
                        {bldTickets.length} issues
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', marginTop: 6 }}>
                    {bldName}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: 10 }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>
                    {Math.max(1, bldFloors.length)} Floors • {bldRooms.length} Rooms
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBuilding(bldName);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: 4,
                    }}
                    title="Delete building and rooms"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Floors & Rooms Management for Selected Building */}
      <div
        style={{
          background: 'white',
          borderRadius: 20,
          border: '1px solid #E2E8F0',
          padding: 24,
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        }}
      >
        {/* Selected Building Banner & Floor Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0288D1', textTransform: 'uppercase' }}>
              CURRENTLY EDITING ARCHITECTURE:
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', marginTop: 2 }}>
              {selectedBuildingName}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowAddFloorModal(true)}
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#0F172A',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Plus size={14} />
              <span>Add Floor</span>
            </button>

            {roomsOnFloor.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteFloor}
                style={{
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: '1px solid #FECACA',
                  background: '#FEF2F2',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: '#DC2626',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Trash2 size={14} />
                <span>Clear Floor {selectedFloorNumber}</span>
              </button>
            )}
          </div>
        </div>

        {/* Floor Navigation Pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 20 }}>
          {availableFloors.map((flr) => {
            const count = locationsInBuilding.filter((l) => l.floor_number === flr).length;
            const isFloorSelected = selectedFloorNumber === flr;

            return (
              <button
                key={flr}
                type="button"
                onClick={() => setSelectedFloorNumber(flr)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 12,
                  border: isFloorSelected ? '2px solid #0288D1' : '1px solid #CBD5E1',
                  background: isFloorSelected ? '#0288D1' : 'white',
                  color: isFloorSelected ? 'white' : '#475569',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  boxShadow: isFloorSelected ? '0 2px 8px rgba(2, 136, 209, 0.3)' : 'none',
                }}
              >
                <Layers size={14} />
                <span>
                  {flr === -1 ? 'Basement (-1)' : flr === 0 ? 'Ground Floor (0)' : `Floor ${flr}`}
                </span>
                <span
                  style={{
                    background: isFloorSelected ? 'rgba(255,255,255,0.25)' : '#F1F5F9',
                    color: isFloorSelected ? 'white' : '#64748B',
                    fontSize: '0.68rem',
                    padding: '2px 6px',
                    borderRadius: 10,
                    fontWeight: 900,
                  }}
                >
                  {count} rooms
                </span>
              </button>
            );
          })}
        </div>

        {/* Room Action Bar */}
        <div
          style={{
            background: '#F8FAFC',
            borderRadius: 14,
            padding: '14px 18px',
            border: '1px solid #E2E8F0',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Search bar */}
          <div style={{ position: 'relative', minWidth: 240 }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 11 }} />
            <input
              type="text"
              placeholder="Search rooms on this floor..."
              value={roomSearch}
              onChange={(e) => setRoomSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: '0.8rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* View Mode Toggle: Canvas vs Grid */}
            <div style={{ display: 'flex', background: '#E2E8F0', borderRadius: 8, padding: 2 }}>
              <button
                type="button"
                onClick={() => setViewMode('CANVAS')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: viewMode === 'CANVAS' ? '#0F172A' : 'transparent',
                  color: viewMode === 'CANVAS' ? 'white' : '#475569',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span>🎨 Canvas Blueprint</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: viewMode === 'LIST' ? '#0F172A' : 'transparent',
                  color: viewMode === 'LIST' ? 'white' : '#475569',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span>📋 Room Cards</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAddRoomModal(true)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#0288D1',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Plus size={15} />
              <span>Add Single Room</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBatchModal(true)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1.5px solid #0288D1',
                background: '#E0F2FE',
                color: '#0369A1',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Sparkles size={15} color="#0288D1" />
              <span>⚡ Batch Room Wizard</span>
            </button>

            {roomsOnFloor.length > 0 && (
              <button
                type="button"
                onClick={handlePrintAllFloorStickers}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid #CBD5E1',
                  background: 'white',
                  color: '#0F172A',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Printer size={15} color="#0288D1" />
                <span>Print Floor Placards ({roomsOnFloor.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Rooms Display: Canvas View or Directory Grid */}
        {viewMode === 'CANVAS' ? (
          <CampusFloorCanvas
            buildingName={selectedBuildingName}
            floorNumber={selectedFloorNumber}
            campusLocations={campusLocations}
            tickets={tickets}
            selectedTicketId={null}
            onSelectTicket={() => {}}
            onUpdateLocationCoords={onUpdateLocationCoords}
            onAddLocation={onAddLocation}
            onDeleteLocation={onDeleteLocation}
          />
        ) : filteredRooms.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              background: '#F8FAFC',
              borderRadius: 16,
              border: '2px dashed #CBD5E1',
              color: '#64748B',
            }}
          >
            <Compass size={40} color="#94A3B8" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
              No rooms configured on Floor {selectedFloorNumber} yet
            </div>
            <p style={{ fontSize: '0.8rem', marginTop: 4 }}>
              Click <strong>"Add Single Room"</strong> or use the <strong>"⚡ Batch Room Wizard"</strong> to populate this floor with lecture halls, washrooms, and labs.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filteredRooms.map((room) => {
              const zone = ZONE_CONFIG[room.zone_category] || ZONE_CONFIG.CLASSROOM;
              const activeTicket = tickets.find(
                (t) => t.location_id === room.location_id && t.status !== 'RESOLVED'
              );

              return (
                <div
                  key={room.location_id}
                  style={{
                    background: 'white',
                    borderRadius: 14,
                    padding: 14,
                    border: activeTicket ? '2px solid #EF4444' : '1px solid #E2E8F0',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div>
                    {/* Top Row: Zone Badge & Active Incident Flame */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span
                        style={{
                          background: zone.bg,
                          color: zone.color,
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>{zone.icon}</span>
                        <span>{zone.label}</span>
                      </span>

                      {activeTicket && (
                        <span
                          style={{
                            background: '#FEE2E2',
                            color: '#DC2626',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Flame size={12} />
                          <span>Defect Open</span>
                        </span>
                      )}
                    </div>

                    {/* Room Title */}
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0F172A' }}>
                      {room.room_number}
                    </div>

                    {/* Fixture if present */}
                    {room.fixture_id && (
                      <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, marginTop: 2 }}>
                        Fixture / Asset: <strong style={{ color: '#0288D1' }}>{room.fixture_id}</strong>
                      </div>
                    )}

                    {/* Generated Spot ID */}
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.68rem',
                        color: '#0369A1',
                        background: '#F0F9FF',
                        padding: '3px 6px',
                        borderRadius: 4,
                        display: 'inline-block',
                        marginTop: 6,
                        fontWeight: 700,
                        wordBreak: 'break-all',
                      }}
                    >
                      {room.location_id}
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => setPreviewStickerLoc(room)}
                      style={{
                        background: '#F0F9FF',
                        border: '1px solid #BAE6FD',
                        borderRadius: 6,
                        padding: '4px 10px',
                        color: '#0288D1',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <QrCode size={13} />
                      <span>Print QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteLocation(room.location_id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                      title="Delete room"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------- */}
      {/* MODAL 1: ADD NEW BUILDING */}
      {/* ----------------------------------------------------------- */}
      {showAddBuildingModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
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
              maxWidth: 520,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building size={20} color="#0288D1" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Add New Campus Building / Wing
                </h3>
              </div>
              <button
                onClick={() => setShowAddBuildingModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddBuildingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: 5 }}>
                  Building Full Name:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mechanical Workshop or Aryabhata Computer Wing"
                  value={newBldName}
                  onChange={(e) => setNewBldName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: 5 }}>
                    Short Code Prefix:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MECH, CS-W"
                    value={newBldCode}
                    onChange={(e) => setNewBldCode(e.target.value.toUpperCase())}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: 5 }}>
                    Number of Floors:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={newBldFloorsCount}
                    onChange={(e) => setNewBldFloorsCount(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="includeGround"
                  checked={newBldIncludeGround}
                  onChange={(e) => setNewBldIncludeGround(e.target.checked)}
                />
                <label htmlFor="includeGround" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                  Include Ground Floor (Floor 0)
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: 5 }}>
                  Starter Architecture Template:
                </label>
                <select
                  value={newBldTemplate}
                  onChange={(e) => setNewBldTemplate(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.85rem',
                    background: 'white',
                    fontWeight: 600,
                  }}
                >
                  <option value="ACADEMIC">Standard Academic (4 Classrooms, 1 Lab, 1 Washroom per floor)</option>
                  <option value="LABS">Practical Labs & Workshop (3 Labs, 1 Washroom per floor)</option>
                  <option value="HOSTEL">Hostel & Dorms (6 Dorm Rooms, 1 Washroom per floor)</option>
                  <option value="EMPTY">Start Empty (Configure rooms manually)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmittingBuilding}
                style={{
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                {isSubmittingBuilding ? 'Creating Building Architecture...' : 'Create Building & Register Spots ➔'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* MODAL 2: ADD NEW FLOOR */}
      {/* ----------------------------------------------------------- */}
      {showAddFloorModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div style={{ background: 'white', borderRadius: 20, maxWidth: 380, width: '100%', padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Add Floor to {selectedBuildingName}
              </h3>
              <button
                onClick={() => setShowAddFloorModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddFloorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: 5 }}>
                  Floor Number:
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 4 or -1"
                  value={newFloorNum}
                  onChange={(e) => setNewFloorNum(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: 11,
                  borderRadius: 10,
                  border: 'none',
                  background: '#0288D1',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                Add Floor & Open View
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* MODAL 3: ADD SINGLE ROOM */}
      {/* ----------------------------------------------------------- */}
      {showAddRoomModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div style={{ background: 'white', borderRadius: 20, maxWidth: 440, width: '100%', padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Add Room to Floor {selectedFloorNumber}
              </h3>
              <button
                onClick={() => setShowAddRoomModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddRoomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: 5 }}>
                  Room Number or Name:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LH-105, WASH-03, PHYSICS-LAB"
                  value={newRoomNumber}
                  onChange={(e) => setNewRoomNumber(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: 5 }}>
                  Zone Category:
                </label>
                <select
                  value={newRoomZone}
                  onChange={(e) => setNewRoomZone(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.88rem',
                    background: 'white',
                    fontWeight: 600,
                  }}
                >
                  <option value="CLASSROOM">🎓 Classroom / Lecture Hall</option>
                  <option value="WASHROOM">🚰 Washroom / Restroom</option>
                  <option value="LABORATORY">🔬 Practical Science/Tech Lab</option>
                  <option value="CORRIDOR">🚪 Corridor & Common Hall</option>
                  <option value="FACULTY_ROOM">💼 Faculty & Admin Office</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: 5 }}>
                  Fixture / Asset ID (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. PROJECTOR-CEIL, FAN-01, TAP-02"
                  value={newRoomFixture}
                  onChange={(e) => setNewRoomFixture(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingRoom}
                style={{
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  background: '#0288D1',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                {isSubmittingRoom ? 'Registering Room...' : 'Register Room in Supabase ➔'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* MODAL 4: BATCH ROOM WIZARD */}
      {/* ----------------------------------------------------------- */}
      {showBatchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div style={{ background: 'white', borderRadius: 20, maxWidth: 480, width: '100%', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={20} color="#0288D1" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Batch Room Generator Wizard
                </h3>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 0, marginBottom: 14 }}>
              Generate sequential rooms for <strong>{selectedBuildingName} • Floor {selectedFloorNumber}</strong> in one click.
            </p>

            <form onSubmit={handleBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: 5 }}>
                  Room Prefix:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LH- or ROOM- or LAB-"
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: 5 }}>
                    Start Number:
                  </label>
                  <input
                    type="number"
                    required
                    value={batchStart}
                    onChange={(e) => setBatchStart(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: 5 }}>
                    End Number:
                  </label>
                  <input
                    type="number"
                    required
                    value={batchEnd}
                    onChange={(e) => setBatchEnd(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: 5 }}>
                  Zone Category for Batch:
                </label>
                <select
                  value={batchZone}
                  onChange={(e) => setBatchZone(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.88rem',
                    background: 'white',
                    fontWeight: 600,
                  }}
                >
                  <option value="CLASSROOM">🎓 Classroom / Lecture Hall</option>
                  <option value="LABORATORY">🔬 Practical Science Lab</option>
                  <option value="FACULTY_ROOM">💼 Faculty Office</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#F8FAFC', padding: 12, borderRadius: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={batchIncludeWashrooms}
                    onChange={(e) => setBatchIncludeWashrooms(e.target.checked)}
                  />
                  <span>Also create Male & Female Washroom Spots</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={batchIncludeCooler}
                    onChange={(e) => setBatchIncludeCooler(e.target.checked)}
                  />
                  <span>Also create Water Cooler Corridor Spot</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmittingBatch}
                style={{
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                {isSubmittingBatch
                  ? 'Generating Rooms...'
                  : `Generate & Register ${batchEnd - batchStart + 1 + (batchIncludeWashrooms ? 2 : 0) + (batchIncludeCooler ? 1 : 0)} Spots ➔`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* MODAL 5: QR PLACARD PREVIEW & PRINT */}
      {/* ----------------------------------------------------------- */}
      {previewStickerLoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
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
              maxWidth: 360,
              width: '100%',
              padding: 20,
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={() => setPreviewStickerLoc(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Placard Card */}
            <div
              style={{
                border: '3px solid #0288D1',
                borderRadius: 16,
                overflow: 'hidden',
                background: 'white',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
                  color: 'white',
                  padding: '12px 10px',
                }}
              >
                <div style={{ fontSize: '1.05rem', fontWeight: 900 }}>CampusPulse</div>
                <div style={{ fontSize: '0.65rem', color: '#E0F2FE', fontWeight: 800, textTransform: 'uppercase' }}>
                  FACILITY QUICK REPORT SPOT
                </div>
              </div>

              <div style={{ padding: 14 }}>
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Spot QR"
                    style={{ width: 180, height: 180, margin: '0 auto', display: 'block', borderRadius: 8 }}
                  />
                ) : (
                  <div style={{ width: 180, height: 180, background: '#F1F5F9', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Generating QR...
                  </div>
                )}
              </div>

              <div style={{ background: '#F8FAFC', borderTop: '1.5px dashed #CBD5E1', padding: '10px 12px' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                  {previewStickerLoc.room_number}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700, marginTop: 2 }}>
                  {previewStickerLoc.building_name} • Floor {previewStickerLoc.floor_number}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#0288D1', fontWeight: 800, marginTop: 2 }}>
                  Zone: {previewStickerLoc.zone_category} {previewStickerLoc.fixture_id ? `• ${previewStickerLoc.fixture_id}` : ''}
                </div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.62rem',
                    background: '#E0F2FE',
                    color: '#0369A1',
                    padding: '2px 6px',
                    borderRadius: 4,
                    display: 'inline-block',
                    marginTop: 6,
                    fontWeight: 700,
                  }}
                >
                  {previewStickerLoc.location_id}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  const printWin = window.open('', '_blank', 'width=600,height=700');
                  if (!printWin) return;
                  printWin.document.write(`
                    <html>
                      <head><title>Print Spot QR - ${previewStickerLoc.location_id}</title></head>
                      <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;">
                        <div style="border:4px solid #0288D1;border-radius:16px;overflow:hidden;width:320px;text-align:center;">
                          <div style="background:#0288D1;color:white;padding:12px;font-weight:bold;font-size:18px;">CampusPulse Spot QR</div>
                          <img src="${qrDataUrl}" style="width:220px;height:220px;display:block;margin:14px auto;" />
                          <div style="background:#F8FAFC;border-top:2px dashed #CBD5E1;padding:12px;">
                            <div style="font-size:20px;font-weight:900;">${previewStickerLoc.room_number}</div>
                            <div style="font-size:13px;color:#475569;margin-top:4px;">${previewStickerLoc.building_name} • Floor ${previewStickerLoc.floor_number}</div>
                            <div style="font-family:monospace;font-size:11px;color:#0288D1;margin-top:6px;">${previewStickerLoc.location_id}</div>
                          </div>
                        </div>
                        <script>window.onload = function() { window.print(); }</script>
                      </body>
                    </html>
                  `);
                  printWin.document.close();
                }}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: 'none',
                  background: '#0288D1',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Printer size={15} />
                <span>Print Placard</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!qrDataUrl) return;
                  const link = document.createElement('a');
                  link.href = qrDataUrl;
                  link.download = `QR-${previewStickerLoc.location_id}.png`;
                  link.click();
                }}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid #CBD5E1',
                  background: 'white',
                  color: '#0F172A',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Download size={15} />
                <span>Download PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

