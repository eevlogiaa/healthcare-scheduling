import { ScheduleEvent, ScheduleNotificationJob } from './notification.contract';
import { escapeHtml, formatScheduleTime, renderScheduleEmail } from './schedule-email.template';

const job: ScheduleNotificationJob = {
  event: ScheduleEvent.Created,
  scheduleId: 'schedule-1',
  objective: 'Follow-up <script>alert(1)</script>',
  scheduledAt: '2030-01-15T02:00:00.000Z',
  customer: { name: 'Jane & John', email: 'jane@example.com' },
  doctor: { name: 'Dr. House' },
};

describe('schedule email template', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('formats the time in the configured time zone', () => {
    // 02:00 UTC = 09:00 WIB
    expect(formatScheduleTime(job.scheduledAt, 'Asia/Jakarta')).toBe(
      'Tuesday, 15 January 2030 at 09:00 (Asia/Jakarta)',
    );
  });

  it('renders a booking confirmation', () => {
    const email = renderScheduleEmail(job, 'Asia/Jakarta');

    expect(email.subject).toBe('Consultation booked with Dr. House');
    expect(email.text).toContain('Hello Jane & John,');
    expect(email.text).toContain('Your consultation has been booked.');
    expect(email.text).toContain('Time: Tuesday, 15 January 2030 at 09:00 (Asia/Jakarta)');
    expect(email.text).toContain('Reference: schedule-1');
  });

  it('never injects raw user input into the HTML body', () => {
    const { html } = renderScheduleEmail(job, 'UTC');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Hello Jane &amp; John,');
  });

  it('renders a cancellation', () => {
    const email = renderScheduleEmail({ ...job, event: ScheduleEvent.Deleted }, 'UTC');

    expect(email.subject).toBe('Consultation with Dr. House cancelled');
    expect(email.text).toContain('Your consultation has been cancelled.');
  });
});
