import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import { AuthClientService } from './auth-client.service';
import { AuthUser } from './auth-user';
import { IS_PUBLIC_KEY } from './public.decorator';

export type AuthenticatedRequest = Request & { user?: AuthUser };

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

export function extractBearerToken(header: string | undefined): string | undefined {
  return header?.trim().match(BEARER_PATTERN)?.[1];
}

/**
 * Guard global: semua resolver wajib kirim `Authorization: Bearer <token>`,
 * nanti divalidasi ke Auth Service. Handler yang ada `@Public()` di-skip.
 */
@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authClient: AuthClientService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = this.getRequest(context);
    // 1 request bisa punya beberapa root field, cukup validasi sekali aja
    if (request.user) return true;

    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    request.user = await this.authClient.validateToken(token);
    return true;
  }

  private getRequest(context: ExecutionContext): AuthenticatedRequest {
    if (context.getType<GqlContextType>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext<{ req: AuthenticatedRequest }>().req;
    }
    return context.switchToHttp().getRequest<AuthenticatedRequest>();
  }
}
