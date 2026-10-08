import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Doctor } from '@prisma/client';
import { CacheNamespace } from '../cache/cache.constants';
import { CacheService } from '../cache/cache.service';
import { PaginationArgs } from '../common/dto/pagination.args';
import { Page, toPage, toSkip } from '../common/models/paginated.model';
import {
  isPrismaError,
  PRISMA_FOREIGN_KEY_VIOLATION,
  PRISMA_RECORD_NOT_FOUND,
} from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDoctorInput } from './dto/create-doctor.input';
import { UpdateDoctorInput } from './dto/update-doctor.input';

@Injectable()
export class DoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(input: CreateDoctorInput): Promise<Doctor> {
    const doctor = await this.prisma.doctor.create({ data: input });
    await this.cache.invalidate(CacheNamespace.Doctors);
    return doctor;
  }

  findAll(pagination: PaginationArgs): Promise<Page<Doctor>> {
    return this.cache.wrap(
      CacheNamespace.Doctors,
      `list:${pagination.page}:${pagination.limit}`,
      async () => {
        const [items, total] = await this.prisma.$transaction([
          this.prisma.doctor.findMany({
            skip: toSkip(pagination),
            take: pagination.limit,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          }),
          this.prisma.doctor.count(),
        ]);
        return toPage(items, total, pagination);
      },
    );
  }

  async findOne(id: string): Promise<Doctor> {
    const doctor = await this.cache.wrap(CacheNamespace.Doctors, `id:${id}`, () =>
      this.prisma.doctor.findUnique({ where: { id } }),
    );
    if (!doctor) throw notFound(id);
    return doctor;
  }

  async update(id: string, input: UpdateDoctorInput): Promise<Doctor> {
    try {
      const doctor = await this.prisma.doctor.update({ where: { id }, data: input });
      // schedule ikut bawa data dokter, jadi cache schedule juga ikut basi
      await this.cache.invalidate(CacheNamespace.Doctors, CacheNamespace.Schedules);
      return doctor;
    } catch (error) {
      throw this.toHttpError(error, id);
    }
  }

  async remove(id: string): Promise<Doctor> {
    try {
      const doctor = await this.prisma.doctor.delete({ where: { id } });
      await this.cache.invalidate(CacheNamespace.Doctors);
      return doctor;
    } catch (error) {
      throw this.toHttpError(error, id);
    }
  }

  private toHttpError(error: unknown, id: string): unknown {
    if (isPrismaError(error, PRISMA_RECORD_NOT_FOUND)) {
      return notFound(id);
    }
    if (isPrismaError(error, PRISMA_FOREIGN_KEY_VIOLATION)) {
      return new ConflictException(
        'Doctor still has schedules; delete those schedules before deleting the doctor',
      );
    }
    return error;
  }
}

function notFound(id: string): NotFoundException {
  return new NotFoundException(`Doctor with id "${id}" not found`);
}
