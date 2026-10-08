import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CacheNamespace } from '../cache/cache.constants';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { passThroughCache, prismaError } from '../test-utils/prisma-mocks';
import { DoctorsService } from './doctors.service';

const ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const doctor = {
  id: ID,
  name: 'Dr. House',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('DoctorsService', () => {
  let prisma: {
    doctor: Record<'create' | 'findMany' | 'count' | 'findUnique' | 'update' | 'delete', jest.Mock>;
    $transaction: jest.Mock;
  };
  let cache: ReturnType<typeof passThroughCache>;
  let service: DoctorsService;

  beforeEach(async () => {
    prisma = {
      doctor: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    cache = passThroughCache();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DoctorsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = moduleRef.get(DoctorsService);
  });

  it('creates a doctor and invalidates the doctor cache', async () => {
    prisma.doctor.create.mockResolvedValue(doctor);

    await expect(service.create({ name: 'Dr. House' })).resolves.toBe(doctor);
    expect(prisma.doctor.create).toHaveBeenCalledWith({ data: { name: 'Dr. House' } });
    expect(cache.invalidate).toHaveBeenCalledWith(CacheNamespace.Doctors);
  });

  it('lists doctors with pagination metadata', async () => {
    prisma.doctor.findMany.mockResolvedValue([doctor]);
    prisma.doctor.count.mockResolvedValue(1);

    const page = await service.findAll({ page: 1, limit: 10 });

    expect(prisma.doctor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
    expect(page.pageInfo).toMatchObject({
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('finds a doctor or throws NotFound', async () => {
    prisma.doctor.findUnique.mockResolvedValueOnce(doctor).mockResolvedValueOnce(null);

    await expect(service.findOne(ID)).resolves.toBe(doctor);
    await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates a doctor and invalidates doctors and schedules', async () => {
    prisma.doctor.update.mockResolvedValue({ ...doctor, name: 'Dr. Wilson' });

    await expect(service.update(ID, { name: 'Dr. Wilson' })).resolves.toMatchObject({
      name: 'Dr. Wilson',
    });
    expect(cache.invalidate).toHaveBeenCalledWith(CacheNamespace.Doctors, CacheNamespace.Schedules);
  });

  it('throws NotFound when updating or deleting an unknown doctor', async () => {
    prisma.doctor.update.mockRejectedValue(prismaError('P2025'));
    prisma.doctor.delete.mockRejectedValue(prismaError('P2025'));

    await expect(service.update(ID, { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a doctor', async () => {
    prisma.doctor.delete.mockResolvedValue(doctor);

    await expect(service.remove(ID)).resolves.toBe(doctor);
    expect(cache.invalidate).toHaveBeenCalledWith(CacheNamespace.Doctors);
  });

  it('refuses to delete a doctor that still has schedules', async () => {
    prisma.doctor.delete.mockRejectedValue(prismaError('P2003'));
    await expect(service.remove(ID)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows unexpected errors', async () => {
    const failure = new Error('db down');
    prisma.doctor.delete.mockRejectedValue(failure);
    await expect(service.remove(ID)).rejects.toBe(failure);
  });
});
