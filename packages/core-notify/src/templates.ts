// =============================================================================
// MESSAGE TEMPLATES
//
// Every outbound message is rendered from a template here.
// No module hardcodes message strings — they call renderTemplate() and
// pass the result to notify().
//
// Design rules:
//   - SMS templates stay under 160 chars where possible (1 segment).
//   - All templates use {variable} interpolation.
//   - Email templates provide both html and text versions.
//   - Tone: human, warm, direct. Never corporate-sounding.
// =============================================================================

export type TemplateVars = Record<string, string>;

export interface RenderedSms {
  channel: 'sms';
  body:     string;
}

export interface RenderedEmail {
  channel:  'email';
  subject:  string;
  body:     string;          // plain text fallback
  html:     string;
}

export type RenderedMessage = RenderedSms | RenderedEmail;

// ─── Interpolation helper ────────────────────────────────────────────────────

function fill(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      console.warn(`[core-notify] Template variable missing: {${key}}`);
      return '';
    }
    return value;
  });
}

// ─── Simple email HTML wrapper ────────────────────────────────────────────────
//  Wraps plain text in a clean, mobile-friendly HTML shell.
//  Keeps the bundle small — no template engine needed for transactional email.

function wrapEmailHtml(content: string, business_name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${business_name}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#093b31;padding:24px 32px;">
      <p style="margin:0;color:#fff;font-size:18px;font-weight:600;">${business_name}</p>
    </div>
    <div style="padding:32px;color:#1a1a1a;font-size:15px;line-height:1.6;">
      ${content}
    </div>
    <div style="padding:16px 32px;background:#f9f9f9;border-top:1px solid #eee;">
      <p style="margin:0;font-size:12px;color:#999;">
        You're receiving this because you've done business with ${business_name}.
        Reply STOP to opt out of SMS messages.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// =============================================================================
// TEMPLATE DEFINITIONS
// =============================================================================

// ─── Core / LeadLock ─────────────────────────────────────────────────────────

export function missedCallSms(vars: {
  customer_name: string;
  business_name: string;
  booking_url:   string;
}): RenderedSms {
  return {
    channel: 'sms',
    body: fill(
      'Hi {customer_name}! You reached {business_name} — sorry we missed you. ' +
      'Reply here or book online: {booking_url}',
      vars
    ),
  };
}

export function followUpDay1Sms(vars: {
  customer_name: string;
  business_name: string;
  estimate_url?: string;
}): RenderedSms {
  const hasEstimate = !!vars.estimate_url;
  return {
    channel: 'sms',
    body: fill(
      hasEstimate
        ? 'Hi {customer_name}, just wanted to make sure you received your estimate from {business_name}. Any questions? {estimate_url}'
        : 'Hi {customer_name}, this is {business_name} following up on your inquiry. Still interested? Reply anytime.',
      vars
    ),
  };
}

export function followUpDay3Sms(vars: {
  customer_name: string;
  business_name: string;
}): RenderedSms {
  return {
    channel: 'sms',
    body: fill(
      'Hey {customer_name} — {business_name} here. Still happy to help whenever you\'re ready. Reply and we\'ll get something scheduled.',
      vars
    ),
  };
}

export function followUpDay5Sms(vars: {
  customer_name: string;
  business_name: string;
}): RenderedSms {
  return {
    channel: 'sms',
    body: fill(
      'Hi {customer_name}, one last check-in from {business_name}. No pressure — reply anytime if you\'d like to move forward.',
      vars
    ),
  };
}

export function bookingConfirmationSms(vars: {
  customer_name: string;
  business_name: string;
  scheduled_date: string;
  scheduled_time: string;
}): RenderedSms {
  return {
    channel: 'sms',
    body: fill(
      'Confirmed! {business_name} will be at your place on {scheduled_date} at {scheduled_time}. Reply here with any questions.',
      vars
    ),
  };
}

// ─── OmniBid ─────────────────────────────────────────────────────────────────

export function estimateSentSms(vars: {
  customer_name: string;
  business_name: string;
  estimate_url:  string;
}): RenderedSms {
  return {
    channel: 'sms',
    body: fill(
      'Hi {customer_name}, your estimate from {business_name} is ready — tap to view and approve: {estimate_url}',
      vars
    ),
  };
}

export function estimateSentEmail(vars: {
  customer_name:   string;
  business_name:   string;
  estimate_url:    string;
  estimate_number: string;
  total_formatted: string;  // e.g. "$1,250.00"
  expiry_date?:    string;
}): RenderedEmail {
  const body = fill(
    'Hi {customer_name},\n\n' +
    'Your estimate #{estimate_number} from {business_name} is ready to view.\n\n' +
    'Total: {total_formatted}\n\n' +
    'You can review and approve your estimate here:\n{estimate_url}\n\n' +
    (vars.expiry_date ? 'This estimate expires on {expiry_date}.\n\n' : '') +
    'Have questions? Just reply to this email — we\'re happy to help.\n\n' +
    '{business_name}',
    vars
  );

  const html = wrapEmailHtml(
    `<p>Hi ${vars.customer_name},</p>
    <p>Your estimate <strong>#${vars.estimate_number}</strong> from ${vars.business_name} is ready.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding:12px;background:#f9f9f9;border-radius:6px;">
          <strong style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:.05em;">Total</strong><br>
          <span style="font-size:24px;font-weight:700;color:#093b31;">${vars.total_formatted}</span>
        </td>
      </tr>
    </table>
    ${vars.expiry_date ? `<p style="font-size:13px;color:#888;">This estimate expires on ${vars.expiry_date}.</p>` : ''}
    <a href="${vars.estimate_url}"
       style="display:inline-block;background:#093b31;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0;">
      View &amp; Approve Estimate
    </a>
    <p style="margin-top:24px;">Have questions? Just reply — we're happy to help.</p>`,
    vars.business_name
  );

  return {
    channel: 'email',
    subject: fill('Your estimate from {business_name} — #{estimate_number}', vars),
    body,
    html,
  };
}

export function invoiceSentSms(vars: {
  customer_name:   string;
  business_name:   string;
  invoice_url:     string;
  total_formatted: string;
}): RenderedSms {
  return {
    channel: 'sms',
    body: fill(
      'Hi {customer_name}, your invoice from {business_name} is ready ({total_formatted}). Pay online: {invoice_url}',
      vars
    ),
  };
}

export function invoiceSentEmail(vars: {
  customer_name:    string;
  business_name:    string;
  invoice_url:      string;
  invoice_number:   string;
  total_formatted:  string;
  due_date?:        string;
}): RenderedEmail {
  const body = fill(
    'Hi {customer_name},\n\n' +
    'Invoice #{invoice_number} from {business_name} is ready.\n\n' +
    'Amount due: {total_formatted}\n' +
    (vars.due_date ? 'Due date: {due_date}\n' : '') +
    '\nPay online: {invoice_url}\n\n' +
    'Thank you for your business!\n{business_name}',
    vars
  );

  const html = wrapEmailHtml(
    `<p>Hi ${vars.customer_name},</p>
    <p>Invoice <strong>#${vars.invoice_number}</strong> from ${vars.business_name} is ready.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding:12px;background:#f9f9f9;border-radius:6px;">
          <strong style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:.05em;">Amount Due</strong><br>
          <span style="font-size:24px;font-weight:700;color:#093b31;">${vars.total_formatted}</span>
          ${vars.due_date ? `<br><span style="font-size:13px;color:#888;">Due ${vars.due_date}</span>` : ''}
        </td>
      </tr>
    </table>
    <a href="${vars.invoice_url}"
       style="display:inline-block;background:#093b31;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0;">
      Pay Invoice
    </a>
    <p style="margin-top:24px;">Thank you for your business!</p>`,
    vars.business_name
  );

  return {
    channel: 'email',
    subject: fill('Invoice #{invoice_number} from {business_name}', vars),
    body,
    html,
  };
}

// ─── RepuGuard ───────────────────────────────────────────────────────────────

export function reviewRequestSms(vars: {
  customer_name: string;
  business_name: string;
  review_url:    string;
}): RenderedSms {
  return {
    channel: 'sms',
    body: fill(
      'Hi {customer_name}, thanks for choosing {business_name}! ' +
      'Would you mind leaving us a quick review? It means a lot: {review_url}',
      vars
    ),
  };
}

export function reviewFollowupSms(vars: {
  customer_name: string;
  business_name: string;
  review_url:    string;
}): RenderedSms {
  return {
    channel: 'sms',
    body: fill(
      'Hi {customer_name} — just a gentle reminder from {business_name}. ' +
      'A review would really help us out: {review_url} 🙏',
      vars
    ),
  };
}

export function reviewRequestEmail(vars: {
  customer_name: string;
  business_name: string;
  review_url:    string;
  job_title?:    string;
}): RenderedEmail {
  const body = fill(
    'Hi {customer_name},\n\n' +
    'We hope everything went smoothly' +
    (vars.job_title ? ' with your {job_title}' : '') +
    '!\n\n' +
    'If you have a moment, we\'d love it if you could leave us a review. ' +
    'It takes less than a minute and genuinely helps small businesses like ours:\n\n' +
    '{review_url}\n\n' +
    'Thank you for your trust — it means everything.\n\n' +
    '{business_name}',
    vars
  );

  const html = wrapEmailHtml(
    `<p>Hi ${vars.customer_name},</p>
    <p>We hope everything went smoothly${vars.job_title ? ` with your ${vars.job_title}` : ''}!</p>
    <p>If you have a moment, a quick review would mean a lot to us. It helps other homeowners find trusted local contractors.</p>
    <a href="${vars.review_url}"
       style="display:inline-block;background:#093b31;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0;">
      Leave a Review ⭐
    </a>
    <p style="margin-top:24px;font-size:14px;color:#666;">Only takes a minute — we genuinely appreciate it.</p>`,
    vars.business_name
  );

  return {
    channel: 'email',
    subject: fill('How did we do? — {business_name}', vars),
    body,
    html,
  };
}
