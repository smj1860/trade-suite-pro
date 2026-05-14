import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${Deno.env.get('GOOGLE_API_KEY')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: audioBase64 } },
            { text: `Transcribe this audio recording exactly. The speaker is a contractor describing work. Include all numbers and item names verbatim. Output only the transcription.` }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
  const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  return data.candidates[0]?.content?.parts[0]?.text ?? '';
}

async function structureTranscript(
  transcript: string,
  priceBook: Array<{ id: string; name: string; unit: string; unit_price: number; aliases: string[] | null }>
): Promise<object> {
  const priceBookText = priceBook
    .map(item => `- ID:${item.id} | "${item.name}" | ${item.unit} @ $${item.unit_price}${item.aliases?.length ? ` (also: ${item.aliases.join(', ')})` : ''}`)
    .join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You parse contractor voice memos into structured estimate line items.
Price book:
${priceBookText}

Rules: Match items to the price book when possible (fuzzy matching). Set price_book_id to the matching ID or null. confidence: high/medium/low. Default quantity 1. Return ONLY valid JSON.

Response format:
{
  "title": "string",
  "items": [{"name":"string","quantity":number,"unit":"each|hour|sqft|lnft|ton|lb|ft","unit_price":number,"price_book_id":"uuid or null","confidence":"high|medium|low"}],
  "raw_transcript": "string"
}`,
      messages: [{ role: 'user', content: `Parse this transcript:\n\n"${transcript}"` }]
    }),
  });
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`);
  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = data.content.find(b => b.type === 'text')?.text ?? '{}';
  return JSON.parse(text);
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  let orgId: string;
  let audioBlob: Blob;
  let mimeType: string;

  try {
    const formData = await req.formData();
    orgId     = formData.get('org_id') as string;
    audioBlob = formData.get('audio') as Blob;
    mimeType  = audioBlob.type || 'audio/webm';
  } catch {
    return new Response('Invalid form data', { status: 400 });
  }

  const { data: member } = await supabase
    .from('users').select('id').eq('org_id', orgId).eq('id', user.id).single();
  if (!member) return new Response('Forbidden', { status: 403 });

  try {
    const audioBytes  = await audioBlob.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBytes)));

    const { data: priceBook } = await supabase
      .from('price_book').select('id, name, unit, unit_price, aliases').eq('org_id', orgId).eq('active', true);

    const transcript = await transcribeAudio(audioBase64, mimeType);
    const result     = await structureTranscript(transcript, priceBook ?? []);

    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
