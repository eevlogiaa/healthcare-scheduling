import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
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

  @IsString()
  @IsNotEmpty()
  SMTP_HOST: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number = 1025;

  /** true buat TLS langsung (biasanya port 465), selain itu pake STARTTLS otomatis */
  // baca raw value-nya, soalnya implicit conversion bikin string "false" jadi `true`
  @Transform(
    ({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
      obj[key] === true || obj[key] === 'true',
  )
  @IsBoolean()
  SMTP_SECURE: boolean = false;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM: string = 'Healthcare Clinic <no-reply@healthcare.local>';

  /** timezone IANA buat nampilin jam konsultasi di email */
  @IsString()
  @IsNotEmpty()
  APP_TIMEZONE: string = 'Asia/Jakarta';

  @IsInt()
  @Min(1)
  @Max(50)
  QUEUE_CONCURRENCY: number = 5;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const messages = validateSync(validated, { skipMissingProperties: false }).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
  if (!isValidTimeZone(validated.APP_TIMEZONE)) {
    messages.push(`APP_TIMEZONE "${validated.APP_TIMEZONE}" is not a valid IANA time zone`);
  }
  if (messages.length > 0) {
    throw new Error(`Invalid environment configuration:\n- ${messages.join('\n- ')}`);
  }
  return validated;
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}
