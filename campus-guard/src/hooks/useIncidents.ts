import { useState, useEffect, useCallback } from 'react';
import {
  IncidentTicket,
  IncidentCategory,
  TicketStatus,
  CampusLocation,
  MaintenanceStaff,
} from '../types';
import {
  campusLocations,
  maintenanceStaff,
  initialIncidentTickets,
} from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const STORAGE_KEY = 'campuspulse_tickets_v1';

export function useIncidents() {
  const [tickets, setTickets] = useState<IncidentTicket[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed reading tickets from localStorage', e);
    }
    return initialIncidentTickets;
  });

  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);

  // Sync to localStorage as client cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
    } catch (e) {
      console.error('Failed writing tickets to localStorage', e);
    }
  }, [tickets]);

  // Fetch from Supabase and subscribe to Realtime if configured
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let isMounted = true;

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
          console.error('Supabase fetch error, using local cached tickets:', error);
          return;
        }

        if (data && isMounted && data.length > 0) {
          const mapped: IncidentTicket[] = data.map((row: any) => ({
            ticket_id: row.ticket_id,
            location_id: row.location_id,
            location: row.location || campusLocations.find((l) => l.location_id === row.location_id),
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
            assigned_staff: row.assigned_staff || maintenanceStaff.find((s) => s.staff_id === row.assigned_staff_id),
            reported_at: row.reported_at,
            dispatched_at: row.dispatched_at,
            resolved_at: row.resolved_at,
          }));

          setTickets(mapped);
        }
      } catch (err) {
        console.error('Failed to load tickets from Supabase:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchSupabaseTickets();

    // Supabase Realtime Subscription (§5)
    const channel = supabase!
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
                location: campusLocations.find((l) => l.location_id === newRow.location_id),
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
                assigned_staff: maintenanceStaff.find((s) => s.staff_id === newRow.assigned_staff_id),
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
                      assigned_staff_id: updated.assigned_staff_id || t.assigned_staff_id,
                      assigned_staff:
                        maintenanceStaff.find((s) => s.staff_id === updated.assigned_staff_id) ||
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

    return () => {
      isMounted = false;
      supabase!.removeChannel(channel);
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

      const loc = campusLocations.find((l) => l.location_id === locationId) || {
        location_id: locationId,
        building_name: 'Campus Building',
        floor_number: 1,
        room_number: locationId,
        zone_category: 'CLASSROOM',
        gps_latitude: 16.8456,
        gps_longitude: 74.6012,
      };

      // Check for existing active ticket at same location within 30 minutes
      const existingIndex = tickets.findIndex(
        (t) =>
          t.location_id === locationId &&
          t.status !== 'RESOLVED' &&
          Date.now() - new Date(t.reported_at).getTime() < 30 * 60 * 1000
      );

      if (existingIndex !== -1) {
        // Smart duplicate clustering
        const existing = tickets[existingIndex];
        const newDupCount = existing.duplicate_count + 1;
        const updatedSeverity = calculateAISeverity(
          existing.category,
          newDupCount,
          !!(existing.voice_transcript || voiceTranscript),
          !!(existing.user_photo_url || userPhotoUrl)
        );

        const updatedTicket: IncidentTicket = {
          ...existing,
          duplicate_count: newDupCount,
          ai_severity_score: updatedSeverity,
          voice_transcript: voiceTranscript || existing.voice_transcript,
          user_photo_url: userPhotoUrl || existing.user_photo_url,
          ai_vision_tags: Array.from(new Set([...existing.ai_vision_tags, ...aiVisionTags])),
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
              if (error) console.error('Supabase duplicate update error:', error);
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
        ticket_id: `tick-${Date.now().toString().slice(-5)}`,
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

      // Insert into Supabase
      if (isSupabaseConfigured && supabase) {
        supabase
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
          })
          .then(({ error }) => {
            if (error) console.error('Supabase ticket insert error:', error);
          });
      }

      return { ticket: newTicket, isDuplicate: false };
    },
    [tickets]
  );

  // Dispatch work order to maintenance staff (via WhatsApp/SMS)
  const dispatchStaff = useCallback(
    (ticketId: string, staffId: string) => {
      const staffMember = maintenanceStaff.find((s) => s.staff_id === staffId);
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
            if (error) console.error('Supabase dispatch update error:', error);
          });
      }
    },
    []
  );

  // Mark ticket as resolved with fixed photo proof
  const resolveTicket = useCallback((ticketId: string, fixedPhotoUrl?: string) => {
    const resolvedAt = new Date().toISOString();
    const finalPhoto =
      fixedPhotoUrl ||
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80';

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
          if (error) console.error('Supabase resolve update error:', error);
        });
    }
  }, []);

  // Find active ticket for a spot QR code
  const getActiveSpotTicket = useCallback(
    (locationId: string): IncidentTicket | undefined => {
      return tickets.find((t) => t.location_id === locationId);
    },
    [tickets]
  );

  return {
    tickets,
    isLoading,
    isSupabaseConnected: isSupabaseConfigured,
    campusLocations,
    maintenanceStaff,
    submitReport,
    dispatchStaff,
    resolveTicket,
    getActiveSpotTicket,
  };
}
