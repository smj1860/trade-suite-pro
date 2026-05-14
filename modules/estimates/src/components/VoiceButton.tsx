import { useCallback, useRef, useState } from 'react';

type State = 'idle' | 'recording' | 'processing' | 'error';

export function VoiceButton({
  onResult, orgId,
}: { onResult: (result: unknown) => void; orgId: string }) {
  const [state, setState]   = useState<State>('idle');
  const [error, setError]   = useState<string | null>(null);
  const recorderRef         = useRef<MediaRecorder | null>(null);
  const chunksRef           = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(250);
      recorderRef.current = stream as unknown as MediaRecorder;
      Object.assign(recorderRef, { current: recorder });
      recorderRef.current = recorder;
      setState('recording');
      setError(null);
    } catch {
      setError('Microphone access denied');
      setState('error');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    setState('processing');

    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve();
      recorder.stop();
      (recorder.stream as MediaStream).getTracks().forEach(t => t.stop());
    });

    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', blob);
      formData.append('org_id', orgId);

      const { data: { session } } = await (await import('@trades-saas/core-auth')).getSupabaseClient().auth.getSession();
      const res = await fetch(
        `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/omnibid-voice-parse`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: formData,
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      onResult(result);
      setState('idle');
    } catch (err) {
      setError((err as Error).message);
      setState('error');
    }
  }, [orgId, onResult]);

  const handlePointerDown = useCallback(() => { startRecording(); }, [startRecording]);
  const handlePointerUp   = useCallback(() => { stopRecording();  }, [stopRecording]);

  const isRecording  = state === 'recording';
  const isProcessing = state === 'processing';

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        disabled={isProcessing}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all touch-none
                    ${isRecording  ? 'bg-danger scale-110 shadow-lg' :
                      isProcessing ? 'bg-surface-raised cursor-wait' :
                      'bg-brand hover:bg-brand-mid active:scale-95'}
                    disabled:opacity-50`}
      >
        {isProcessing ? (
          <span className="w-6 h-6 border-2 border-surface-border border-t-brand rounded-full animate-spin" />
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>
      <p className="text-[10px] text-content-muted">
        {isRecording ? 'Recording… release to stop' :
         isProcessing ? 'Processing…' :
         state === 'error' ? (error ?? 'Error') :
         'Hold to dictate items'}
      </p>
    </div>
  );
}
