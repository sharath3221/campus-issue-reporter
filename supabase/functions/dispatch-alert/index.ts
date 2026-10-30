// Supabase Edge Function: dispatch-alert
// Automated Multi-Channel Work Order Dispatcher (WhatsApp Cloud API / Twilio SMS / Webhooks)
// Triggered on work order dispatch or critical emergency defect insertion (>80 urgency)

import { corsHeaders } from '../_shared/cors.ts';

interface DispatchPayload {
  type?: 'WORK_ORDER_DISPATCH' | 'EMERGENCY_ALERT';
  ticketId: string;
  location: string;
  category: string;
  severityScore: number;
  phone: string;
  staffName?: string;
  duplicateCount?: number;
  notes?: string;
  uploadUrl?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: DispatchPayload = await req.json();

    const {
      ticketId,
      location,
      category,
      severityScore,
      phone,
      staffName = 'Technician',
      duplicateCount = 1,
      notes = 'Immediate inspection required',
      uploadUrl,
    } = payload;

    if (!ticketId || !phone) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: ticketId and phone are mandatory.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messageText =
      `🚨 *CampusPulse Job Dispatch* (Priority ${severityScore}/100)\n` +
      `• Location: ${location}\n` +
      `• Category: ${category}\n` +
      `• Assigned To: ${staffName}\n` +
      `• Reports Clustered: ${duplicateCount} students/staff\n` +
      `• Notes: ${notes}\n\n` +
      (uploadUrl ? `📸 *Submit Fixed Photo Proof when done:*\n${uploadUrl}` : '');

    // 1. Meta WhatsApp Cloud API (if configured)
    const waToken = Deno.env.get('WHATSAPP_API_TOKEN')?.trim();
    const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')?.trim();

    if (waToken && waPhoneId) {
      try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const waRes = await fetch(
          `https://graph.facebook.com/v18.0/${waPhoneId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${waToken}`,
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: cleanPhone,
              type: 'text',
              text: { body: messageText },
            }),
          }
        );

        if (waRes.ok) {
          const resData = await waRes.json();
          console.log('✅ Meta WhatsApp Message Delivered:', resData);
          return new Response(
            JSON.stringify({ success: true, provider: 'whatsapp_cloud_api', response: resData }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.warn('Meta WhatsApp API returned error, checking Twilio fallback...');
        }
      } catch (waErr) {
        console.warn('Meta WhatsApp API error:', waErr);
      }
    }

    // 2. Twilio SMS / WhatsApp (if configured)
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')?.trim();
    const twilioAuth = Deno.env.get('TWILIO_AUTH_TOKEN')?.trim();
    const twilioFrom = Deno.env.get('TWILIO_PHONE_NUMBER')?.trim();

    if (twilioSid && twilioAuth && twilioFrom) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const bodyParams = new URLSearchParams({
          To: phone,
          From: twilioFrom,
          Body: messageText,
        });

        const twilioRes = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
          },
          body: bodyParams.toString(),
        });

        if (twilioRes.ok) {
          const resData = await twilioRes.json();
          console.log('✅ Twilio SMS/WhatsApp Message Delivered:', resData);
          return new Response(
            JSON.stringify({ success: true, provider: 'twilio', response: resData }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (twilioErr) {
        console.warn('Twilio dispatch error:', twilioErr);
      }
    }

    // 3. Fallback: Log and return success status
    // Enables the system to operate smoothly even before live SMS gateway accounts are provisioned
    console.log(`⚡ [AUTOMATED DISPATCH LOG] To: ${phone} (${staffName})\n${messageText}`);

    return new Response(
      JSON.stringify({
        success: true,
        simulated: true,
        provider: 'cloud_log',
        notice:
          'Dispatch recorded in Supabase Edge Functions. To send live SMS or WhatsApp messages, set WHATSAPP_API_TOKEN or TWILIO_ACCOUNT_SID in Supabase Secrets.',
        ticketId,
        recipient: phone,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Edge Function Exception in dispatch-alert:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal dispatch error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
