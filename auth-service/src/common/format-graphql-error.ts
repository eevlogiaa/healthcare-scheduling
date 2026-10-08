import { Logger } from '@nestjs/common';
import { GraphQLFormattedError } from 'graphql';

const logger = new Logger('GraphQLError');

const STATUS_TO_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  503: 'SERVICE_UNAVAILABLE',
};

/** Error yang message-nya aman ditampilin apa adanya ke client. */
const CLIENT_ERROR_CODES = new Set([
  'GRAPHQL_PARSE_FAILED',
  'GRAPHQL_VALIDATION_FAILED',
  'BAD_USER_INPUT',
  'BAD_REQUEST',
  'PERSISTED_QUERY_NOT_FOUND',
  'PERSISTED_QUERY_NOT_SUPPORTED',
  'OPERATION_RESOLUTION_FAILURE',
]);

interface HttpExceptionBody {
  statusCode?: number;
  message?: string | string[];
}

/**
 * Nyeragamin semua error GraphQL jadi `{ message, extensions: { code, statusCode? } }`.
 * - HttpException Nest: message tetap, `code`-nya dibikin konsisten
 * - Error validasi: pesan per field masuk ke `extensions.details`
 * - Error gak terduga: di-log aja, client cukup dapet "Internal server error"
 */
export function formatGraphQLError(
  formatted: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const extensions = formatted.extensions ?? {};
  const original = extensions.originalError as HttpExceptionBody | undefined;
  const statusCode = original?.statusCode ?? (extensions.status as number | undefined);
  const base = { locations: formatted.locations, path: formatted.path };

  if (statusCode && statusCode < 500) {
    const details = Array.isArray(original?.message) ? original.message : undefined;
    return {
      ...base,
      message: details ? 'Validation failed' : formatted.message,
      extensions: {
        code:
          STATUS_TO_CODE[statusCode] ??
          (typeof extensions.code === 'string' ? extensions.code : 'BAD_REQUEST'),
        statusCode,
        ...(details && { details }),
      },
    };
  }

  const code = (extensions.code as string | undefined) ?? 'INTERNAL_SERVER_ERROR';
  if (statusCode === 503 || CLIENT_ERROR_CODES.has(code)) {
    return {
      ...base,
      message: formatted.message,
      extensions: { code: statusCode ? STATUS_TO_CODE[statusCode] : code },
    };
  }

  logger.error(formatted.message, error instanceof Error ? error.stack : undefined);
  return {
    ...base,
    message: 'Internal server error',
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  };
}
