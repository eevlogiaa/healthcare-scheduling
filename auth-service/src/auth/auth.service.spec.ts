import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '7f1c2a7e-8a5b-4c1e-9d0a-3b2f6c4d5e6f',
    email: 'jane@example.com',
    password: bcrypt.hashSync('correct-password', 4),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('AuthService', () => {
  let users: jest.Mocked<Pick<UsersService, 'findByEmail' | 'findById' | 'create'>>;
  let jwt: JwtService;
  let service: AuthService;

  beforeEach(async () => {
    users = { findByEmail: jest.fn(), findById: jest.fn(), create: jest.fn() };
    jwt = new JwtService({ secret: SECRET, signOptions: { expiresIn: 3600 } });
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          // salt rounds sengaja kecil biar test cepet
          useValue: new ConfigService({ BCRYPT_SALT_ROUNDS: 4, JWT_EXPIRES_IN: 3600 }),
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('stores a bcrypt hash, never the plain password', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.create.mockImplementation((email, hash) =>
        Promise.resolve(makeUser({ email, password: hash })),
      );

      const user = await service.register({ email: 'jane@example.com', password: 'secret-pass' });

      const [email, hash] = users.create.mock.calls[0];
      expect(email).toBe('jane@example.com');
      expect(hash).not.toBe('secret-pass');
      expect(await bcrypt.compare('secret-pass', hash)).toBe(true);
      expect(user.email).toBe('jane@example.com');
    });

    it('rejects an email that is already registered', async () => {
      users.findByEmail.mockResolvedValue(makeUser());

      await expect(
        service.register({ email: 'jane@example.com', password: 'secret-pass' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('maps a unique-constraint race to a conflict', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.register({ email: 'jane@example.com', password: 'secret-pass' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rethrows unexpected errors', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.register({ email: 'jane@example.com', password: 'secret-pass' }),
      ).rejects.toThrow('db down');
    });
  });

  describe('login', () => {
    it('returns a signed JWT for valid credentials', async () => {
      const user = makeUser();
      users.findByEmail.mockResolvedValue(user);

      const result = await service.login({ email: user.email, password: 'correct-password' });

      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(3600);
      expect(result.user).toBe(user);
      const payload = await jwt.verifyAsync(result.accessToken);
      expect(payload).toMatchObject({ sub: user.id, email: user.email });
      expect(payload.exp - payload.iat).toBe(3600);
    });

    it('rejects a wrong password', async () => {
      users.findByEmail.mockResolvedValue(makeUser());

      await expect(
        service.login({ email: 'jane@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('rejects an unknown email with the same error', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever-pass' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });
  });

  describe('validateToken', () => {
    it('returns the owner of a valid token', async () => {
      const user = makeUser();
      users.findById.mockResolvedValue(user);
      const token = await jwt.signAsync({ sub: user.id, email: user.email });

      await expect(service.validateToken(token)).resolves.toBe(user);
      expect(users.findById).toHaveBeenCalledWith(user.id);
    });

    it('rejects a malformed token', async () => {
      await expect(service.validateToken('not-a-jwt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token signed with another secret', async () => {
      const forged = await new JwtService({
        secret: 'another-secret-another-secret-123',
      }).signAsync({ sub: 'x', email: 'x@example.com' });
      await expect(service.validateToken(forged)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an expired token', async () => {
      const expired = await jwt.signAsync({ sub: 'x', email: 'x@example.com' }, { expiresIn: -10 });
      await expect(service.validateToken(expired)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token whose user no longer exists', async () => {
      users.findById.mockResolvedValue(null);
      const token = await jwt.signAsync({ sub: 'deleted-user', email: 'gone@example.com' });

      await expect(service.validateToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
