import { Logger } from '@nestjs/common';
import { formatGraphQLError } from './format-graphql-error';

describe('formatGraphQLError', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterAll(() => jest.restoreAllMocks());

  it('maps an HTTP exception to a stable code', () => {
    const result = formatGraphQLError(
      {
        message: 'Invalid email or password',
        path: ['login'],
        extensions: {
          code: 'UNAUTHENTICATED',
          originalError: { statusCode: 401, message: 'Invalid email or password' },
        },
      },
      new Error(),
    );
    expect(result).toEqual({
      message: 'Invalid email or password',
      path: ['login'],
      locations: undefined,
      extensions: { code: 'UNAUTHENTICATED', statusCode: 401 },
    });
  });

  it('exposes validation messages as details', () => {
    const result = formatGraphQLError(
      {
        message: 'Bad Request Exception',
        extensions: {
          originalError: { statusCode: 400, message: ['email must be a valid email address'] },
        },
      },
      new Error(),
    );
    expect(result.message).toBe('Validation failed');
    expect(result.extensions).toEqual({
      code: 'BAD_REQUEST',
      statusCode: 400,
      details: ['email must be a valid email address'],
    });
  });

  it('keeps GraphQL validation errors visible', () => {
    const result = formatGraphQLError(
      { message: 'Cannot query field "x"', extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } },
      new Error(),
    );
    expect(result).toMatchObject({
      message: 'Cannot query field "x"',
      extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
    });
  });

  it('hides unexpected internal errors', () => {
    const result = formatGraphQLError(
      { message: 'connection refused at 10.0.0.5', extensions: { code: 'INTERNAL_SERVER_ERROR' } },
      new Error('connection refused at 10.0.0.5'),
    );
    expect(result.message).toBe('Internal server error');
    expect(result.extensions).toEqual({ code: 'INTERNAL_SERVER_ERROR' });
  });

  it('keeps service-unavailable messages', () => {
    const result = formatGraphQLError(
      {
        message: 'Authentication service is unavailable',
        extensions: { originalError: { statusCode: 503 } },
      },
      new Error(),
    );
    expect(result).toMatchObject({
      message: 'Authentication service is unavailable',
      extensions: { code: 'SERVICE_UNAVAILABLE' },
    });
  });
});
