import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsDefinedOrAbsent } from '../../common/is-defined-or-absent';
import { trim } from '../../common/transforms';

@InputType({ description: 'Fields to change on a doctor. Omitted fields are left unchanged.' })
export class UpdateDoctorInput {
  @Field({ nullable: true, description: 'New full name (1-100 characters).' })
  @IsDefinedOrAbsent()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;
}
