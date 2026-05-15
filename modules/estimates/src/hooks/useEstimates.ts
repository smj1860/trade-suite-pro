import { useQuery } from '@powersync/react';
import { useCallback } from 'react';
import { getSupabaseClient } from '@trades-saas/core-auth';
import type { Estimate, EstimateItem, EstimateStatus, Invoice, PriceBookItem } from '../types';

const supabase = getSupabaseClient();

export function useEstimates(filter?: EstimateStatus) {
  const where = filter ? `WHERE status = '${filter}'` : '';
  return useQuery<Estimate>(`
    SELECT * FROM estimates ${where} ORDER BY created_at DESC
  `);
}

export function useEstimate(estimateId: string) {
  return useQuery<Estimate>('SELECT * FROM estimates WHERE id = ? LIMIT 1', [estimateId]);
}

export function useEstimateItems(estimateId: string) {
  return useQuery<EstimateItem>(
    'SELECT * FROM estimate_line_items WHERE estimate_id = ? ORDER BY tier, sort_order ASC',
    [estimateId]
  );
}

export function usePriceBook(search?: string) {
  const where = search
    ? `WHERE active = 1 AND (LOWER(name) LIKE LOWER('%${search}%') OR LOWER(category) LIKE LOWER('%${search}%'))`
    : 'WHERE active = 1';
  return useQuery<PriceBookItem>(`
    SELECT * FROM price_book ${where} ORDER BY category, name
  `);
}

export function useEstimateStats() {
  const { data } = useQuery<{ draft: number; sent: number; accepted: number; total_value_cents: number }>(`
    SELECT
      COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draft,
      COUNT(CASE WHEN status = 'sent'  THEN 1 END) AS sent,
      COUNT(CASE WHEN status = 'accepted' THEN 1 END) AS accepted,
      COALESCE(SUM(total_cents), 0) AS total_value_cents
    FROM estimates WHERE status NOT IN ('rejected', 'expired')
  `);
  return data?.[0] ?? { draft: 0, sent: 0, accepted: 0, total_value_cents: 0 };
}

export function useEstimateActions() {
  const addLineItem = useCallback(async (item: Omit<EstimateItem, 'id' | 'created_at'>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('estimate_line_items') as any).insert(item);
    if (error) throw error;
  }, []);

  const updateLineItem = useCallback(async (id: string, updates: Partial<EstimateItem>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('estimate_line_items') as any).update(updates).eq('id', id);
    if (error) throw error;
  }, []);

  const removeLineItem = useCallback(async (id: string) => {
    const { error } = await supabase.from('estimate_line_items').delete().eq('id', id);
    if (error) throw error;
  }, []);

  const createEstimate = useCallback(async (orgId: string, jobId: string, customerId: string, createdBy: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('estimates') as any)
      .insert({ org_id: orgId, job_id: jobId, customer_id: customerId, created_by: createdBy, status: 'draft' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }, []);

  const sendEstimate = useCallback(async (estimateId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/omnibid-send-estimate`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate_id: estimateId }),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, []);

  const parseVoice = useCallback(async (audioBlob: Blob, orgId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('org_id', orgId);
    const res = await fetch(
      `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/omnibid-voice-parse`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: formData,
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, []);

  const sendInvoice = useCallback(async (invoiceId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/omnibid-send-invoice`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ pdf_url: string; payment_link_url: string }>;
  }, []);

  const createInvoice = useCallback(async (estimateId: string): Promise<{ id: string }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: est, error: estErr } = await (supabase.from('estimates') as any)
      .select('org_id, job_id, customer_id, subtotal_cents, tax_cents, tax_rate, total_cents, customer_note, created_by')
      .eq('id', estimateId)
      .single();
    if (estErr || !est) throw new Error('Estimate not found');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inv, error: invErr } = await (supabase.from('invoices') as any)
      .insert({
        org_id:         est.org_id,
        job_id:         est.job_id,
        customer_id:    est.customer_id,
        created_by:     est.created_by,
        estimate_id:    estimateId,
        subtotal_cents: est.subtotal_cents,
        tax_cents:      est.tax_cents,
        tax_rate:       est.tax_rate,
        total_cents:    est.total_cents,
        balance_cents:  est.total_cents,
        customer_note:  est.customer_note,
        status:         'draft',
      })
      .select('id')
      .single();
    if (invErr || !inv) throw new Error(invErr?.message ?? 'Failed to create invoice');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('estimates') as any).update({ status: 'superseded' }).eq('id', estimateId);

    return { id: inv.id };
  }, []);

  return { addLineItem, updateLineItem, removeLineItem, createEstimate, sendEstimate, sendInvoice, createInvoice, parseVoice };
}

export function useInvoice(invoiceId: string) {
  return useQuery<Invoice>('SELECT * FROM invoices WHERE id = ? LIMIT 1', [invoiceId]);
}

export function useJobInvoices(jobId: string) {
  return useQuery<Invoice>('SELECT * FROM invoices WHERE job_id = ? ORDER BY created_at DESC', [jobId]);
}
