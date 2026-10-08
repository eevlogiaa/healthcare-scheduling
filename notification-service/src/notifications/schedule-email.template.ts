import { ScheduleEvent, ScheduleNotificationJob } from './notification.contract';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function formatScheduleTime(isoTimestamp: string, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(isoTimestamp));
  return `${formatted} (${timeZone})`;
}

/** Render email ke customer pas jadwalnya dibuat atau dibatalin. */
export function renderScheduleEmail(job: ScheduleNotificationJob, timeZone: string): RenderedEmail {
  const when = formatScheduleTime(job.scheduledAt, timeZone);
  const created = job.event === ScheduleEvent.Created;
  const subject = created
    ? `Consultation booked with ${job.doctor.name}`
    : `Consultation with ${job.doctor.name} cancelled`;
  const intro = created
    ? 'Your consultation has been booked.'
    : 'Your consultation has been cancelled.';
  const details: [string, string][] = [
    ['Doctor', job.doctor.name],
    ['Time', when],
    ['Objective', job.objective],
    ['Reference', job.scheduleId],
  ];

  const text = [
    `Hello ${job.customer.name},`,
    '',
    intro,
    '',
    ...details.map(([label, value]) => `${label}: ${value}`),
    '',
    'Healthcare Clinic',
  ].join('\n');

  const rows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0"><strong>${label}</strong></td>` +
        `<td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  const html =
    `<p>Hello ${escapeHtml(job.customer.name)},</p>` +
    `<p>${intro}</p>` +
    `<table>${rows}</table>` +
    `<p>Healthcare Clinic</p>`;

  return { subject, text, html };
}
