import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/transforms';

@InputType({ description: 'Payload for creating a doctor.' })
export class CreateDoctorInput {
  @Field({ description: 'Full name (1-100 characters).' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
