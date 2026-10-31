import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Move,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Trash2,
  QrCode,
  Flame,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  Check,
  X,
  Grid,
  Info,
} from 'lucide-react';
import { CampusLocation, IncidentTicket } from '../types';

interface CampusFloorCanvasProps {
  buildingName: string;
  floorNumber: number;
  campusLocations: CampusLocation[];
  tickets: IncidentTicket[];
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string | null) => void;
  onUpdateLocationCoords: (locationId: string, x: number, y: number) => Promise<boolean>;
  onAddLocation: (loc: CampusLocation) => Promise<boolean>;
  onDeleteLocation?: (locationId: string) => Promise<boolean>;
}

const ZONE_THEMES: Record<
  CampusLocation['zone_category'],
  { label: string; icon: string; fill: string; stroke: string; text: string; subText: string }
> = {
  CLASSROOM: {
    label: 'Classroom / Lecture',
    icon: '🎓',
    fill: '#F0F9FF',
    stroke: '#38BDF8',
    text: '#0369A1',
    subText: '#0284C7',
  },
  WASHROOM: {
    label: 'Washroom / Restroom',
    icon: '🚰',
    fill: '#ECFDF5',
    stroke: '#34D399',
    text: '#065F46',
    subText: '#059669',
  },
  LABORATORY: {
    label: 'Practical Lab / Workshop',
    icon: '🔬',
    fill: '#F5F3FF',
    stroke: '#A78BFA',
    text: '#5B21B6',
    subText: '#6D28D9',
  },
  CORRIDOR: {
    label: 'Corridor & Hall',
    icon: '🚪',
    fill: '#FEF3C7',
    stroke: '#FBBF24',
    text: '#92400E',
    subText: '#B45309',
  },
  FACULTY_ROOM: {
    label: 'Faculty & Office',
    icon: '💼',
    fill: '#EEF2FF',
    stroke: '#818CF8',
    text: '#3730A3',
    subText: '#4338CA',
  },
};

const CANVAS_WIDTH = 920;
const CANVAS_HEIGHT = 520;
const ROOM_WIDTH = 150;
const ROOM_HEIGHT = 90;
const GRID_SNAP = 10;

