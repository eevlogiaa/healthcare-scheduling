import { Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { CacheService } from '../cache/cache.service';
import { AuthClientService } from './auth-client.service';

const USER = { id: 'user-1', email: 'jane@example.com' };

function jwtExpiringIn(seconds: number): string {
  const payload = { sub: USER.id, exp: Math.floor(Date.now() / 1000) + seconds };
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AuthClientService', () => {
  let fetchMock: jest.SpyInstance;
  let cache: { get: jest.Mock; set: jest.Mock };
  let client: AuthClientService;

  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

  beforeEach(async () => {
    fetchMock = jest.spyOn(global, 'fetch');
    cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() };
    const config = new ConfigService({
      AUTH_SERVICE_URL: 'http://auth-service:3001',
      AUTH_REQUEST_TIMEOUT_MS: 1000,
      AUTH_CACHE_TTL_SECONDS: 60,
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthClientService,
        { provide: CacheService, useValue: cache },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    client = moduleRef.get(AuthClientService);
  });

  afterEach(() => fetchMock.mockRestore());
  afterAll(() => jest.restoreAllMocks());

  it('calls the Auth Service validateToken query and caches the result', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { validateToken: USER } }));
    const token = jwtExpiringIn(3600);

    await expect(client.validateToken(token)).resolves.toEqual(USER);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://auth-service:3001/graphql');
    const body = JSON.parse(init.body);
    expect(body.query).toContain('validateToken(token: $token)');
    expect(body.variables).toEqual({ token });
    const [key, value, ttl] = cache.set.mock.calls[0];
    expect(key).toMatch(/^auth:token:[0-9a-f]{64}$/);
    expect(key).not.toContain(token);
    expect(value).toEqual(USER);
    expect(ttl).toBe(60);
  });

  it('never caches a token beyond its expiry', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { validateToken: USER } }));

    await client.validateToken(jwtExpiringIn(10));

    const ttl = cache.set.mock.calls[0][2];
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(10);
  });

  it('serves a cached validation without calling the Auth Service', async () => {
    cache.get.mockResolvedValue(USER);

    await expect(client.validateToken('token')).resolves.toEqual(USER);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects tokens the Auth Service reports as unauthenticated', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: null,
        errors: [{ message: 'Invalid or expired token', extensions: { code: 'UNAUTHENTICATED' } }],
      }),
    );

    await expect(client.validateToken('bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('reports the Auth Service as unavailable when it cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(client.validateToken('token')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('reports the Auth Service as unavailable on an unexpected response', async () => {
    fetchMock.mockResolvedValue(new Response('Bad Gateway', { status: 502 }));

    await expect(client.validateToken('token')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not cache a token without an expiry claim', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { validateToken: USER } }));

    await client.validateToken('not-a-jwt');

    expect(cache.set).toHaveBeenCalledWith(expect.any(String), USER, 0);
  });
});
