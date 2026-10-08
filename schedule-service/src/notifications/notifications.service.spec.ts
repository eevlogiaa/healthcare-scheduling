import { getQueueToken } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ScheduleWithRelations } from '../schedules/schedule-with-relations';
import { EMAIL_QUEUE, SCHEDULE_NOTIFICATION_JOB, ScheduleEvent } from './notification.contract';
import { NotificationsService } from './notifications.service';

const timestamps = { createdAt: new Date(), updatedAt: new Date() };
const schedule: ScheduleWithRelations = {
  id: 'schedule-1',
  objective: 'Annual check-up',
  customerId: 'customer-1',
  doctorId: 'doctor-1',
  scheduledAt: new Date('2030-01-15T09:00:00.000Z'),
  ...timestamps,
  customer: { id: 'customer-1', name: 'Jane Doe', email: 'jane@example.com', ...timestamps },
  doctor: { id: 'doctor-1', name: 'Dr. House', ...timestamps },
};

describe('NotificationsService', () => {
  let queue: { add: jest.Mock };
  let service: NotificationsService;

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue({ id: 1 }) };
    const moduleRef = await Test.createTestingModule({
      providers: [NotificationsService, { provide: getQueueToken(EMAIL_QUEUE), useValue: queue }],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  it('enqueues a "created" email job with retries', async () => {
    await service.scheduleCreated(schedule);

    expect(queue.add).toHaveBeenCalledWith(
      SCHEDULE_NOTIFICATION_JOB,
      {
        event: ScheduleEvent.Created,
        scheduleId: 'schedule-1',
        objective: 'Annual check-up',
        scheduledAt: '2030-01-15T09:00:00.000Z',
        customer: { name: 'Jane Doe', email: 'jane@example.com' },
        doctor: { name: 'Dr. House' },
      },
      expect.objectContaining({ attempts: 5, backoff: { type: 'exponential', delay: 5000 } }),
    );
  });

  it('enqueues a "deleted" email job', async () => {
    await service.scheduleDeleted(schedule);

    expect(queue.add.mock.calls[0][1].event).toBe(ScheduleEvent.Deleted);
  });

  it('never throws when the queue is unavailable', async () => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    queue.add.mockRejectedValue(new Error('Redis down'));

    await expect(service.scheduleCreated(schedule)).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('Redis down'));
    logError.mockRestore();
  });
});
