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

    const prompt = `You are the AI verification and defect inspection authority for CampusPulse, a university facility incident reporting platform.
Reporter Category: "${category}".
Analyze the attached photo carefully.

VERIFY GENUINENESS OF REPORT:
- GENUINE CAMPUS DEFECTS (is_genuine MUST BE true):
  Leaking pipes, damaged taps, broken flush, flooded/unhygienic restrooms, damp walls, broken tiles, broken fans, flickering/dead lights, hanging wires, damaged electrical sockets, broken projectors, dirty washrooms, uncleaned litter, clogged drains, broken desks, fractured chairs, cracked doors, loose blackboard, damaged benches, or physical structural damage in an educational campus.
- NOT GENUINE (is_genuine MUST BE false):
  * NO DEFECT VISIBLE or facility is in normal clean condition.
  * Photo is TOO BLURRY, OUT OF FOCUS, UNCLEAR, or OBSCURED to detect specific defects.
  * Selfies, faces, personal portraits, memes, cartoons, screenshots of apps/phones.
  * Random unrelated objects (food, drinks, pets, animals, vehicles, clothes, shoes, personal gadgets).
  * Blank, black, or white screens.

CRITICAL ENFORCEMENT RULES:
1. If NO DEFECT is visible or if the photo is blurry, dark, or out of focus:
   - You MUST set "is_genuine": false!
   - You MUST state the exact rejection reason in "rejection_reason"!
   - Set "severity_score": 1.0!
2. ONLY set "is_genuine": true if an ACTUAL PHYSICAL DEFECT or DAMAGE is clearly visible.
3. If you use tags like "no_detectable_defects", "image_unclear", "no_defect", "blurry", "intact", "normal_condition", "is_genuine" MUST BE false!

Return ONLY valid JSON matching this schema:
{
  "is_genuine": true or false,
  "rejection_reason": "Specific clear reason if not genuine (or empty string if genuine)",
  "defect_tags": ["defect_tag_1", "defect_tag_2", "defect_tag_3"],
  "severity_score": 8.5,
  "summary": "1-sentence concise defect diagnosis or verification finding"
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

    const INVALID_PATTERNS = [
      'no_detectable_defects',
      'no_detectable_defect',
      'no_defect_detected',
      'no_defects_detected',
      'no_defect',
      'no_defects',
      'no_damage',
      'no_issue',
      'no_fault',
      'image_unclear',
      'blurry',
      'too_blurry',
      'out_of_focus',
      'unclear_image',
      'unidentifiable',
      'insufficient_details',
      'normal_condition',
      'not_damaged',
      'working_properly',
    ];

    const rawTags = Array.isArray(parsed.defect_tags)
      ? parsed.defect_tags.map((t: string) => t.toLowerCase().replace(/\s+/g, '_'))
      : ['defect_detected', 'urgent_inspection'];

    const hasInvalidTag = rawTags.some((t: string) =>
      INVALID_PATTERNS.some((bad) => t.includes(bad))
    );

    const summary = String(parsed.summary || '');
    const sumLower = summary.toLowerCase();
    const hasNoDefectSummary =
      sumLower.includes('no detectable defect') ||
      sumLower.includes('no specific physical defect') ||
      sumLower.includes('no physical defect') ||
      sumLower.includes('no defect') ||
      sumLower.includes('no visible damage') ||
      sumLower.includes('no damage') ||
      sumLower.includes('too blurry') ||
      sumLower.includes('out of focus') ||
      sumLower.includes('unable to detect') ||
      sumLower.includes('cannot detect') ||
      sumLower.includes('normal condition');

    let isGenuine = parsed.is_genuine === true && !hasInvalidTag && !hasNoDefectSummary;
    let rejectionReason = parsed.rejection_reason;

    if (!isGenuine && (!rejectionReason || !rejectionReason.trim())) {
      rejectionReason = summary || 'Photo rejected: No visible physical facility defect or damage detected.';
    }

    const result = {
      is_genuine: isGenuine,
      rejection_reason: !isGenuine ? rejectionReason : undefined,
      tags: rawTags,
      severityScore: isGenuine ? Number(parsed.severity_score) || 8.0 : 1.0,
      summary: summary || (isGenuine ? 'Defect verified by Gemini 2.5 Flash Vision.' : 'Report rejected by AI verification.'),
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

