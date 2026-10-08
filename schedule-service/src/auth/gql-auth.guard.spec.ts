import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Test } from '@nestjs/testing';
import { AuthClientService } from './auth-client.service';
import { AuthUser } from './auth-user';
import { extractBearerToken, GqlAuthGuard } from './gql-auth.guard';
import { Public } from './public.decorator';

const USER = { id: 'user-1', email: 'jane@example.com' };

interface FakeRequest {
  headers: { authorization?: string };
  user?: AuthUser;
}

class FakeResolver {
  protected(): void {}

  @Public()
  open(): void {}
}

// argumen resolver GraphQL: [root, args, context, info]
function graphqlContext(request: FakeRequest, handler = FakeResolver.prototype.protected) {
  const context = new ExecutionContextHost([{}, {}, { req: request }, {}], FakeResolver, handler);
  context.setType('graphql');
  return context;
}

function httpContext(request: FakeRequest, handler = FakeResolver.prototype.protected) {
  return new ExecutionContextHost([request, {}], FakeResolver, handler);
}

describe('extractBearerToken', () => {
  it.each([
    ['Bearer abc.def.ghi', 'abc.def.ghi'],
    ['bearer   abc', 'abc'],
    ['  Bearer abc  ', 'abc'],
    ['Basic abc', undefined],
    ['Bearer', undefined],
    ['Bearer a b', undefined],
    [undefined, undefined],
  ])('extracts the token from %p', (header, expected) => {
    expect(extractBearerToken(header)).toBe(expected);
  });
});

describe('GqlAuthGuard', () => {
  let authClient: { validateToken: jest.Mock };
  let guard: GqlAuthGuard;

  beforeEach(async () => {
    authClient = { validateToken: jest.fn().mockResolvedValue(USER) };
    const moduleRef = await Test.createTestingModule({
      providers: [GqlAuthGuard, Reflector, { provide: AuthClientService, useValue: authClient }],
    }).compile();
    guard = moduleRef.get(GqlAuthGuard);
  });

  it('lets @Public() handlers through without a token', async () => {
    const context = httpContext({ headers: {} }, FakeResolver.prototype.open);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authClient.validateToken).not.toHaveBeenCalled();
  });

  it('rejects a GraphQL request without a bearer token', async () => {
    await expect(guard.canActivate(graphqlContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authClient.validateToken).not.toHaveBeenCalled();
  });

  it('validates the token and attaches the user to the request', async () => {
    const request: FakeRequest = { headers: { authorization: 'Bearer good-token' } };

    await expect(guard.canActivate(graphqlContext(request))).resolves.toBe(true);

    expect(authClient.validateToken).toHaveBeenCalledWith('good-token');
    expect(request.user).toEqual(USER);
  });

  it('validates only once per request', async () => {
    const request: FakeRequest = { headers: { authorization: 'Bearer good-token' }, user: USER };

    await expect(guard.canActivate(graphqlContext(request))).resolves.toBe(true);
    expect(authClient.validateToken).not.toHaveBeenCalled();
  });

  it('propagates a rejected token', async () => {
    authClient.validateToken.mockRejectedValue(new UnauthorizedException());

    await expect(
      guard.canActivate(httpContext({ headers: { authorization: 'Bearer bad' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
