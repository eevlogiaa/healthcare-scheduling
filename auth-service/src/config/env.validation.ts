import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3001;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters long' })
  JWT_SECRET: string;

  /** umur access token, dalam detik */
  @IsInt()
  @Min(60)
  JWT_EXPIRES_IN: number = 3600;

  @IsInt()
  @Min(10)
  @Max(15)
  BCRYPT_SALT_ROUNDS: number = 10;

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
