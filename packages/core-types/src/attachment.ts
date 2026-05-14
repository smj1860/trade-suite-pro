import type { SourceModule } from './communication';

// ─── Attachment ───────────────────────────────────────────────────────────────
//
//  Stored in Supabase Storage. All modules share this table.
//  Photos of job sites, signed estimate PDFs, nameplate OCR scans.

export interface Attachment {
  id: string;
  org_id: string;
  job_id: string | null;
  customer_id: string | null;
  uploaded_by: string;              // user.id

  // Supabase Storage
  storage_path: string;             // bucket/org_id/job_id/filename
  storage_url: string;              // signed URL (regenerated on access)

  filename: string;
  mime_type: string;
  size_bytes: number;

  source_module: SourceModule;

  // For nameplate/OCR scans — extracted text stored here
  ocr_text: string | null;

  created_at: string;
}

export type AttachmentInsert = Omit<Attachment, 'id' | 'created_at'>;

// ─── Common MIME type helpers ─────────────────────────────────────────────────

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export const PDF_MIME_TYPE = 'application/pdf';

export function isImage(mime_type: string): boolean {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mime_type);
}
