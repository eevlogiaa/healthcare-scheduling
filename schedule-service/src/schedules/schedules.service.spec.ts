import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { CacheNamespace } from '../cache/cache.constants';
import { CacheService } from '../cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { passThroughCache, prismaError } from '../test-utils/prisma-mocks';
import { ScheduleWithRelations } from './schedule-with-relations';
import { SchedulesService } from './schedules.service';

const CUSTOMER_ID = '0b6c7f9e-4c1a-4d4e-9f3a-1a2b3c4d5e6f';
const DOCTOR_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const SCHEDULE_ID = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a';

function futureDate(hoursAhead = 24): Date {
  return new Date(Date.now() + hoursAhead * 3_600_000);
}

function makeSchedule(scheduledAt = futureDate()): ScheduleWithRelations {
  const timestamps = { createdAt: new Date(), updatedAt: new Date() };
  return {
    id: SCHEDULE_ID,
    objective: 'Annual check-up',
    customerId: CUSTOMER_ID,
    doctorId: DOCTOR_ID,
    scheduledAt,
    ...timestamps,
    customer: { id: CUSTOMER_ID, name: 'Jane Doe', email: 'jane@example.com', ...timestamps },
    doctor: { id: DOCTOR_ID, name: 'Dr. House', ...timestamps },
  };
}

