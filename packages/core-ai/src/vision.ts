import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, MODEL, MAX_TOKENS, calculateUsage, extractJson } from './client';
import type { AiCallResult } from './client';

// =============================================================================
// AI VISION — OmniBid / Core
//
// Two vision use cases:
//
//  1. NAMEPLATE OCR — Tech photos an equipment nameplate on-site.
//     Claude extracts structured data: make, model, serial, refrigerant, etc.
//     This pre-fills the CustomerAsset record without manual typing.
//
//  2. JOB PHOTO ANALYSIS — Before/after photos analyzed for report generation.
//     Describes what the photo shows in plain English for the completion report.
//
// Both functions accept base64-encoded images.
// Supported: JPEG, PNG, WEBP, HEIC (converted to JPEG server-side before sending)
// =============================================================================

// ─── Nameplate OCR ────────────────────────────────────────────────────────────

export interface NameplateData {
  make:              string | null;
  model:             string | null;
  serial_number:     string | null;
  manufacture_date:  string | null;   // "MM/YYYY" or "YYYY" format
  refrigerant_type:  string | null;   // "R-410A", "R-22", etc.
  refrigerant_charge: string | null;  // e.g. "3.5 lbs"
  voltage:           string | null;   // e.g. "208-230V"
  amperage:          string | null;
  btu_capacity:      string | null;
  efficiency_rating: string | null;   // SEER, EER, AFUE
  raw_text:          string;          // full OCR text for the notes field
  confidence:        'high' | 'medium' | 'low';
  unreadable_fields: string[];        // fields that were present but unreadable
}

export async function extractNameplateData(
  imageBase64: string,
  mediaType:   'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<AiCallResult<NameplateData>> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 1024,
    system:     `You extract structured data from HVAC and equipment nameplate photos.
These photos are frequently degraded: greasy, blurry, taken in dark crawlspaces, or partially obscured.

PRIORITY RULE: raw_text is the most important field. Even if no structured fields
can be reliably extracted, return the most complete raw_text possible — partial
characters, fragments, anything legible. A tech can manually map raw text to fields
in the UI. An empty raw_text is never acceptable.

For structured fields: make your best read and populate what you can.
Mark confidence as "low" when unsure. List genuinely unreadable fields in unreadable_fields.
Never leave raw_text empty even on the worst image — transcribe whatever is visible.
Respond only in <json> tags.`,
    messages: [
      {
        role: 'user',
        content: [
          {
            type:   'image',
            source: {
              type:       'base64',
              media_type: mediaType,
              data:       imageBase64,
            },
          },
          {
            type: 'text',
            text: `Extract all nameplate data from this equipment photo.

<json>
{
  "make": "string or null",
  "model": "string or null",
  "serial_number": "string or null",
  "manufacture_date": "MM/YYYY or YYYY or null",
  "refrigerant_type": "e.g. R-410A or null",
  "refrigerant_charge": "e.g. 3.5 lbs or null",
  "voltage": "string or null",
  "amperage": "string or null",
  "btu_capacity": "string or null",
  "efficiency_rating": "e.g. 16 SEER or null",
  "raw_text": "complete transcription of all visible text",
  "confidence": "high | medium | low",
  "unreadable_fields": ["list of fields that were present but unreadable"]
}
</json>`,
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  return {
    data:  extractJson<NameplateData>(text),
    usage: calculateUsage(response.usage),
  };
}

// ─── Job Photo Description ────────────────────────────────────────────────────
//
// Generates a plain-English description of a job photo for inclusion in
// completion reports. Used for before/after documentation.

export interface PhotoDescription {
  description:   string;   // 1–2 sentences, factual, professional
  photo_type_detected: 'before' | 'after' | 'equipment' | 'general';
  notable_items: string[]; // specific things visible (damage, equipment, repairs)
}

export async function describeJobPhoto(
  imageBase64: string,
  context: {
    job_title:  string;
    photo_type: 'before' | 'during' | 'after' | 'general';
  },
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<AiCallResult<PhotoDescription>> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 512,
    system:     `You describe job site photos for trades contractor completion reports.
Be factual and professional. Note what you actually see — damage, equipment, completed work.
Do not speculate about things not visible. Respond in <json> tags only.`,
    messages: [
      {
        role: 'user',
        content: [
          {
            type:   'image',
            source: {
              type:       'base64',
              media_type: mediaType,
              data:       imageBase64,
            },
          },
          {
            type: 'text',
            text: `Job: ${context.job_title}\nExpected photo type: ${context.photo_type}\n\nDescribe what you see.\n\n<json>\n{\n  "description": "string",\n  "photo_type_detected": "before | after | equipment | general",\n  "notable_items": ["string"]\n}\n</json>`,
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  return {
    data:  extractJson<PhotoDescription>(text),
    usage: calculateUsage(response.usage),
  };
}
