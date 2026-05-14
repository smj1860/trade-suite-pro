import { getPowerSyncDb } from './client';

// =============================================================================
// QUERY HELPERS
//
// These run against local SQLite via PowerSync's reactive query engine.
// Results update automatically when the underlying data changes —
// either from a local write or an incoming sync from the server.
//
// All queries work identically online and offline.
// =============================================================================

// ─── Jobs ────────────────────────────────────────────────────────────────────

export function watchJobsByStatus(orgId: string, status: string) {
  return getPowerSyncDb().watch(
    `SELECT
       j.*,
       c.name  AS customer_name,
       c.phone AS customer_phone,
       u.name  AS assigned_to_name
     FROM jobs j
     LEFT JOIN customers c ON c.id = j.customer_id
     LEFT JOIN users u     ON u.id = j.assigned_to
     WHERE j.org_id = ?
       AND j.status = ?
     ORDER BY j.scheduled_at ASC NULLS LAST, j.created_at DESC`,
    [orgId, status]
  );
}

export function watchJobsForCalendar(orgId: string, fromDate: string, toDate: string) {
  return getPowerSyncDb().watch(
    `SELECT
       j.id, j.title, j.status, j.scheduled_at, j.location,
       j.assigned_to, j.estimated_value_cents,
       c.name  AS customer_name,
       c.phone AS customer_phone,
       u.name  AS tech_name
     FROM jobs j
     LEFT JOIN customers c ON c.id = j.customer_id
     LEFT JOIN users u     ON u.id = j.assigned_to
     WHERE j.org_id = ?
       AND j.scheduled_at >= ?
       AND j.scheduled_at <  ?
       AND j.status NOT IN ('cancelled', 'closed')
     ORDER BY j.scheduled_at ASC`,
    [orgId, fromDate, toDate]
  );
}

export function watchJob(jobId: string) {
  return getPowerSyncDb().watch(
    `SELECT
       j.*,
       c.name    AS customer_name,
       c.phone   AS customer_phone,
       c.email   AS customer_email,
       c.address AS customer_address,
       u.name    AS assigned_to_name,
       u.phone   AS tech_phone
     FROM jobs j
     LEFT JOIN customers c ON c.id = j.customer_id
     LEFT JOIN users u     ON u.id = j.assigned_to
     WHERE j.id = ?`,
    [jobId]
  );
}

// ─── Customers ───────────────────────────────────────────────────────────────

export function watchCustomers(orgId: string) {
  return getPowerSyncDb().watch(
    `SELECT
       c.*,
       COUNT(j.id) AS job_count
     FROM customers c
     LEFT JOIN jobs j ON j.customer_id = c.id AND j.status != 'cancelled'
     WHERE c.org_id = ?
     GROUP BY c.id
     ORDER BY c.name ASC`,
    [orgId]
  );
}

export function watchCustomer(customerId: string) {
  return getPowerSyncDb().watch(
    `SELECT * FROM customers WHERE id = ?`,
    [customerId]
  );
}

export function searchCustomers(orgId: string, query: string) {
  // SQLite LIKE search — case insensitive for ASCII
  const pattern = `%${query}%`;
  return getPowerSyncDb().watch(
    `SELECT * FROM customers
     WHERE org_id = ?
       AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)
     ORDER BY name ASC
     LIMIT 20`,
    [orgId, pattern, pattern, pattern]
  );
}

// ─── Customer Assets ─────────────────────────────────────────────────────────

export function watchCustomerAssets(customerId: string) {
  return getPowerSyncDb().watch(
    `SELECT * FROM customer_assets
     WHERE customer_id = ?
       AND is_active = 1
     ORDER BY asset_type ASC, name ASC`,
    [customerId]
  );
}

export function watchJobAssets(jobId: string) {
  return getPowerSyncDb().watch(
    `SELECT ca.*
     FROM customer_assets ca
     JOIN job_assets ja ON ja.asset_id = ca.id
     WHERE ja.job_id = ?
       AND ca.is_active = 1`,
    [jobId]
  );
}

// ─── Job Notes ───────────────────────────────────────────────────────────────

export function watchJobNotes(jobId: string) {
  return getPowerSyncDb().watch(
    `SELECT
       n.*,
       u.name AS author_name
     FROM job_notes n
     LEFT JOIN users u ON u.id = n.created_by
     WHERE n.job_id = ?
     ORDER BY n.is_pinned DESC, n.created_at ASC`,
    [jobId]
  );
}

// ─── Job Photos ──────────────────────────────────────────────────────────────

export function watchJobPhotos(jobId: string) {
  return getPowerSyncDb().watch(
    `SELECT * FROM job_photos
     WHERE job_id = ?
     ORDER BY photo_type ASC, created_at ASC`,
    [jobId]
  );
}

// ─── Estimates ───────────────────────────────────────────────────────────────

export function watchEstimate(estimateId: string) {
  return getPowerSyncDb().watch(
    `SELECT * FROM estimates WHERE id = ?`,
    [estimateId]
  );
}

export function watchEstimateLineItems(estimateId: string) {
  return getPowerSyncDb().watch(
    `SELECT * FROM estimate_line_items
     WHERE estimate_id = ?
     ORDER BY tier ASC, sort_order ASC`,
    [estimateId]
  );
}

export function watchJobEstimates(jobId: string) {
  return getPowerSyncDb().watch(
    `SELECT * FROM estimates
     WHERE job_id = ?
     ORDER BY created_at DESC`,
    [jobId]
  );
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export function watchInvoice(invoiceId: string) {
  return getPowerSyncDb().watch(
    `SELECT
       i.*,
       c.name  AS customer_name,
       c.phone AS customer_phone,
       c.email AS customer_email
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id
     WHERE i.id = ?`,
    [invoiceId]
  );
}

export function watchOverdueInvoices(orgId: string) {
  const today = new Date().toISOString().split('T')[0]!;
  return getPowerSyncDb().watch(
    `SELECT
       i.*,
       c.name AS customer_name
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id
     WHERE i.org_id = ?
       AND i.status IN ('sent', 'viewed', 'partial')
       AND i.due_date < ?
     ORDER BY i.due_date ASC`,
    [orgId, today]
  );
}

// ─── Follow-up sequences ──────────────────────────────────────────────────────

export function watchActiveSequence(jobId: string) {
  return getPowerSyncDb().watch(
    `SELECT * FROM follow_up_sequences
     WHERE job_id = ?
       AND status = 'active'
     LIMIT 1`,
    [jobId]
  );
}

// ─── Sync status ─────────────────────────────────────────────────────────────

export function getSyncStatus() {
  return getPowerSyncDb().currentStatus;
}

export function watchSyncStatus() {
  return (getPowerSyncDb() as any).statusStream;
}
