import { formatDistanceToNow } from 'date-fns';
import { useReviewRequests, useReviewStats } from '../hooks/useReviews';
import type { ReviewRequest } from '../types';

const STATUS_STYLE: Record<string, { text: string; label: string }> = {
  pending:  { text: 'text-content-muted', label: 'Pending'  },
  sent:     { text: 'text-info',          label: 'Sent'     },
  clicked:  { text: 'text-warning',       label: 'Clicked'  },
  reviewed: { text: 'text-success',       label: 'Reviewed' },
  failed:   { text: 'text-danger',        label: 'Failed'   },
};

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-surface-raised rounded-card p-3 text-center">
      <p className={`text-money-base font-bold ${highlight ? 'text-brand' : 'text-content'}`}>{value}</p>
      <p className="text-[10px] text-content-muted mt-0.5">{label}</p>
    </div>
  );
}

export function ReviewsPage() {
  const { data: requests, isLoading } = useReviewRequests();
  const stats = useReviewStats();

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-4 pt-6 pb-4 border-b border-surface-border">
        <h1 className="text-field-2xl font-extrabold text-content tracking-tight">RepuGuard</h1>
        <p className="text-field-xs text-content-secondary mt-0.5 mb-4">Review &amp; reputation autopilot</p>

        <div className="grid grid-cols-3 gap-2 mb-2">
          <StatCard label="Sent"     value={stats.total_sent} />
          <StatCard label="Reviewed" value={stats.total_reviewed} />
          <StatCard label="Avg ★"   value={stats.avg_rating > 0 ? (stats.avg_rating as number).toFixed(1) : '—'} highlight />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface-raised rounded-card p-2 text-center">
            <p className="text-money-base font-bold text-content">{stats.click_rate}%</p>
            <p className="text-[10px] text-content-muted">Click rate</p>
          </div>
          <div className="bg-surface-raised rounded-card p-2 text-center">
            <p className="text-money-base font-bold text-content">{stats.review_rate}%</p>
            <p className="text-[10px] text-content-muted">Review rate</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <span className="w-6 h-6 border-2 border-surface-border border-t-brand rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
            <p className="text-field-sm font-bold text-content-secondary">No review requests yet</p>
            <p className="text-field-xs text-content-muted mt-1">
              Review requests are sent automatically when a job is marked complete
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {requests.map((r: ReviewRequest) => {
              const style = STATUS_STYLE[r.status] ?? STATUS_STYLE['pending']!;
              return (
                <div key={r.id} className="bg-surface-raised border border-surface-border rounded-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-field-sm font-semibold text-content capitalize">
                        {r.platform ?? 'Review'} Request
                      </p>
                      <p className="text-field-xs text-content-muted mt-0.5">
                        {r.sent_at
                          ? formatDistanceToNow(new Date(r.sent_at), { addSuffix: true })
                          : formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-field-xs font-bold ${style.text}`}>{style.label}</p>
                      {r.star_rating && (
                        <p className="text-field-xs text-warning mt-0.5">{'★'.repeat(r.star_rating)}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
