import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { CacheService } from '../cache/cache.service';
import { EnvironmentVariables } from '../config/env.validation';
import { AuthUser } from './auth-user';

const VALIDATE_TOKEN_QUERY = /* GraphQL */ `
  query ValidateToken($token: String!) {
    validateToken(token: $token) {
      id
      email
    }
  }
`;

interface ValidateTokenResponse {
  data?: { validateToken?: AuthUser | null } | null;
  errors?: { message: string; extensions?: { code?: string } }[];
}

/** Validasi access token lewat query `validateToken` di Auth Service. */
@Injectable()
export class AuthClientService {
  private readonly logger = new Logger(AuthClientService.name);
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlSeconds: number;

  constructor(
    private readonly cache: CacheService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.endpoint = new URL('/graphql', config.get('AUTH_SERVICE_URL', { infer: true })).toString();
    this.timeoutMs = config.get('AUTH_REQUEST_TIMEOUT_MS', { infer: true });
    this.cacheTtlSeconds = config.get('AUTH_CACHE_TTL_SECONDS', { infer: true });
  }

  async validateToken(token: string): Promise<AuthUser> {
    // key cache pake hash token, bukan token mentahnya
    const cacheKey = `auth:token:${createHash('sha256').update(token).digest('hex')}`;
    const cached = await this.cache.get<AuthUser>(cacheKey);
    if (cached) return cached;

    const user = await this.requestValidation(token);
    await this.cache.set(cacheKey, user, this.cacheTtlFor(token));
    return user;
  }

  private async requestValidation(token: string): Promise<AuthUser> {
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: VALIDATE_TOKEN_QUERY, variables: { token } }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      this.logger.error(`Auth service request failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Authentication service is unavailable');
    }

    const body = (await response.json().catch(() => null)) as ValidateTokenResponse | null;
    const user = body?.data?.validateToken;
    if (user) return user;

    if (body?.errors?.some((error) => error.extensions?.code === 'UNAUTHENTICATED')) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    this.logger.error(
      `Unexpected auth service response (HTTP ${response.status}): ${JSON.stringify(body?.errors ?? body)}`,
    );
    throw new ServiceUnavailableException('Authentication service is unavailable');
  }

  /** Cache token gak boleh lebih lama dari expiry token itu sendiri. */
  private cacheTtlFor(token: string): number {
    const expiresAt = readExpiry(token);
    if (expiresAt === undefined) return 0;
    const remaining = expiresAt - Math.floor(Date.now() / 1000);
    return Math.max(0, Math.min(this.cacheTtlSeconds, remaining));
  }
}

/** Ambil claim `exp` dari JWT yang udah diverifikasi Auth Service. */
function readExpiry(token: string): number | undefined {
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    );
    if (typeof payload === 'object' && payload !== null && 'exp' in payload) {
      return typeof payload.exp === 'number' ? payload.exp : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
