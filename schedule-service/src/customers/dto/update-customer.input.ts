import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsDefinedOrAbsent } from '../../common/is-defined-or-absent';
import { normalizeEmail, trim } from '../../common/transforms';

@InputType({ description: 'Fields to change on a customer. Omitted fields are left unchanged.' })
export class UpdateCustomerInput {
  @Field({ nullable: true, description: 'New full name (1-100 characters).' })
  @IsDefinedOrAbsent()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @Field({ nullable: true, description: 'New email address. Must be unique.' })
  @IsDefinedOrAbsent()
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email?: string;
}
