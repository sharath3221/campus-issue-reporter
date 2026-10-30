// Supabase Edge Function: analyze-defect
// Secure Server-Side Multimodal AI Computer Vision Proxy using Google Gemini 2.5 Flash
// Hides GEMINI_API_KEY inside Supabase Secrets so client browsers never see it.

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageDataUrl, category = 'FACILITY_DEFECT' } = await req.json();

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing imageDataUrl in request payload.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not configured in Supabase Secrets.');
      return new Response(
        JSON.stringify({
          error: 'GEMINI_API_KEY secret is not set in Supabase. Run: supabase secrets set GEMINI_API_KEY=your_key',
          fallbackNeeded: true,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract Base64 and MIME Type from Data URL
    let mimeType = 'image/jpeg';
    let base64Data = imageDataUrl;

    if (imageDataUrl.includes('data:') && imageDataUrl.includes(',')) {
      const [header, data] = imageDataUrl.split(',');
      const match = header.match(/:(.*?);/);
      if (match) mimeType = match[1];
      base64Data = data;
    }

    const prompt = `You are the AI inspection engine for CampusPulse (a university facility defect reporting system).
Reporter Category: ${category}.
Analyze this photo taken on campus. Detect all physical defects, hazards, leakages, or damage.
Return ONLY valid JSON matching this schema:
{
  "defect_tags": ["defect_tag_1", "defect_tag_2", "defect_tag_3"],
  "severity_score": 8.5,
  "summary": "1-sentence concise defect diagnosis."
}`;

    // 1. Call Gemini 2.5 Flash
    let geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64Data } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json',
          },
        }),
      }
    );

    // 2. Fallback to gemini-flash-latest if needed
    if (!geminiRes.ok) {
      console.warn('Gemini 2.5 flash returned status:', geminiRes.status, 'Retrying with gemini-flash-latest...');
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType, data: base64Data } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              response_mime_type: 'application/json',
            },
          }),
        }
      );
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API Error:', errText);
      return new Response(
        JSON.stringify({ error: 'Gemini API call failed', details: errText, fallbackNeeded: true }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await geminiRes.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Empty response from Gemini vision model.');
    }

    const cleanJson = rawText.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    const result = {
      tags: Array.isArray(parsed.defect_tags)
        ? parsed.defect_tags.map((t: string) => t.toLowerCase().replace(/\s+/g, '_'))
        : ['defect_detected', 'urgent_inspection'],
      severityScore: Number(parsed.severity_score) || 8.0,
      summary: parsed.summary || 'Defect verified by Gemini 2.5 Flash Vision.',
      isRealAI: true,
      modelUsed: 'Google Gemini 2.5 Flash (Supabase Edge Proxy)',
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Edge Function Exception:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal error processing vision analysis.',
        fallbackNeeded: true,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

