export type ReviewRequestStatus = 'pending' | 'sent' | 'clicked' | 'reviewed' | 'failed';
export type ReviewPlatform = 'google' | 'yelp' | 'facebook';

export interface ReviewRequest {
  id: string;
  org_id: string;
  job_id: string | null;
  customer_id: string;
  status: ReviewRequestStatus;
  sent_via: string | null;
  platform: ReviewPlatform | null;
  review_url: string | null;
  sent_at: string | null;
  clicked_at: string | null;
  reviewed_at: string | null;
  star_rating: number | null;
  review_text: string | null;
  inngest_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewStats {
  total_sent: number;
  total_clicked: number;
  total_reviewed: number;
  avg_rating: number;
  click_rate: number;
  review_rate: number;
}
