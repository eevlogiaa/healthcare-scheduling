import { Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CustomersResolver } from './customers/customers.resolver';
import { CustomersService } from './customers/customers.service';
import { DoctorsResolver } from './doctors/doctors.resolver';
import { DoctorsService } from './doctors/doctors.service';
import { SchedulesResolver } from './schedules/schedules.resolver';
import { SchedulesService } from './schedules/schedules.service';

/** Resolver-nya tipis, tiap operasi cuma diterusin ke service dengan argumen yang sama. */
function serviceMock() {
  return {
    create: jest.fn().mockResolvedValue('created'),
    update: jest.fn().mockResolvedValue('updated'),
    findAll: jest.fn().mockResolvedValue('page'),
    findOne: jest.fn().mockResolvedValue('one'),
    remove: jest.fn().mockResolvedValue('removed'),
  };
}

async function resolverWith<R>(
  resolver: Type<R>,
  service: Type<unknown>,
  mock: object,
): Promise<R> {
  const moduleRef = await Test.createTestingModule({
    providers: [resolver, { provide: service, useValue: mock }],
  }).compile();
  return moduleRef.get(resolver);
}

const ID = '0b6c7f9e-4c1a-4d4e-9f3a-1a2b3c4d5e6f';
const pagination = { page: 1, limit: 10 };

describe('CustomersResolver', () => {
  const service = serviceMock();
  const input = { name: 'Jane', email: 'jane@example.com' };
  let resolver: CustomersResolver;

  beforeAll(async () => {
    resolver = await resolverWith(CustomersResolver, CustomersService, service);
  });

  it('delegates every operation', async () => {
    await expect(resolver.createCustomer(input)).resolves.toBe('created');
    await expect(resolver.updateCustomer(ID, { name: 'J' })).resolves.toBe('updated');
    await expect(resolver.customers(pagination)).resolves.toBe('page');
    await expect(resolver.customer(ID)).resolves.toBe('one');
    await expect(resolver.deleteCustomer(ID)).resolves.toBe('removed');
    expect(service.create).toHaveBeenCalledWith(input);
    expect(service.update).toHaveBeenCalledWith(ID, { name: 'J' });
    expect(service.findAll).toHaveBeenCalledWith(pagination);
    expect(service.findOne).toHaveBeenCalledWith(ID);
    expect(service.remove).toHaveBeenCalledWith(ID);
  });
});

describe('DoctorsResolver', () => {
  const service = serviceMock();
  let resolver: DoctorsResolver;

  beforeAll(async () => {
    resolver = await resolverWith(DoctorsResolver, DoctorsService, service);
  });

  it('delegates every operation', async () => {
    await expect(resolver.createDoctor({ name: 'Dr. House' })).resolves.toBe('created');
    await expect(resolver.updateDoctor(ID, { name: 'Dr. W' })).resolves.toBe('updated');
    await expect(resolver.doctors(pagination)).resolves.toBe('page');
    await expect(resolver.doctor(ID)).resolves.toBe('one');
    await expect(resolver.deleteDoctor(ID)).resolves.toBe('removed');
    expect(service.update).toHaveBeenCalledWith(ID, { name: 'Dr. W' });
    expect(service.remove).toHaveBeenCalledWith(ID);
  });
});

describe('SchedulesResolver', () => {
  const service = serviceMock();
  let resolver: SchedulesResolver;

  beforeAll(async () => {
    resolver = await resolverWith(SchedulesResolver, SchedulesService, service);
  });

  it('delegates every operation', async () => {
    const input = {
      objective: 'Check-up',
      customerId: ID,
      doctorId: ID,
      scheduledAt: new Date('2030-01-01T09:00:00Z'),
    };
    await expect(resolver.createSchedule(input)).resolves.toBe('created');
    await expect(resolver.schedule(ID)).resolves.toBe('one');
    await expect(resolver.deleteSchedule(ID)).resolves.toBe('removed');
    expect(service.create).toHaveBeenCalledWith(input);
  });

  it('treats a missing filter as "no filter"', async () => {
    await expect(resolver.schedules(undefined, pagination)).resolves.toBe('page');
    expect(service.findAll).toHaveBeenLastCalledWith({}, pagination);

    await resolver.schedules({ doctorId: ID }, pagination);
    expect(service.findAll).toHaveBeenLastCalledWith({ doctorId: ID }, pagination);
  });
});
