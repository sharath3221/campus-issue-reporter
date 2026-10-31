import { useState, useEffect, useCallback } from 'react';
import {
  IncidentTicket,
  IncidentCategory,
  TicketStatus,
  CampusLocation,
  MaintenanceStaff,
} from '../types';
import {
  campusLocations as defaultLocations,
  maintenanceStaff as defaultStaff,
  initialIncidentTickets,
} from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const TICKETS_STORAGE_KEY = 'campuspulse_tickets_v1';
const LOCATIONS_STORAGE_KEY = 'campuspulse_locations_v1';
const STAFF_STORAGE_KEY = 'campuspulse_staff_v1';

export function useIncidents() {
  // 1. Campus Locations State (Dynamic & Realtime)
  const [locations, setLocations] = useState<CampusLocation[]>(() => {
    try {
      const saved = localStorage.getItem(LOCATIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed reading locations from localStorage', e);
    }
    return defaultLocations;
  });

  // 2. Incident Tickets State (Real data only, purging any legacy mock demo tickets)
  const [tickets, setTickets] = useState<IncidentTicket[]>(() => {
    try {
      const saved = localStorage.getItem(TICKETS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out legacy demo mock tickets if present
          const cleaned = parsed.filter(
            (t: IncidentTicket) =>
              !['tick-1001', 'tick-1002', 'tick-1003', 'tick-1004', 'tick-1005', 'tick-1006'].includes(
                t.ticket_id
              )
          );
          return cleaned;
        }
      }
    } catch (e) {
      console.error('Failed reading tickets from localStorage', e);
    }
    return initialIncidentTickets;
  });

  // 3. Maintenance Staff State (Dynamic, Realtime & Admin Managed)
  const [staffList, setStaffList] = useState<MaintenanceStaff[]>(() => {
    try {
      const saved = localStorage.getItem(STAFF_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed reading staff from localStorage', e);
    }
    return defaultStaff;
  });

  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);

  // Sync tickets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
    } catch (e) {
      console.error('Failed writing tickets to localStorage', e);
    }
  }, [tickets]);

  // Sync locations to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(locations));
    } catch (e) {
      console.error('Failed writing locations to localStorage', e);
    }
  }, [locations]);

  // Sync staffList to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staffList));
    } catch (e) {
      console.error('Failed writing staff to localStorage', e);
    }
  }, [staffList]);

  // Fetch from Supabase and subscribe to Realtime
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let isMounted = true;

    // 1. Fetch live campus locations from Supabase
    async function fetchSupabaseLocations() {
      try {
        const { data, error } = await supabase!
          .from('campus_locations')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0 && isMounted) {
          setLocations(data as CampusLocation[]);
          localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(data));
        }
      } catch (err) {
        console.warn('Notice: Error fetching campus locations from Supabase:', err);
      }
    }

    // 2. Fetch live tickets from Supabase
    async function fetchSupabaseTickets() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase!
          .from('incident_tickets')
          .select(`
            *,
            location:campus_locations(*),
            assigned_staff:maintenance_staff(*)
          `)
          .order('reported_at', { ascending: false });

        if (error) {
          console.warn('Notice: Supabase fetch error, using local cached tickets:', error);
          return;
        }

        if (data && isMounted) {
          const mapped: IncidentTicket[] = data.map((row: any) => ({
            ticket_id: row.ticket_id,
            location_id: row.location_id,
            location: row.location || locations.find((l) => l.location_id === row.location_id),
            category: row.category as IncidentCategory,
            ai_severity_score: Number(row.ai_severity_score),
            status: row.status as TicketStatus,
            duplicate_count: Number(row.duplicate_count || 1),
            voice_transcript: row.voice_transcript,
            voice_audio_url: row.voice_audio_url,
            user_photo_url: row.user_photo_url,
            fixed_photo_url: row.fixed_photo_url,
            ai_vision_tags: Array.isArray(row.ai_vision_tags) ? row.ai_vision_tags : [],
            assigned_staff_id: row.assigned_staff_id,
            assigned_staff:
              row.assigned_staff ||
              staffList.find((s) => s.staff_id === row.assigned_staff_id),
            reported_at: row.reported_at,
            dispatched_at: row.dispatched_at,
            resolved_at: row.resolved_at,
          }));

          setTickets(mapped);
        }
      } catch (err) {
        console.warn('Failed to load tickets from Supabase:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchSupabaseLocations();
    fetchSupabaseTickets();

    // 3. Fetch live staff from Supabase
    async function fetchSupabaseStaff() {
      try {
        const { data, error } = await supabase!
          .from('maintenance_staff')
          .select('*')
          .order('full_name', { ascending: true });

        if (!error && data && data.length > 0 && isMounted) {
          const mappedStaff: MaintenanceStaff[] = data.map((s: any) => ({
            staff_id: s.staff_id,
            full_name: s.full_name,
            specialization: s.specialization,
            phone_number: s.phone_number,
            is_on_duty: s.is_on_duty,
            passcode: s.passcode || '1234',
          }));
          setStaffList(mappedStaff);
          localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(mappedStaff));
        }
      } catch (err) {
        console.warn('Notice: Error fetching staff from Supabase:', err);
      }
    }

    fetchSupabaseStaff();

    // Supabase Realtime Subscription for tickets
    const ticketChannel = supabase!
      .channel('public:incident_tickets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incident_tickets' },
        (payload) => {
          console.log('⚡ Realtime ticket update from Supabase:', payload);
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as any;
            setTickets((prev) => {
              if (prev.some((t) => t.ticket_id === newRow.ticket_id)) return prev;
              const mapped: IncidentTicket = {
                ticket_id: newRow.ticket_id,
                location_id: newRow.location_id,
                location: locations.find((l) => l.location_id === newRow.location_id),
                category: newRow.category,
                ai_severity_score: Number(newRow.ai_severity_score),
                status: newRow.status,
                duplicate_count: Number(newRow.duplicate_count || 1),
                voice_transcript: newRow.voice_transcript,
                voice_audio_url: newRow.voice_audio_url,
                user_photo_url: newRow.user_photo_url,
                fixed_photo_url: newRow.fixed_photo_url,
                ai_vision_tags: newRow.ai_vision_tags || [],
                assigned_staff_id: newRow.assigned_staff_id,
                assigned_staff: staffList.find((s) => s.staff_id === newRow.assigned_staff_id),
                reported_at: newRow.reported_at,
                dispatched_at: newRow.dispatched_at,
                resolved_at: newRow.resolved_at,
              };
              return [mapped, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            setTickets((prev) =>
              prev.map((t) =>
                t.ticket_id === updated.ticket_id
                  ? {
                      ...t,
                      status: updated.status,
                      duplicate_count: Number(updated.duplicate_count || t.duplicate_count),
                      ai_severity_score: Number(updated.ai_severity_score || t.ai_severity_score),
                      user_photo_url: updated.user_photo_url || t.user_photo_url,
                      ai_vision_tags: updated.ai_vision_tags || t.ai_vision_tags,
                      assigned_staff_id: updated.assigned_staff_id || t.assigned_staff_id,
                      assigned_staff:
                        staffList.find((s) => s.staff_id === updated.assigned_staff_id) ||
                        t.assigned_staff,
                      fixed_photo_url: updated.fixed_photo_url || t.fixed_photo_url,
                      dispatched_at: updated.dispatched_at || t.dispatched_at,
                      resolved_at: updated.resolved_at || t.resolved_at,
                    }
                  : t
              )
            );
          }
        }
      )
      .subscribe();

    // Supabase Realtime Subscription for campus_locations
    const locationsChannel = supabase!
      .channel('public:campus_locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campus_locations' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as CampusLocation;
            setLocations((prev) => {
              const filtered = prev.filter((l) => l.location_id !== row.location_id);
              const updated = [row, ...filtered];
              localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(updated));
              return updated;
            });
          }
        }
      )
      .subscribe();

    // Supabase Realtime Subscription for maintenance_staff
    const staffChannel = supabase!
      .channel('public:maintenance_staff')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_staff' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as MaintenanceStaff;
            setStaffList((prev) => {
              const filtered = prev.filter((s) => s.staff_id !== row.staff_id);
              const updated = [...filtered, row];
              localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(updated));
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.staff_id;
            if (oldId) {
              setStaffList((prev) => {
                const updated = prev.filter((s) => s.staff_id !== oldId);
                localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(updated));
                return updated;
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase!.removeChannel(ticketChannel);
      supabase!.removeChannel(locationsChannel);
      supabase!.removeChannel(staffChannel);
    };
  }, []);

  // AI Urgency Calculation Algorithm
  const calculateAISeverity = (
    category: IncidentCategory,
    duplicateCount: number,
    hasVoiceNote: boolean,
    hasImage: boolean
  ): number => {
    let baseSeverity = 5.0;
    switch (category) {
      case 'WATER_SUPPLY':
        baseSeverity = 8.5;
        break;
      case 'LIGHTS_FAN_PROJECTOR':
        baseSeverity = 8.0;
        break;
      case 'WASHROOM_CLEANLINESS':
        baseSeverity = 6.5;
        break;
      case 'FURNITURE_MAINTENANCE':
        baseSeverity = 4.5;
        break;
    }

    const currentHour = new Date().getHours();
    const isClassHours = currentHour >= 8 && currentHour <= 17;
    const lectureMultiplier = isClassHours ? 1.3 : 1.0;
    const duplicateWeight = Math.min(30, duplicateCount * 3.5);
    const mediaBonus = (hasImage ? 6 : 0) + (hasVoiceNote ? 4 : 0);

    return Math.min(
      99.5,
      Number((baseSeverity * 7.5 * lectureMultiplier + duplicateWeight + mediaBonus).toFixed(1))
    );
  };

  // Add / Register a new Campus Location (Admin QR Generator)
  const addCampusLocation = useCallback(
    async (newLoc: CampusLocation): Promise<boolean> => {
      // 1. Update local reactive state and cache
      setLocations((prev) => {
        const filtered = prev.filter((l) => l.location_id !== newLoc.location_id);
        const updated = [newLoc, ...filtered];
        try {
          localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
        return updated;
      });

      // 2. Persist to Supabase database
      if (isSupabaseConfigured && supabase) {
        try {
          const { error } = await supabase.from('campus_locations').upsert(
            {
              location_id: newLoc.location_id,
              building_name: newLoc.building_name,
              floor_number: newLoc.floor_number,
              room_number: newLoc.room_number,
              zone_category: newLoc.zone_category,
              gps_latitude: newLoc.gps_latitude || 16.8456,
              gps_longitude: newLoc.gps_longitude || 74.6012,
              fixture_id: newLoc.fixture_id,
              x_coord: newLoc.x_coord || 200,
              y_coord: newLoc.y_coord || 150,
            },
            { onConflict: 'location_id' }
          );

          if (error) {
            console.warn('Supabase location upsert warning:', error);
            return false;
          }
          return true;
        } catch (err) {
          console.warn('Supabase location error:', err);
          return false;
        }
      }

      return true;
    },
    []
  );

  // Add / Register multiple Campus Locations in batch
  const addCampusLocations = useCallback(
    async (newLocs: CampusLocation[]): Promise<boolean> => {
      if (newLocs.length === 0) return true;

      // 1. Update local reactive state
      setLocations((prev) => {
        const newIds = new Set(newLocs.map((l) => l.location_id));
        const filtered = prev.filter((l) => !newIds.has(l.location_id));
        const updated = [...newLocs, ...filtered];
        try {
          localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
        return updated;
      });

      // 2. Persist to Supabase database
      if (isSupabaseConfigured && supabase) {
        try {
          const rows = newLocs.map((newLoc) => ({
            location_id: newLoc.location_id,
            building_name: newLoc.building_name,
            floor_number: newLoc.floor_number,
            room_number: newLoc.room_number,
            zone_category: newLoc.zone_category,
            gps_latitude: newLoc.gps_latitude || 16.8456,
            gps_longitude: newLoc.gps_longitude || 74.6012,
            fixture_id: newLoc.fixture_id || '',
            x_coord: newLoc.x_coord || 200,
            y_coord: newLoc.y_coord || 150,
          }));

          const { error } = await supabase
            .from('campus_locations')
            .upsert(rows, { onConflict: 'location_id' });

          if (error) {
            console.warn('Supabase batch locations upsert notice:', error);
          }
        } catch (err) {
          console.warn('Supabase batch location error:', err);
        }
      }

      return true;
    },
    []
  );

  // Update location spatial coordinates (x_coord, y_coord) on the interactive canvas
  const updateLocationCoords = useCallback(
    async (locationId: string, x: number, y: number): Promise<boolean> => {
      setLocations((prev) => {
        const updated = prev.map((l) =>
          l.location_id === locationId ? { ...l, x_coord: x, y_coord: y } : l
        );
        try {
          localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase
            .from('campus_locations')
            .update({ x_coord: x, y_coord: y })
            .eq('location_id', locationId);
        } catch (e) {
          console.warn('Supabase coords update notice:', e);
        }
      }
      return true;
    },
    []
  );

  // Delete / Remove a single Campus Location
  const deleteCampusLocation = useCallback(
    async (locationId: string): Promise<boolean> => {
      setLocations((prev) => {
        const updated = prev.filter((l) => l.location_id !== locationId);
        try {
          localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('campus_locations').delete().eq('location_id', locationId);
        } catch (e) {
          console.warn('Supabase location delete error:', e);
        }
      }
      return true;
    },
    []
  );

  // Delete all locations in a building
  const deleteCampusLocationsByBuilding = useCallback(
    async (buildingName: string): Promise<boolean> => {
      setLocations((prev) => {
        const updated = prev.filter((l) => l.building_name !== buildingName);
        try {
          localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('campus_locations').delete().eq('building_name', buildingName);
        } catch (e) {
          console.warn('Supabase building delete error:', e);
        }
      }
      return true;
    },
    []
  );

  // Delete all locations on a specific floor of a building
  const deleteCampusLocationsByFloor = useCallback(
    async (buildingName: string, floorNumber: number): Promise<boolean> => {
      setLocations((prev) => {
        const updated = prev.filter(
          (l) => !(l.building_name === buildingName && l.floor_number === floorNumber)
        );
        try {
          localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase
            .from('campus_locations')
            .delete()
            .eq('building_name', buildingName)
            .eq('floor_number', floorNumber);
        } catch (e) {
          console.warn('Supabase floor delete error:', e);
        }
      }
      return true;
    },
    []
  );

  // Submit report with Smart Duplicate Clustering & Supabase Ingestion
  const submitReport = useCallback(
    (params: {
      locationId: string;
      category: IncidentCategory;
      userPhotoUrl?: string;
      voiceTranscript?: string;
      voiceAudioUrl?: string;
      aiVisionTags?: string[];
    }): { ticket: IncidentTicket; isDuplicate: boolean } => {
      const {
        locationId,
        category,
        userPhotoUrl,
        voiceTranscript,
        voiceAudioUrl,
        aiVisionTags = [],
      } = params;

      const loc = locations.find((l) => l.location_id === locationId) || {
        location_id: locationId,
        building_name: 'Campus Building',
        floor_number: 1,
        room_number: locationId,
        zone_category: 'CLASSROOM',
        gps_latitude: 16.8456,
        gps_longitude: 74.6012,
      };

      // Check for existing active ticket at same location that is currently unresolved
      let existingIndex = tickets.findIndex(
        (t) =>
          t.location_id === locationId &&
          t.status !== 'RESOLVED' &&
          t.category === category
      );

      if (existingIndex === -1) {
        existingIndex = tickets.findIndex(
          (t) => t.location_id === locationId && t.status !== 'RESOLVED'
        );
      }

      if (existingIndex !== -1) {
        // Smart duplicate clustering
        const existing = tickets[existingIndex];
        const newDupCount = (existing.duplicate_count || 1) + 1;
        const updatedSeverity = calculateAISeverity(
          existing.category,
          newDupCount,
          !!(existing.voice_transcript || voiceTranscript),
          !!(existing.user_photo_url || userPhotoUrl)
        );

        console.log(
          `⚡ Clustering duplicate incident at ${locationId}: Previous count=${existing.duplicate_count}, New count=${newDupCount}, Severity=${updatedSeverity}`
        );

        const updatedTicket: IncidentTicket = {
          ...existing,
          duplicate_count: newDupCount,
          ai_severity_score: updatedSeverity,
          voice_transcript: voiceTranscript || existing.voice_transcript,
          user_photo_url: userPhotoUrl || existing.user_photo_url,
          ai_vision_tags: Array.from(new Set([...(existing.ai_vision_tags || []), ...aiVisionTags])),
        };

        setTickets((prev) => {
          const next = [...prev];
          next[existingIndex] = updatedTicket;
          return next;
        });

        // Sync update to Supabase
        if (isSupabaseConfigured && supabase) {
          supabase
            .from('incident_tickets')
            .update({
              duplicate_count: newDupCount,
              ai_severity_score: updatedSeverity,
              voice_transcript: updatedTicket.voice_transcript,
              user_photo_url: updatedTicket.user_photo_url,
              ai_vision_tags: updatedTicket.ai_vision_tags,
            })
            .eq('ticket_id', existing.ticket_id)
            .then(({ error }) => {
              if (error) console.warn('Supabase duplicate update notice:', error);
            });
        }

        return { ticket: updatedTicket, isDuplicate: true };
      }

      // Create new ticket
      const initialScore = calculateAISeverity(
        category,
        1,
        !!voiceTranscript,
        !!userPhotoUrl
      );

      const newTicket: IncidentTicket = {
        ticket_id: `tick-${Date.now().toString().slice(-6)}`,
        location_id: locationId,
        location: loc,
        category,
        ai_severity_score: initialScore,
        status: 'REPORTED',
        duplicate_count: 1,
        voice_transcript: voiceTranscript,
        voice_audio_url: voiceAudioUrl,
        user_photo_url: userPhotoUrl,
        ai_vision_tags: aiVisionTags.length > 0 ? aiVisionTags : ['unverified_defect'],
        reported_at: new Date().toISOString(),
      };

      setTickets((prev) => [newTicket, ...prev]);

      // Insert into Supabase (ensuring location exists first to satisfy foreign key constraint)
      if (isSupabaseConfigured && supabase) {
        supabase
          .from('campus_locations')
          .upsert(
            {
              location_id: loc.location_id,
              building_name: loc.building_name,
              floor_number: loc.floor_number,
              room_number: loc.room_number,
              zone_category: loc.zone_category,
              gps_latitude: loc.gps_latitude || 16.8456,
              gps_longitude: loc.gps_longitude || 74.6012,
              fixture_id: loc.fixture_id,
              x_coord: loc.x_coord || 200,
              y_coord: loc.y_coord || 150,
            },
            { onConflict: 'location_id' }
          )
          .then(() => {
            return supabase!
              .from('incident_tickets')
              .insert({
                ticket_id: newTicket.ticket_id,
                location_id: newTicket.location_id,
                category: newTicket.category,
                ai_severity_score: newTicket.ai_severity_score,
                status: newTicket.status,
                duplicate_count: 1,
                voice_transcript: newTicket.voice_transcript,
                voice_audio_url: newTicket.voice_audio_url,
                user_photo_url: newTicket.user_photo_url,
                ai_vision_tags: newTicket.ai_vision_tags,
                reported_at: newTicket.reported_at,
              });
          })
          .then(({ error }: any) => {
            if (error) console.warn('Supabase ticket insert notice:', error);
          });

        // Also record media attachment if photo is provided
        if (newTicket.user_photo_url) {
          supabase
            .from('incident_media')
            .insert({
              ticket_id: newTicket.ticket_id,
              media_type: 'USER_PHOTO',
              file_url: newTicket.user_photo_url,
              ai_vision_tags: newTicket.ai_vision_tags,
            })
            .then(({ error }) => {
              if (error) console.warn('Supabase media insert notice:', error);
            });
        }
      }

      return { ticket: newTicket, isDuplicate: false };
    },
    [tickets, locations]
  );

  // Dispatch work order to maintenance staff (via WhatsApp/SMS)
  const dispatchStaff = useCallback(
    (ticketId: string, staffId: string) => {
      const staffMember = staffList.find((s) => s.staff_id === staffId);
      const dispatchedAt = new Date().toISOString();

      setTickets((prev) =>
        prev.map((t) =>
          t.ticket_id === ticketId
            ? {
                ...t,
                status: 'DISPATCHED',
                assigned_staff_id: staffId,
                assigned_staff: staffMember,
                dispatched_at: dispatchedAt,
              }
            : t
        )
      );

      // Sync dispatch to Supabase
      if (isSupabaseConfigured && supabase) {
        supabase
          .from('incident_tickets')
          .update({
            status: 'DISPATCHED',
            assigned_staff_id: staffId,
            dispatched_at: dispatchedAt,
          })
          .eq('ticket_id', ticketId)
          .then(({ error }) => {
            if (error) console.warn('Supabase dispatch update notice:', error);
          });

        // Trigger Automated WhatsApp / SMS Edge Function Alert
        const targetTicket = tickets.find((t) => t.ticket_id === ticketId);
        if (targetTicket && staffMember) {
          supabase.functions
            .invoke('dispatch-alert', {
              body: {
                type: 'WORK_ORDER_DISPATCH',
                ticketId,
                location: `${targetTicket.location?.building_name || 'Campus Building'}, Floor ${targetTicket.location?.floor_number || 1}, Room ${targetTicket.location?.room_number || ''}`,
                category: targetTicket.category,
                severityScore: targetTicket.ai_severity_score,
                phone: staffMember.phone_number,
                staffName: staffMember.full_name,
                duplicateCount: targetTicket.duplicate_count,
                notes: targetTicket.voice_transcript || 'Immediate maintenance response requested.',
                uploadUrl: `${window.location.origin}/maintenance?ticket=${ticketId}`,
              },
            })
            .then(({ data, error }) => {
              if (error) {
                console.warn('Notice: Edge function dispatch alert (fallback active):', error);
              } else {
                console.log('⚡ Edge Function dispatch alert delivered:', data);
              }
            });
        }
      }
    },
    [staffList, tickets]
  );

  // Mark ticket as resolved with fixed photo proof
  const resolveTicket = useCallback((ticketId: string, fixedPhotoUrl?: string) => {
    const resolvedAt = new Date().toISOString();
    const finalPhoto = fixedPhotoUrl || '';

    setTickets((prev) =>
      prev.map((t) =>
        t.ticket_id === ticketId
          ? {
              ...t,
              status: 'RESOLVED',
              resolved_at: resolvedAt,
              fixed_photo_url: finalPhoto,
            }
          : t
      )
    );

    // Sync resolution to Supabase
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('incident_tickets')
        .update({
          status: 'RESOLVED',
          resolved_at: resolvedAt,
          fixed_photo_url: finalPhoto,
        })
        .eq('ticket_id', ticketId)
        .then(({ error }) => {
          if (error) console.warn('Supabase resolve update notice:', error);
        });

      if (finalPhoto) {
        supabase
          .from('incident_media')
          .insert({
            ticket_id: ticketId,
            media_type: 'FIXED_PHOTO',
            file_url: finalPhoto,
            ai_vision_tags: ['repair_verified'],
          })
          .then(({ error }) => {
            if (error) console.warn('Supabase fixed media insert notice:', error);
          });
      }
    }
  }, []);

  // Find active ticket for a spot QR code
  const getActiveSpotTicket = useCallback(
    (locationId: string): IncidentTicket | undefined => {
      return tickets.find((t) => t.location_id === locationId);
    },
    [tickets]
  );

  // Add / Register a new Maintenance Staff member (Admin Permission)
  const addMaintenanceStaff = useCallback(
    async (
      staffData: Omit<MaintenanceStaff, 'staff_id'> & { staff_id?: string; passcode?: string }
    ): Promise<boolean> => {
      const newStaff: MaintenanceStaff = {
        staff_id: staffData.staff_id || `staff-${Date.now().toString().slice(-6)}`,
        full_name: staffData.full_name.trim(),
        specialization: staffData.specialization,
        phone_number: staffData.phone_number.trim(),
        is_on_duty: staffData.is_on_duty ?? true,
        passcode: staffData.passcode?.trim() || '1234',
      };

      // 1. Update local reactive state
      setStaffList((prev) => {
        const filtered = prev.filter((s) => s.staff_id !== newStaff.staff_id);
        const updated = [...filtered, newStaff];
        try {
          localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      // 2. Persist to Supabase database
      if (isSupabaseConfigured && supabase) {
        try {
          const { error } = await supabase.from('maintenance_staff').upsert(
            {
              staff_id: newStaff.staff_id,
              full_name: newStaff.full_name,
              specialization: newStaff.specialization,
              phone_number: newStaff.phone_number,
              is_on_duty: newStaff.is_on_duty,
              passcode: newStaff.passcode,
            },
            { onConflict: 'staff_id' }
          );

          if (error) {
            console.warn('Supabase staff upsert notice:', error);
            // Fallback without passcode column if not migrated
            if (error.message?.includes('passcode')) {
              await supabase.from('maintenance_staff').upsert({
                staff_id: newStaff.staff_id,
                full_name: newStaff.full_name,
                specialization: newStaff.specialization,
                phone_number: newStaff.phone_number,
                is_on_duty: newStaff.is_on_duty,
              });
            }
          }
          return true;
        } catch (err) {
          console.warn('Supabase staff error:', err);
          return true;
        }
      }

      return true;
    },
    []
  );

  // Toggle on-duty status of a maintenance staff member
  const toggleStaffDuty = useCallback(
    async (staffId: string, isOnDuty: boolean): Promise<boolean> => {
      setStaffList((prev) => {
        const updated = prev.map((s) =>
          s.staff_id === staffId ? { ...s, is_on_duty: isOnDuty } : s
        );
        try {
          localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase
            .from('maintenance_staff')
            .update({ is_on_duty: isOnDuty })
            .eq('staff_id', staffId);
        } catch (e) {
          console.warn('Error updating duty status in Supabase', e);
        }
      }
      return true;
    },
    []
  );

  // Delete / Remove a maintenance staff member
  const deleteMaintenanceStaff = useCallback(
    async (staffId: string): Promise<boolean> => {
      setStaffList((prev) => {
        const updated = prev.filter((s) => s.staff_id !== staffId);
        try {
          localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('maintenance_staff').delete().eq('staff_id', staffId);
        } catch (e) {
          console.warn('Error deleting staff from Supabase', e);
        }
      }
      return true;
    },
    []
  );

  return {
    tickets,
    isLoading,
    isSupabaseConnected: isSupabaseConfigured,
    campusLocations: locations,
    maintenanceStaff: staffList,
    addCampusLocation,
    addCampusLocations,
    deleteCampusLocation,
    deleteCampusLocationsByBuilding,
    deleteCampusLocationsByFloor,
    updateLocationCoords,
    addMaintenanceStaff,
    toggleStaffDuty,
    deleteMaintenanceStaff,
    submitReport,
    dispatchStaff,
    resolveTicket,
    getActiveSpotTicket,
  };
}
