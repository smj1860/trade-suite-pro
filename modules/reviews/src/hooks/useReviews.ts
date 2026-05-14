import { useQuery } from '@powersync/react';
import { useCallback } from 'react';
import { getSupabaseClient } from '@trades-saas/core-auth';
import type { ReviewRequest, ReviewStats } from '../types';

const supabase = getSupabaseClient();

export function useReviewRequests() {
  return useQuery<ReviewRequest>(
    'SELECT * FROM review_requests ORDER BY created_at DESC'
  );
}

export function useReviewStats() {
  const { data } = useQuery<ReviewStats>(`
    SELECT
      COUNT(*)                                              AS total_sent,
      COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)   AS total_clicked,
      COUNT(CASE WHEN reviewed_at IS NOT NULL THEN 1 END)  AS total_reviewed,
      COALESCE(AVG(CASE WHEN star_rating IS NOT NULL THEN star_rating END), 0) AS avg_rating,
      CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1)
        ELSE 0 END AS click_rate,
      CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(CASE WHEN reviewed_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1)
        ELSE 0 END AS review_rate
    FROM review_requests WHERE status != 'failed'
  `);
  return data?.[0] ?? { total_sent: 0, total_clicked: 0, total_reviewed: 0, avg_rating: 0, click_rate: 0, review_rate: 0 };
}

export function useReviewActions() {
  const sendRequest = useCallback(async (jobId: string, customerId: string, orgId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/repuguard-send-request`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ job_id: jobId, customer_id: customerId, org_id: orgId }),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, []);

  return { sendRequest };
}
