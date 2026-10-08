import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { CacheNamespace } from '../cache/cache.constants';
import { CacheService } from '../cache/cache.service';
import { PaginationArgs } from '../common/dto/pagination.args';
import { Page, toPage, toSkip } from '../common/models/paginated.model';
import {
  isPrismaError,
  PRISMA_RECORD_NOT_FOUND,
  PRISMA_UNIQUE_VIOLATION,
} from '../common/prisma-errors';
import { EnvironmentVariables } from '../config/env.validation';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleInput } from './dto/create-schedule.input';
import { ScheduleFilterInput } from './dto/schedule-filter.input';
import { SCHEDULE_INCLUDE, ScheduleWithRelations } from './schedule-with-relations';

@Injectable()
export class SchedulesService {
  private readonly durationMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly notifications: NotificationsService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.durationMinutes = config.get('SCHEDULE_DURATION_MINUTES', { infer: true });
  }

  async create(input: CreateScheduleInput): Promise<ScheduleWithRelations> {
    if (input.scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    let schedule: ScheduleWithRelations;
    try {
      schedule = await this.prisma.$transaction(async (tx) => {
        // lock per dokter, biar 2 request barengan gak sama-sama lolos cek overlap di bawah.
        // lock-nya lepas sendiri pas commit/rollback
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.doctorId}))`;
        await this.assertParticipantsExist(tx, input.customerId, input.doctorId);
        await this.assertDoctorAvailable(tx, input.doctorId, input.scheduledAt);
        return tx.schedule.create({
          data: {
            objective: input.objective,
            customerId: input.customerId,
            doctorId: input.doctorId,
            scheduledAt: input.scheduledAt,
          },
          include: SCHEDULE_INCLUDE,
        });
      });
    } catch (error) {
      if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
        throw new ConflictException('Doctor already has a schedule at this time');
      }
      throw error;
    }

    await this.cache.invalidate(CacheNamespace.Schedules);
    // fire and forget, email-nya dikirim async sama notification-service
    void this.notifications.scheduleCreated(schedule);
    return schedule;
  }

  findAll(
    filter: ScheduleFilterInput = {},
    pagination: PaginationArgs,
  ): Promise<Page<ScheduleWithRelations>> {
    if (filter.from && filter.to && filter.from > filter.to) {
      throw new BadRequestException('filter.from must be before or equal to filter.to');
    }

    const where: Prisma.ScheduleWhereInput = {
      ...(filter.customerId && { customerId: filter.customerId }),
      ...(filter.doctorId && { doctorId: filter.doctorId }),
      ...((filter.from || filter.to) && {
        scheduledAt: {
          ...(filter.from && { gte: filter.from }),
          ...(filter.to && { lte: filter.to }),
        },
      }),
    };
    const cacheKey = `list:${JSON.stringify({ where, page: pagination.page, limit: pagination.limit })}`;

    return this.cache.wrap(CacheNamespace.Schedules, cacheKey, async () => {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.schedule.findMany({
          where,
          include: SCHEDULE_INCLUDE,
          skip: toSkip(pagination),
          take: pagination.limit,
          orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        }),
        this.prisma.schedule.count({ where }),
      ]);
      return toPage(items, total, pagination);
    });
  }

  async findOne(id: string): Promise<ScheduleWithRelations> {
    const schedule = await this.cache.wrap(CacheNamespace.Schedules, `id:${id}`, () =>
      this.prisma.schedule.findUnique({ where: { id }, include: SCHEDULE_INCLUDE }),
    );
    if (!schedule) throw notFound(id);
    return schedule;
  }

  async remove(id: string): Promise<ScheduleWithRelations> {
    let schedule: ScheduleWithRelations;
    try {
      schedule = await this.prisma.schedule.delete({ where: { id }, include: SCHEDULE_INCLUDE });
    } catch (error) {
      if (isPrismaError(error, PRISMA_RECORD_NOT_FOUND)) throw notFound(id);
      throw error;
    }

    await this.cache.invalidate(CacheNamespace.Schedules);
    void this.notifications.scheduleDeleted(schedule);
    return schedule;
  }

  private async assertParticipantsExist(
    tx: Prisma.TransactionClient,
    customerId: string,
    doctorId: string,
  ): Promise<void> {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with id "${customerId}" not found`);
    }
    const doctor = await tx.doctor.findUnique({ where: { id: doctorId }, select: { id: true } });
    if (!doctor) {
      throw new NotFoundException(`Doctor with id "${doctorId}" not found`);
    }
  }

  /**
   * 1 konsultasi makan waktu [scheduledAt, scheduledAt + durasi). Jadwal dokter yang sama
   * dianggap bentrok kalo jarak mulainya kurang dari 1 durasi.
   */
  private async assertDoctorAvailable(
    tx: Prisma.TransactionClient,
    doctorId: string,
    scheduledAt: Date,
  ): Promise<void> {
    const durationMs = this.durationMinutes * 60_000;
    const clash = await tx.schedule.findFirst({
      where: {
        doctorId,
        scheduledAt: {
          gt: new Date(scheduledAt.getTime() - durationMs),
          lt: new Date(scheduledAt.getTime() + durationMs),
        },
      },
      select: { scheduledAt: true },
    });
    if (clash) {
      throw new ConflictException(
        `Doctor already has a consultation at ${clash.scheduledAt.toISOString()} ` +
          `(consultations last ${this.durationMinutes} minutes)`,
      );
    }
  }
}

function notFound(id: string): NotFoundException {
  return new NotFoundException(`Schedule with id "${id}" not found`);
}
