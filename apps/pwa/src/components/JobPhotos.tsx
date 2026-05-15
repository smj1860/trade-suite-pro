import React, { useRef, useState } from 'react';
import { useReactiveQuery } from '@trades-saas/core-ui';
import { getSupabaseClient } from '@trades-saas/core-auth';
import type { PhotoType } from '@trades-saas/core-types';
import { PHOTO_TYPE_LABELS } from '@trades-saas/core-types';

const supabase = getSupabaseClient();

interface PhotoRow {
  id: string;
  photo_type: string;
  storage_url: string;
  filename: string;
  caption: string | null;
  storage_path: string;
  created_at: string;
}

interface JobPhotosProps {
  jobId: string;
  orgId: string;
  userId: string;
}

const PHOTO_TYPES: PhotoType[] = ['before', 'during', 'after', 'equipment', 'general'];

export function JobPhotos({ jobId, orgId, userId }: JobPhotosProps) {
  const [uploading,  setUploading]  = useState<PhotoType | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [activeType, setActiveType] = useState<PhotoType>('before');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: photos } = useReactiveQuery<PhotoRow>(
    'SELECT * FROM job_photos WHERE job_id = ? ORDER BY created_at DESC',
    [jobId]
  );

  const byType = PHOTO_TYPES.reduce<Record<PhotoType, PhotoRow[]>>((acc, t) => {
    acc[t] = photos.filter(p => p.photo_type === t);
    return acc;
  }, {} as Record<PhotoType, PhotoRow[]>);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(activeType);
    setError(null);

    try {
      const ext      = file.name.split('.').pop() ?? 'jpg';
      const filename = `${orgId}/${jobId}/${activeType}-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('job-photos')
        .upload(filename, file, { contentType: file.type, upsert: false });

      if (uploadErr) throw new Error(uploadErr.message);

      const { data: urlData } = await supabase.storage
        .from('job-photos')
        .createSignedUrl(filename, 31536000);

      if (!urlData?.signedUrl) throw new Error('Could not get photo URL');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('job_photos') as any).insert({
        org_id:            orgId,
        job_id:            jobId,
        uploaded_by:       userId,
        photo_type:        activeType,
        storage_path:      filename,
        storage_url:       urlData.signedUrl,
        filename:          file.name,
        mime_type:         file.type,
        size_bytes:        file.size,
        include_in_report: activeType === 'before' || activeType === 'after' ? 1 : 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(photo: PhotoRow) {
    await supabase.storage.from('job-photos').remove([photo.storage_path]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('job_photos') as any).delete().eq('id', photo.id);
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Type tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none">
        {PHOTO_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`shrink-0 text-field-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
              activeType === t
                ? 'bg-brand text-white'
                : 'text-content-secondary hover:text-content hover:bg-surface-raised'
            }`}
          >
            {PHOTO_TYPE_LABELS[t]} ({byType[t].length})
          </button>
        ))}
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-2">
        {byType[activeType].map(photo => (
          <div key={photo.id} className="relative aspect-square rounded-card overflow-hidden bg-surface-raised">
            <img
              src={photo.storage_url}
              alt={photo.caption ?? photo.photo_type}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <button
              onClick={() => handleDelete(photo)}
              className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center
                         justify-center text-white hover:bg-danger transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {/* Add photo button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading !== null}
          className="aspect-square rounded-card border-2 border-dashed border-surface-border
                     flex flex-col items-center justify-center gap-1 bg-surface-raised
                     hover:border-brand hover:bg-surface transition-colors disabled:opacity-40"
        >
          {uploading === activeType ? (
            <span className="w-5 h-5 border-2 border-surface-border border-t-brand rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-6 h-6 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              <span className="text-[10px] text-content-muted font-medium">Photo</span>
            </>
          )}
        </button>
      </div>

      {error && <p className="text-field-xs text-danger">{error}</p>}
    </div>
  );
}
