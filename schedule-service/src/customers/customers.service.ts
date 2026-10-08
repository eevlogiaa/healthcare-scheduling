import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Customer } from '@prisma/client';
import { CacheNamespace } from '../cache/cache.constants';
import { CacheService } from '../cache/cache.service';
import { PaginationArgs } from '../common/dto/pagination.args';
import { Page, toPage, toSkip } from '../common/models/paginated.model';
import {
  isPrismaError,
  PRISMA_FOREIGN_KEY_VIOLATION,
  PRISMA_RECORD_NOT_FOUND,
  PRISMA_UNIQUE_VIOLATION,
} from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerInput } from './dto/create-customer.input';
import { UpdateCustomerInput } from './dto/update-customer.input';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(input: CreateCustomerInput): Promise<Customer> {
    try {
      const customer = await this.prisma.customer.create({ data: input });
      await this.cache.invalidate(CacheNamespace.Customers);
      return customer;
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  findAll(pagination: PaginationArgs): Promise<Page<Customer>> {
    return this.cache.wrap(
      CacheNamespace.Customers,
      `list:${pagination.page}:${pagination.limit}`,
      async () => {
        const [items, total] = await this.prisma.$transaction([
          this.prisma.customer.findMany({
            skip: toSkip(pagination),
            take: pagination.limit,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          }),
          this.prisma.customer.count(),
        ]);
        return toPage(items, total, pagination);
      },
    );
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.cache.wrap(CacheNamespace.Customers, `id:${id}`, () =>
      this.prisma.customer.findUnique({ where: { id } }),
    );
    if (!customer) throw notFound(id);
    return customer;
  }

  async update(id: string, input: UpdateCustomerInput): Promise<Customer> {
    try {
      const customer = await this.prisma.customer.update({ where: { id }, data: input });
      // schedule ikut bawa data customer, jadi cache schedule juga ikut basi
      await this.cache.invalidate(CacheNamespace.Customers, CacheNamespace.Schedules);
      return customer;
    } catch (error) {
      throw this.toHttpError(error, id);
    }
  }

  async remove(id: string): Promise<Customer> {
    try {
      const customer = await this.prisma.customer.delete({ where: { id } });
      await this.cache.invalidate(CacheNamespace.Customers);
      return customer;
    } catch (error) {
      throw this.toHttpError(error, id);
    }
  }

  private toHttpError(error: unknown, id?: string): unknown {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return new ConflictException('A customer with this email already exists');
    }
    if (isPrismaError(error, PRISMA_RECORD_NOT_FOUND) && id) {
      return notFound(id);
    }
    if (isPrismaError(error, PRISMA_FOREIGN_KEY_VIOLATION)) {
      return new ConflictException(
        'Customer still has schedules; delete those schedules before deleting the customer',
      );
    }
    return error;
  }
}

function notFound(id: string): NotFoundException {
  return new NotFoundException(`Customer with id "${id}" not found`);
}