export const CampusFloorCanvas: React.FC<CampusFloorCanvasProps> = ({
  buildingName,
  floorNumber,
  campusLocations,
  tickets,
  selectedTicketId,
  onSelectTicket,
  onUpdateLocationCoords,
  onAddLocation,
  onDeleteLocation,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Canvas Mode & Zoom
  const [canvasMode, setCanvasMode] = useState<'DRAG' | 'ADD_ROOM'>('DRAG');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Dragging State
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Local Coordinates cache for 60fps fluid dragging
  const [localCoords, setLocalCoords] = useState<Record<string, { x: number; y: number }>>({});
  const [saveIndicator, setSaveIndicator] = useState<string | null>(null);

  // Add Room on Canvas state
  const [clickPlacementCoord, setClickPlacementCoord] = useState<{ x: number; y: number } | null>(
    null
  );
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomZone, setNewRoomZone] = useState<CampusLocation['zone_category']>('CLASSROOM');
  const [newRoomFixture, setNewRoomFixture] = useState('');

  // Selected Room Popover on Canvas
  const [inspectedRoomId, setInspectedRoomId] = useState<string | null>(null);

  // Filter locations on this building and floor
  const floorLocations = campusLocations.filter(
    (l) => l.building_name === buildingName && l.floor_number === floorNumber
  );

  // Initialize or auto-distribute coordinates if rooms don't have custom x/y
  useEffect(() => {
    const updatedMap: Record<string, { x: number; y: number }> = {};
    floorLocations.forEach((loc, idx) => {
      // If already tracked in local state, preserve
      if (localCoords[loc.location_id]) {
        updatedMap[loc.location_id] = localCoords[loc.location_id];
        return;
      }

      // Check if location already has meaningful stored coordinates
      if (
        loc.x_coord !== undefined &&
        loc.y_coord !== undefined &&
        loc.x_coord > 0 &&
        loc.y_coord > 0 &&
        !(loc.x_coord === 200 && loc.y_coord === 150)
      ) {
        updatedMap[loc.location_id] = { x: loc.x_coord, y: loc.y_coord };
      } else {
        // Auto-distribute rooms along blueprint wings
        const isNorthWing = idx % 2 === 0;
        const col = Math.floor(idx / 2);
        const colX = 70 + (col % 5) * 165;
        const colY = isNorthWing ? 50 : 360;

        updatedMap[loc.location_id] = {
          x: loc.x_coord || colX,
          y: loc.y_coord || colY,
        };
      }
    });

    setLocalCoords(updatedMap);
  }, [floorLocations, buildingName, floorNumber]);

  // Convert client mouse event to SVG coordinate space
  const getSvgCoordinates = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const pt = svgRef.current.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const screenCTM = svgRef.current.getScreenCTM();
      if (!screenCTM) return { x: 0, y: 0 };
      const svgPoint = pt.matrixTransform(screenCTM.inverse());
      return {
        x: Math.round(svgPoint.x),
        y: Math.round(svgPoint.y),
      };
    },
    []
  );

  // -------------------------------------------------------------
  // MOUSE DOWN: START DRAGGING
  // -------------------------------------------------------------
  const handleRoomMouseDown = (e: React.MouseEvent, loc: CampusLocation) => {
    if (canvasMode !== 'DRAG') return;
    e.stopPropagation();

    const svgCoords = getSvgCoordinates(e.clientX, e.clientY);
    const currentPos = localCoords[loc.location_id] || {
      x: loc.x_coord || 200,
      y: loc.y_coord || 150,
    };

    setDraggingRoomId(loc.location_id);
    setDragOffset({
      x: svgCoords.x - currentPos.x,
      y: svgCoords.y - currentPos.y,
    });
  };

  // -------------------------------------------------------------
  // MOUSE MOVE: DRAG ROOM
  // -------------------------------------------------------------
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingRoomId) return;

    const svgCoords = getSvgCoordinates(e.clientX, e.clientY);
    let newX = svgCoords.x - dragOffset.x;
    let newY = svgCoords.y - dragOffset.y;

    // Snap to grid
    if (showGrid) {
      newX = Math.round(newX / GRID_SNAP) * GRID_SNAP;
      newY = Math.round(newY / GRID_SNAP) * GRID_SNAP;
    }

    // Keep within bounds
    newX = Math.max(10, Math.min(CANVAS_WIDTH - ROOM_WIDTH - 10, newX));
    newY = Math.max(10, Math.min(CANVAS_HEIGHT - ROOM_HEIGHT - 10, newY));

    setLocalCoords((prev) => ({
      ...prev,
      [draggingRoomId]: { x: newX, y: newY },
    }));
  };

  // -------------------------------------------------------------
  // MOUSE UP: COMMIT POSITION
  // -------------------------------------------------------------
  const handleSvgMouseUp = async () => {
    if (!draggingRoomId) return;

    const finalPos = localCoords[draggingRoomId];
    const roomIdToSave = draggingRoomId;
    setDraggingRoomId(null);

    if (finalPos) {
      await onUpdateLocationCoords(roomIdToSave, finalPos.x, finalPos.y);
      setSaveIndicator('Layout Position Saved ✓');
      setTimeout(() => setSaveIndicator(null), 2000);
    }
  };

  // -------------------------------------------------------------
  // CANVAS CLICK: ADD ROOM AT COORDINATES
  // -------------------------------------------------------------
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (canvasMode === 'ADD_ROOM') {
      const coords = getSvgCoordinates(e.clientX, e.clientY);
      const snappedX = Math.round(coords.x / GRID_SNAP) * GRID_SNAP;
      const snappedY = Math.round(coords.y / GRID_SNAP) * GRID_SNAP;
      setClickPlacementCoord({ x: snappedX, y: snappedY });
      setInspectedRoomId(null);
    } else {
      setInspectedRoomId(null);
    }
  };

  // -------------------------------------------------------------
  // AUTO-ARRANGE BLUEPRINT
  // -------------------------------------------------------------
  const handleAutoArrange = async () => {
    const updatedMap: Record<string, { x: number; y: number }> = {};
    floorLocations.forEach((loc, idx) => {
      const isNorthWing = idx % 2 === 0;
      const col = Math.floor(idx / 2);
      const colX = 70 + (col % 5) * 165;
      const colY = isNorthWing ? 50 : 360;

      updatedMap[loc.location_id] = { x: colX, y: colY };
      onUpdateLocationCoords(loc.location_id, colX, colY);
    });

    setLocalCoords(updatedMap);
    setSaveIndicator('Auto-Arranged Blueprint ✓');
    setTimeout(() => setSaveIndicator(null), 2500);
  };

  // -------------------------------------------------------------
  // CONFIRM ADD ROOM AT CLICKED SPOT
  // -------------------------------------------------------------
  const handleConfirmAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber.trim() || !clickPlacementCoord) return;

    const cleanRoom = newRoomNumber.trim().toUpperCase();
    const cleanBldCode = buildingName.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase();
    const locId = `QR-${cleanBldCode}-FL${floorNumber}-${cleanRoom.replace(/[^A-Z0-9]/g, '-')}`;

    const newLoc: CampusLocation = {
      location_id: locId,
      building_name: buildingName,
      floor_number: floorNumber,
      room_number: cleanRoom,
      zone_category: newRoomZone,
      gps_latitude: 16.8456,
      gps_longitude: 74.6012,
      fixture_id: newRoomFixture.trim().toUpperCase() || undefined,
      x_coord: clickPlacementCoord.x,
      y_coord: clickPlacementCoord.y,
    };

    await onAddLocation(newLoc);
    setLocalCoords((prev) => ({
      ...prev,
      [locId]: { x: clickPlacementCoord.x, y: clickPlacementCoord.y },
    }));

    setNewRoomNumber('');
    setNewRoomFixture('');
    setClickPlacementCoord(null);
    setCanvasMode('DRAG');
    setSaveIndicator(`Added ${cleanRoom} to Canvas ✓`);
    setTimeout(() => setSaveIndicator(null), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 1. Canvas Control Bar */}
      <div
        style={{
          background: '#0F172A',
          borderRadius: 14,
          padding: '10px 16px',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        {/* Left: Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => {
              setCanvasMode('DRAG');
              setClickPlacementCoord(null);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: canvasMode === 'DRAG' ? '1.5px solid #38BDF8' : '1px solid #334155',
              background: canvasMode === 'DRAG' ? '#1E293B' : 'transparent',
              color: canvasMode === 'DRAG' ? '#38BDF8' : '#94A3B8',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Move size={14} />
            <span>Arrange Rooms ✋</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCanvasMode('ADD_ROOM');
              setInspectedRoomId(null);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: canvasMode === 'ADD_ROOM' ? '1.5px solid #10B981' : '1px solid #334155',
              background: canvasMode === 'ADD_ROOM' ? '#064E3B' : 'transparent',
              color: canvasMode === 'ADD_ROOM' ? '#6EE7B7' : '#94A3B8',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Plus size={14} />
            <span>Drop Room onto Canvas ➕</span>
          </button>

          <button
            type="button"
            onClick={handleAutoArrange}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #334155',
              background: '#1E293B',
              color: '#F1F5F9',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Automatically arrange rooms into north and south wings"
          >
            <Sparkles size={13} color="#F59E0B" />
            <span>Auto-Align Blueprint</span>
          </button>
        </div>

        {/* Center: Save Feedback Badge */}
        {saveIndicator && (
          <div
            style={{
              background: '#065F46',
              color: '#A7F3D0',
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: '0.72rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              animation: 'fadeIn 0.2s',
            }}
          >
            <Check size={12} strokeWidth={3} />
            <span>{saveIndicator}</span>
          </div>
        )}

        {/* Right: Grid & Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              background: showGrid ? '#1E293B' : 'transparent',
              border: '1px solid #334155',
              color: showGrid ? '#38BDF8' : '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
            title="Toggle Blueprint Grid Snapping"
          >
            <Grid size={13} />
            <span>Grid</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', background: '#1E293B', borderRadius: 6, border: '1px solid #334155' }}>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.7, Number((z - 0.1).toFixed(1))))}
              style={{ padding: '4px 8px', background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'white', minWidth: 34, textAlign: 'center' }}>
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(1.5, Number((z + 0.1).toFixed(1))))}
              style={{ padding: '4px 8px', background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              style={{ padding: '4px 6px', background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              title="Reset Zoom"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive SVG Canvas Viewport */}
      <div
        style={{
          position: 'relative',
          background: '#0F172A',
          borderRadius: 16,
          border: '2px solid #1E293B',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        {/* Canvas Mode Indicator Banner */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 10,
            background: canvasMode === 'ADD_ROOM' ? 'rgba(5, 150, 105, 0.9)' : 'rgba(15, 23, 42, 0.85)',
            border: `1px solid ${canvasMode === 'ADD_ROOM' ? '#10B981' : '#334155'}`,
            borderRadius: 8,
            padding: '5px 10px',
            color: 'white',
            fontSize: '0.72rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backdropFilter: 'blur(4px)',
          }}
        >
          {canvasMode === 'ADD_ROOM' ? (
            <>
              <Plus size={13} />
              <span>Click anywhere on the floor grid to drop a new room</span>
            </>
          ) : (
            <>
              <Move size={13} color="#38BDF8" />
              <span>Drag any room box to adjust architectural layout • {floorLocations.length} Rooms on Floor</span>
            </>
          )}
        </div>

        {/* SVG Canvas */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            cursor:
              canvasMode === 'ADD_ROOM'
                ? 'crosshair'
                : draggingRoomId
                ? 'grabbing'
                : 'default',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            transition: draggingRoomId ? 'none' : 'transform 0.15s ease',
          }}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onClick={handleSvgClick}
        >
          {/* Blueprint Grid Pattern */}
          <defs>
            <pattern id="canvas-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1E293B" strokeWidth="0.8" />
            </pattern>
            <pattern id="canvas-major-grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#334155" strokeWidth="1.2" opacity="0.6" />
            </pattern>
          </defs>

          {/* Canvas Background Grid */}
          <rect width="100%" height="100%" fill="#0B132B" />
          {showGrid && <rect width="100%" height="100%" fill="url(#canvas-grid)" />}
          {showGrid && <rect width="100%" height="100%" fill="url(#canvas-major-grid)" />}

          {/* Central Architectural Corridor Spine */}
          <g opacity="0.75">
            <rect
              x="40"
              y="225"
              width={CANVAS_WIDTH - 80}
              height="70"
              rx="12"
              fill="#1E293B"
              stroke="#334155"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            <text
              x={CANVAS_WIDTH / 2}
              y="266"
              textAnchor="middle"
              fill="#94A3B8"
              fontSize="12"
              fontWeight="900"
              letterSpacing="0.1em"
            >
              CENTRAL CORRIDOR — {buildingName.toUpperCase()} (LEVEL {floorNumber})
            </text>
          </g>

          {/* Render All Room Nodes on Canvas */}
          {floorLocations.map((loc) => {
            const coords = localCoords[loc.location_id] || {
              x: loc.x_coord || 200,
              y: loc.y_coord || 150,
            };
            const theme = ZONE_THEMES[loc.zone_category] || ZONE_THEMES.CLASSROOM;
            const isDragging = draggingRoomId === loc.location_id;
            const isInspected = inspectedRoomId === loc.location_id;

            // Check if there is an active defect on this spot
            const activeTicket = tickets.find(
              (t) => t.location_id === loc.location_id && t.status !== 'RESOLVED'
            );
            const isTicketSelected =
              activeTicket && selectedTicketId === activeTicket.ticket_id;

            return (
              <g
                key={loc.location_id}
                transform={`translate(${coords.x}, ${coords.y})`}
                style={{
                  cursor: canvasMode === 'DRAG' ? 'grab' : 'pointer',
                  filter: isDragging
                    ? 'drop-shadow(0 12px 24px rgba(0,0,0,0.6))'
                    : 'drop-shadow(0 4px 10px rgba(0,0,0,0.3))',
                }}
                onMouseDown={(e) => handleRoomMouseDown(e, loc)}
                onClick={(e) => {
                  e.stopPropagation();
                  setInspectedRoomId(loc.location_id);
                  if (activeTicket) {
                    onSelectTicket(activeTicket.ticket_id);
                  }
                }}
              >
                {/* Active Incident Pulsing Glow */}
                {activeTicket && (
                  <rect
                    x="-6"
                    y="-6"
                    width={ROOM_WIDTH + 12}
                    height={ROOM_HEIGHT + 12}
                    rx="14"
                    fill="none"
                    stroke={
                      activeTicket.status === 'REPORTED'
                        ? '#EF4444'
                        : activeTicket.status === 'DISPATCHED'
                        ? '#F59E0B'
                        : '#10B981'
                    }
                    strokeWidth="3.5"
                    strokeDasharray={activeTicket.status === 'REPORTED' ? '6 3' : 'none'}
                    opacity="0.9"
                    className="animate-pulse"
                  />
                )}

                {/* Main Room Card */}
                <rect
                  x="0"
                  y="0"
                  width={ROOM_WIDTH}
                  height={ROOM_HEIGHT}
                  rx="10"
                  fill={isInspected ? '#FFFFFF' : theme.fill}
                  stroke={
                    isTicketSelected
                      ? '#DC2626'
                      : isInspected
                      ? '#0288D1'
                      : isDragging
                      ? '#38BDF8'
                      : theme.stroke
                  }
                  strokeWidth={isInspected || isDragging ? '3' : '2'}
                />

                {/* Zone Icon & Category Header Strip */}
                <rect
                  x="0"
                  y="0"
                  width={ROOM_WIDTH}
                  height="26"
                  rx="10"
                  fill={theme.stroke}
                  opacity="0.25"
                />

                {/* Category Icon & Short Label */}
                <text x="10" y="18" fontSize="12" fontWeight="800" fill={theme.text}>
                  {theme.icon}
                </text>
                <text
                  x="28"
                  y="17"
                  fontSize="9.5"
                  fontWeight="800"
                  fill={theme.text}
                  letterSpacing="0.02em"
                >
                  {theme.label.split('/')[0].trim()}
                </text>

                {/* Drag Handle Dots (in Drag Mode) */}
                {canvasMode === 'DRAG' && (
                  <g opacity="0.6">
                    <circle cx={ROOM_WIDTH - 20} cy="10" r="1.5" fill={theme.text} />
                    <circle cx={ROOM_WIDTH - 14} cy="10" r="1.5" fill={theme.text} />
                    <circle cx={ROOM_WIDTH - 20} cy="16" r="1.5" fill={theme.text} />
                    <circle cx={ROOM_WIDTH - 14} cy="16" r="1.5" fill={theme.text} />
                  </g>
                )}

                {/* Room Number / Title */}
                <text
                  x={ROOM_WIDTH / 2}
                  y="52"
                  textAnchor="middle"
                  fontSize="17"
                  fontWeight="900"
                  fill="#0F172A"
                  letterSpacing="-0.02em"
                >
                  {loc.room_number}
                </text>

                {/* Fixture or ID Tag */}
                <text
                  x={ROOM_WIDTH / 2}
                  y="72"
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill={theme.subText}
                >
                  {loc.fixture_id ? `Fixture: ${loc.fixture_id}` : `ID: ${loc.location_id.slice(-8)}`}
                </text>

                {/* Incident Status Badge if Active */}
                {activeTicket && (
                  <g transform={`translate(${ROOM_WIDTH - 26}, -8)`}>
                    <circle
                      r="12"
                      cx="12"
                      cy="12"
                      fill={activeTicket.status === 'REPORTED' ? '#EF4444' : '#F59E0B'}
                      stroke="white"
                      strokeWidth="2"
                    />
                    <text
                      x="12"
                      y="16"
                      textAnchor="middle"
                      fill="white"
                      fontSize="10"
                      fontWeight="900"
                    >
                      !
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Click Placement Marker (When User clicks canvas in ADD_ROOM mode) */}
          {clickPlacementCoord && (
            <g transform={`translate(${clickPlacementCoord.x}, ${clickPlacementCoord.y})`}>
              <rect
                x="0"
                y="0"
                width={ROOM_WIDTH}
                height={ROOM_HEIGHT}
                rx="10"
                fill="rgba(16, 185, 129, 0.2)"
                stroke="#10B981"
                strokeWidth="2.5"
                strokeDasharray="6 3"
              />
              <text
                x={ROOM_WIDTH / 2}
                y={ROOM_HEIGHT / 2 + 5}
                textAnchor="middle"
                fill="#10B981"
                fontSize="13"
                fontWeight="900"
              >
                + Drop Room Here
              </text>
            </g>
          )}
        </svg>

        {/* 3. Drop Room Creator Card (Floats when user clicks canvas) */}
        {clickPlacementCoord && (
          <div
            style={{
              position: 'absolute',
              top: Math.min(CANVAS_HEIGHT - 220, clickPlacementCoord.y + 10),
              left: Math.min(CANVAS_WIDTH - 280, clickPlacementCoord.x + 10),
              background: 'white',
              borderRadius: 14,
              padding: 16,
              boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
              border: '2px solid #10B981',
              zIndex: 30,
              width: 260,
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0F172A' }}>
                Drop New Room Here
              </div>
              <button
                type="button"
                onClick={() => setClickPlacementCoord(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmAddRoom} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 3 }}>
                  Room Number / Name:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. LH-405, LAB-02"
                  value={newRoomNumber}
                  onChange={(e) => setNewRoomNumber(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 3 }}>
                  Zone Category:
                </label>
                <select
                  value={newRoomZone}
                  onChange={(e) => setNewRoomZone(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8rem',
                    background: 'white',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="CLASSROOM">🎓 Classroom / Lecture</option>
                  <option value="WASHROOM">🚰 Washroom / Restroom</option>
                  <option value="LABORATORY">🔬 Practical Science Lab</option>
                  <option value="CORRIDOR">🚪 Corridor / Hall</option>
                  <option value="FACULTY_ROOM">💼 Faculty Office</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 3 }}>
                  Fixture ID (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. FAN-01, TAP-01"
                  value={newRoomFixture}
                  onChange={(e) => setNewRoomFixture(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  marginTop: 4,
                  padding: 9,
                  borderRadius: 8,
                  border: 'none',
                  background: '#10B981',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                Place Room on Canvas ➔
              </button>
            </form>
          </div>
        )}

        {/* 4. Inspected Room Popover Drawer */}
        {inspectedRoomId && (
          (() => {
            const room = floorLocations.find((l) => l.location_id === inspectedRoomId);
            if (!room) return null;
            const theme = ZONE_THEMES[room.zone_category] || ZONE_THEMES.CLASSROOM;
            const activeTicket = tickets.find(
              (t) => t.location_id === room.location_id && t.status !== 'RESOLVED'
            );

            return (
              <div
                style={{
                  position: 'absolute',
                  bottom: 16,
                  right: 16,
                  background: 'white',
                  borderRadius: 16,
                  padding: 16,
                  boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
                  border: '2px solid #0288D1',
                  zIndex: 25,
                  maxWidth: 320,
                  width: '100%',
                  animation: 'fadeIn 0.15s ease-out',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '1rem' }}>{theme.icon}</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                      {room.room_number}
                    </span>
                  </div>
                  <button
                    onClick={() => setInspectedRoomId(null)}
                    style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, marginBottom: 8 }}>
                  {room.building_name} • Floor {room.floor_number} ({theme.label})
                </div>

                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.68rem',
                    background: '#F0F9FF',
                    color: '#0288D1',
                    padding: '3px 8px',
                    borderRadius: 4,
                    display: 'inline-block',
                    marginBottom: 10,
                    fontWeight: 700,
                  }}
                >
                  {room.location_id}
                </div>

                {/* If active defect is present */}
                {activeTicket ? (
                  <div
                    style={{
                      background: '#FEF2F2',
                      borderRadius: 10,
                      padding: 10,
                      border: '1px solid #FECACA',
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#DC2626', fontWeight: 800, fontSize: '0.78rem' }}>
                      <Flame size={14} />
                      <span>Active Incident: {activeTicket.ticket_id}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#7F1D1D', marginTop: 2 }}>
                      Severity: <strong>{activeTicket.ai_severity_score}/100</strong> • Status: {activeTicket.status}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectTicket(activeTicket.ticket_id)}
                      style={{
                        marginTop: 6,
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#DC2626',
                        color: 'white',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Inspect in Ticket Feed ➔
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                    <CheckCircle2 size={14} color="#10B981" />
                    <span>No active defects reported on this room</span>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={`/report?loc=${encodeURIComponent(room.location_id)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1,
                      padding: '7px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      background: '#F8FAFC',
                      color: '#0F172A',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      textDecoration: 'none',
                      textAlign: 'center',
                    }}
                  >
                    Test Spot QR URL
                  </a>

                  {onDeleteLocation && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`Delete ${room.room_number} from this floor?`)) {
                          await onDeleteLocation(room.location_id);
                          setInspectedRoomId(null);
                        }
                      }}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 8,
                        border: '1px solid #FECACA',
                        background: '#FEF2F2',
                        color: '#DC2626',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* 3. Canvas Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '6px 12px',
          background: 'white',
          borderRadius: 12,
          border: '1px solid #E2E8F0',
          fontSize: '0.74rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, color: '#64748B' }}>Zone Themes:</span>
          {Object.entries(ZONE_THEMES).map(([zoneKey, theme]) => (
            <div key={zoneKey} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: theme.stroke,
                }}
              />
              <span style={{ color: '#475569', fontWeight: 700 }}>
                {theme.icon} {theme.label.split('/')[0]}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
            <span style={{ color: '#DC2626', fontWeight: 800 }}>Active Defect Pulse</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
            <span style={{ color: '#059669', fontWeight: 800 }}>Resolved Proof</span>
          </div>
        </div>
      </div>
    </div>
  );
};
