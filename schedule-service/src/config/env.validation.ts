import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3002;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  /** base URL Auth Service, contoh: http://auth-service:3001 */
  @IsUrl({ require_tld: false, require_protocol: true })
  AUTH_SERVICE_URL: string;

  @IsInt()
  @Min(100)
  AUTH_REQUEST_TIMEOUT_MS: number = 5000;

  /** lama cache hasil validasi token (tetep dibatesin expiry token). 0 = matiin */
  @IsInt()
  @Min(0)
  AUTH_CACHE_TTL_SECONDS: number = 60;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  /** TTL cache hasil query. 0 = matiin */
  @IsInt()
  @Min(0)
  CACHE_TTL_SECONDS: number = 60;

  /** durasi 1 konsultasi, jadwal dokter yang sama gak boleh overlap di rentang ini */
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  SCHEDULE_DURATION_MINUTES: number = 30;

  // baca raw value-nya, soalnya implicit conversion bikin string "false" jadi `true`
  @Transform(
    ({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
      obj[key] === true || obj[key] === 'true',
  )
  @IsBoolean()
  GRAPHQL_PLAYGROUND: boolean = true;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new Error(`Invalid environment configuration:\n- ${messages.join('\n- ')}`);
  }
  return validated;
}
