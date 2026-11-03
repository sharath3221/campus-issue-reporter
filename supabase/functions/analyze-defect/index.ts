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

ABSOLUTE PROHIBITION ON SELFIES, PORTRAITS, AND FACES:
1. DOES THE PHOTO SHOW A HUMAN FACE, PERSON, STUDENT, SELFIE, OR BODY?
   - If YES, you MUST IMMEDIATELY REJECT the submission with "is_genuine": false!
   - You MUST NOT inspect the background, wall, floor, or room behind the person!
   - Even if the person is standing in front of a wall, door, or fixture, ANY PHOTO CONTAINING A PERSON OR SELFIE IS STRICTLY NON-GENUINE.
   - Rejection Reason: "Photo contains a selfie or person. Facility reports must show only the physical defect, without people."
   - Set "severity_score": 1.0 and tags: ["selfie_detected", "personal_portrait", "no_facility_defect"].

2. WALL DEFECT CRITERIA:
   - Plain painted walls, normal clean walls, wall shadows, or minor cosmetic paint variations ARE NOT DEFECTS!
   - Do NOT report defects on walls unless there is active water bursting, heavy black mold, or a massive structural fissure/hole.
   - If a photo depicts an ordinary wall or a person in front of a wall, set "is_genuine": false!

3. GENUINE CAMPUS DEFECTS (ONLY when NO person is in photo):
   Leaking pipes, broken taps, broken flush, flooded/unhygienic restrooms, damp walls with heavy mold, broken tiles, broken fans, flickering/dead lights, hanging wires, damaged electrical sockets, broken projectors, dirty washrooms, uncleaned litter, clogged drains, broken desks, fractured chairs, cracked doors, loose blackboard, damaged benches, or physical structural damage in an educational campus.

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

    const PERSON_PATTERNS = [
      'selfie',
      'face',
      'person',
      'human',
      'portrait',
      'headshot',
      'student',
      'people',
      'man',
      'woman',
      'boy',
      'girl',
      'posing',
      'individual',
      'personal_photo',
      'personal_portrait',
      'smile',
      'smiling',
      'skin',
    ];

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
      'plain_wall',
      'normal_wall',
      'wall_background',
    ];

    const rawTags = Array.isArray(parsed.defect_tags)
      ? parsed.defect_tags.map((t: string) => t.toLowerCase().replace(/\s+/g, '_'))
      : ['defect_detected', 'urgent_inspection'];

    const hasPersonTag = rawTags.some((t: string) =>
      PERSON_PATTERNS.some((p) => t === p || t.includes(`_${p}`) || t.includes(`${p}_`))
    );

    const hasInvalidTag = rawTags.some((t: string) =>
      INVALID_PATTERNS.some((bad) => t.includes(bad))
    );

    const summary = String(parsed.summary || '');
    const sumLower = summary.toLowerCase();
    const rejLower = String(parsed.rejection_reason || '').toLowerCase();

    const hasPersonInText =
      sumLower.includes('selfie') ||
      sumLower.includes('portrait') ||
      sumLower.includes('person') ||
      sumLower.includes('human face') ||
      sumLower.includes('student') ||
      sumLower.includes('face') ||
      rejLower.includes('selfie') ||
      rejLower.includes('person') ||
      rejLower.includes('portrait') ||
      rejLower.includes('face');

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
      sumLower.includes('normal condition') ||
      sumLower.includes('wall in the background') ||
      sumLower.includes('plain wall');

    let isGenuine =
      parsed.is_genuine === true &&
      !hasPersonTag &&
      !hasPersonInText &&
      !hasInvalidTag &&
      !hasNoDefectSummary;

    let rejectionReason = parsed.rejection_reason;

    if (!isGenuine && (!rejectionReason || !rejectionReason.trim())) {
      if (hasPersonTag || hasPersonInText) {
        rejectionReason =
          'Photo contains a selfie, human face, or person. Campus facility reports must photograph only the physical defect, without people.';
      } else {
        rejectionReason = summary || 'Photo rejected: No visible physical facility defect or damage detected.';
      }
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

