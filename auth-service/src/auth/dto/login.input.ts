import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizeEmail } from './normalize-email';

@InputType({ description: 'Credentials used to obtain an access token.' })
export class LoginInput {
  @Field({ description: 'Registered email address (case-insensitive).' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  @Field({ description: 'Account password.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