describe('SchedulesService', () => {
  let tx: {
    $executeRaw: jest.Mock;
    customer: { findUnique: jest.Mock };
    doctor: { findUnique: jest.Mock };
    schedule: { findFirst: jest.Mock; create: jest.Mock };
  };
  let prisma: {
    $transaction: jest.Mock;
    schedule: Record<'findMany' | 'count' | 'findUnique' | 'delete', jest.Mock>;
  };
  let cache: ReturnType<typeof passThroughCache>;
  let notifications: { scheduleCreated: jest.Mock; scheduleDeleted: jest.Mock };
  let service: SchedulesService;

  beforeEach(async () => {
    tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      customer: { findUnique: jest.fn().mockResolvedValue({ id: CUSTOMER_ID }) },
      doctor: { findUnique: jest.fn().mockResolvedValue({ id: DOCTOR_ID }) },
      schedule: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    prisma = {
      // interactive transaction dapet callback, batch transaction dapet array
      $transaction: jest.fn(
        (arg: ((client: typeof tx) => Promise<unknown>) | Promise<unknown>[]) =>
          Array.isArray(arg) ? Promise.all(arg) : arg(tx),
      ),
      schedule: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };
    cache = passThroughCache();
    notifications = {
      scheduleCreated: jest.fn().mockResolvedValue(undefined),
      scheduleDeleted: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SchedulesService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: NotificationsService, useValue: notifications },
        { provide: ConfigService, useValue: new ConfigService({ SCHEDULE_DURATION_MINUTES: 30 }) },
      ],
    }).compile();
    service = moduleRef.get(SchedulesService);
  });

  describe('create', () => {
    const input = () => ({
      objective: 'Annual check-up',
      customerId: CUSTOMER_ID,
      doctorId: DOCTOR_ID,
      scheduledAt: futureDate(),
    });

    it('books the consultation, invalidates the cache and notifies the customer', async () => {
      const data = input();
      const created = makeSchedule(data.scheduledAt);
      tx.schedule.create.mockResolvedValue(created);

      await expect(service.create(data)).resolves.toBe(created);

      expect(tx.$executeRaw).toHaveBeenCalled(); // advisory lock per dokter
      expect(tx.schedule.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ...data } }),
      );
      expect(cache.invalidate).toHaveBeenCalledWith(CacheNamespace.Schedules);
      expect(notifications.scheduleCreated).toHaveBeenCalledWith(created);
    });

    it('checks for clashes within one consultation length on both sides', async () => {
      const data = input();
      tx.schedule.create.mockResolvedValue(makeSchedule(data.scheduledAt));

      await service.create(data);

      const halfHour = 30 * 60_000;
      expect(tx.schedule.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            doctorId: DOCTOR_ID,
            scheduledAt: {
              gt: new Date(data.scheduledAt.getTime() - halfHour),
              lt: new Date(data.scheduledAt.getTime() + halfHour),
            },
          },
        }),
      );
    });

    it('rejects a time in the past', async () => {
      await expect(
        service.create({ ...input(), scheduledAt: new Date(Date.now() - 1000) }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an unknown customer', async () => {
      tx.customer.findUnique.mockResolvedValue(null);
      await expect(service.create(input())).rejects.toThrow(/Customer .* not found/);
      expect(tx.schedule.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown doctor', async () => {
      tx.doctor.findUnique.mockResolvedValue(null);
      await expect(service.create(input())).rejects.toThrow(/Doctor .* not found/);
      expect(tx.schedule.create).not.toHaveBeenCalled();
    });

    it('rejects an overlapping consultation of the same doctor', async () => {
      tx.schedule.findFirst.mockResolvedValue({ scheduledAt: futureDate() });

      await expect(service.create(input())).rejects.toBeInstanceOf(ConflictException);
      expect(tx.schedule.create).not.toHaveBeenCalled();
      expect(notifications.scheduleCreated).not.toHaveBeenCalled();
    });

    it('maps the unique (doctor, time) index violation to a conflict', async () => {
      tx.schedule.create.mockRejectedValue(prismaError('P2002'));
      await expect(service.create(input())).rejects.toBeInstanceOf(ConflictException);
    });

    it('rethrows unexpected errors', async () => {
      const failure = new Error('db down');
      tx.schedule.create.mockRejectedValue(failure);
      await expect(service.create(input())).rejects.toBe(failure);
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      prisma.schedule.findMany.mockResolvedValue([makeSchedule()]);
      prisma.schedule.count.mockResolvedValue(1);
    });

    it('applies all filters', async () => {
      const from = new Date('2030-01-01T00:00:00Z');
      const to = new Date('2030-01-31T00:00:00Z');

      const page = await service.findAll(
        { customerId: CUSTOMER_ID, doctorId: DOCTOR_ID, from, to },
        { page: 1, limit: 5 },
      );

      const where = {
        customerId: CUSTOMER_ID,
        doctorId: DOCTOR_ID,
        scheduledAt: { gte: from, lte: to },
      };
      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where, skip: 0, take: 5 }),
      );
      expect(prisma.schedule.count).toHaveBeenCalledWith({ where });
      expect(page.pageInfo.total).toBe(1);
    });

    it('does not filter when no filter is given', async () => {
      await service.findAll({}, { page: 1, limit: 10 });
      expect(prisma.schedule.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('supports an open-ended date range', async () => {
      const from = new Date('2030-01-01T00:00:00Z');
      await service.findAll({ from }, { page: 1, limit: 10 });
      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { scheduledAt: { gte: from } } }),
      );
    });

    it('rejects a range that ends before it starts', () => {
      expect(() =>
        service.findAll(
          { from: new Date('2030-02-01T00:00:00Z'), to: new Date('2030-01-01T00:00:00Z') },
          { page: 1, limit: 10 },
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('returns the schedule', async () => {
      const schedule = makeSchedule();
      prisma.schedule.findUnique.mockResolvedValue(schedule);
      await expect(service.findOne(SCHEDULE_ID)).resolves.toBe(schedule);
    });

    it('throws NotFound for an unknown id', async () => {
      prisma.schedule.findUnique.mockResolvedValue(null);
      await expect(service.findOne(SCHEDULE_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the schedule, invalidates the cache and notifies the customer', async () => {
      const schedule = makeSchedule();
      prisma.schedule.delete.mockResolvedValue(schedule);

      await expect(service.remove(SCHEDULE_ID)).resolves.toBe(schedule);
      expect(cache.invalidate).toHaveBeenCalledWith(CacheNamespace.Schedules);
      expect(notifications.scheduleDeleted).toHaveBeenCalledWith(schedule);
    });

    it('throws NotFound for an unknown id', async () => {
      prisma.schedule.delete.mockRejectedValue(prismaError('P2025'));

      await expect(service.remove(SCHEDULE_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(notifications.scheduleDeleted).not.toHaveBeenCalled();
    });

    it('rethrows unexpected errors', async () => {
      const failure = new Error('db down');
      prisma.schedule.delete.mockRejectedValue(failure);
      await expect(service.remove(SCHEDULE_ID)).rejects.toBe(failure);
    });
  });
});
