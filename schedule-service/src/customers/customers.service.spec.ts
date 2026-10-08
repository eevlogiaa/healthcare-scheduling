import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CacheNamespace } from '../cache/cache.constants';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { passThroughCache, prismaError } from '../test-utils/prisma-mocks';
import { CustomersService } from './customers.service';

const ID = '0b6c7f9e-4c1a-4d4e-9f3a-1a2b3c4d5e6f';
const customer = {
  id: ID,
  name: 'Jane Doe',
  email: 'jane@example.com',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('CustomersService', () => {
  let prisma: {
    customer: Record<
      'create' | 'findMany' | 'count' | 'findUnique' | 'update' | 'delete',
      jest.Mock
    >;
    $transaction: jest.Mock;
  };
  let cache: ReturnType<typeof passThroughCache>;
  let service: CustomersService;

  beforeEach(async () => {
    prisma = {
      customer: {
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
        CustomersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = moduleRef.get(CustomersService);
  });

  describe('create', () => {
    it('creates the customer and invalidates the customer cache', async () => {
      prisma.customer.create.mockResolvedValue(customer);

      await expect(service.create({ name: 'Jane Doe', email: 'jane@example.com' })).resolves.toBe(
        customer,
      );
      expect(cache.invalidate).toHaveBeenCalledWith(CacheNamespace.Customers);
    });

    it('turns a duplicate email into a conflict', async () => {
      prisma.customer.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.create({ name: 'Jane Doe', email: 'jane@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(cache.invalidate).not.toHaveBeenCalled();
    });

    it('rethrows unexpected errors untouched', async () => {
      const failure = new Error('db down');
      prisma.customer.create.mockRejectedValue(failure);

      await expect(service.create({ name: 'Jane', email: 'jane@example.com' })).rejects.toBe(
        failure,
      );
    });
  });

  describe('findAll', () => {
    it('returns a page with metadata', async () => {
      prisma.customer.findMany.mockResolvedValue([customer]);
      prisma.customer.count.mockResolvedValue(21);

      const page = await service.findAll({ page: 2, limit: 10 });

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(page.items).toEqual([customer]);
      expect(page.pageInfo).toEqual({
        total: 21,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
      expect(cache.wrap).toHaveBeenCalledWith(
        CacheNamespace.Customers,
        'list:2:10',
        expect.any(Function),
      );
    });
  });

  describe('findOne', () => {
    it('returns the customer', async () => {
      prisma.customer.findUnique.mockResolvedValue(customer);
      await expect(service.findOne(ID)).resolves.toBe(customer);
    });

    it('throws NotFound for an unknown id', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates and invalidates customers and schedules', async () => {
      prisma.customer.update.mockResolvedValue({ ...customer, name: 'Janet' });

      await service.update(ID, { name: 'Janet' });

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { name: 'Janet' },
      });
      expect(cache.invalidate).toHaveBeenCalledWith(
        CacheNamespace.Customers,
        CacheNamespace.Schedules,
      );
    });

    it('throws NotFound for an unknown id', async () => {
      prisma.customer.update.mockRejectedValue(prismaError('P2025'));
      await expect(service.update(ID, { name: 'Janet' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Conflict when the new email is taken', async () => {
      prisma.customer.update.mockRejectedValue(prismaError('P2002'));
      await expect(service.update(ID, { email: 'taken@example.com' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('deletes and returns the customer', async () => {
      prisma.customer.delete.mockResolvedValue(customer);

      await expect(service.remove(ID)).resolves.toBe(customer);
      expect(cache.invalidate).toHaveBeenCalledWith(CacheNamespace.Customers);
    });

    it('throws NotFound for an unknown id', async () => {
      prisma.customer.delete.mockRejectedValue(prismaError('P2025'));
      await expect(service.remove(ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to delete a customer that still has schedules', async () => {
      prisma.customer.delete.mockRejectedValue(prismaError('P2003'));
      await expect(service.remove(ID)).rejects.toThrow(/still has schedules/);
    });
  });
});
