import { Test } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';

describe('AuthResolver', () => {
  const auth = {
    register: jest.fn().mockResolvedValue('registered'),
    login: jest.fn().mockResolvedValue('logged-in'),
    validateToken: jest.fn().mockResolvedValue('user'),
  };
  const credentials = { email: 'jane@example.com', password: 'secret-pass' };
  let resolver: AuthResolver;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AuthResolver, { provide: AuthService, useValue: auth }],
    }).compile();
    resolver = moduleRef.get(AuthResolver);
  });

  it('delegates register', async () => {
    await expect(resolver.register(credentials)).resolves.toBe('registered');
    expect(auth.register).toHaveBeenCalledWith(credentials);
  });

  it('delegates login', async () => {
    await expect(resolver.login(credentials)).resolves.toBe('logged-in');
    expect(auth.login).toHaveBeenCalledWith(credentials);
  });

  it('delegates validateToken', async () => {
    await expect(resolver.validateToken('token')).resolves.toBe('user');
    expect(auth.validateToken).toHaveBeenCalledWith('token');
  });
});
