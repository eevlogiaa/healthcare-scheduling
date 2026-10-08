import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  let service: UsersService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('finds a user by email', async () => {
    await service.findByEmail('jane@example.com');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'jane@example.com' } });
  });

  it('finds a user by id', async () => {
    await service.findById('id-1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'id-1' } });
  });

  it('creates a user with the given password hash', async () => {
    await service.create('jane@example.com', 'hash');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: 'jane@example.com', password: 'hash' },
    });
  });
});
