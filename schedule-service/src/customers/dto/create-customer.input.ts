import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizeEmail, trim } from '../../common/transforms';

@InputType({ description: 'Payload for creating a customer.' })
export class CreateCustomerInput {
  @Field({ description: 'Full name (1-100 characters).' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Field({ description: 'Email address. Case-insensitive and must be unique.' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;
}
