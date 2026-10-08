import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeEmail } from './normalize-email';

@InputType({ description: 'Payload for registering a new user.' })
export class RegisterInput {
  @Field({ description: 'Email address. Case-insensitive and must be unique.' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;

  @Field({ description: 'Plain-text password, 8 to 72 characters. Stored as a bcrypt hash.' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
