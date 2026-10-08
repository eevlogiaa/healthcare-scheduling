import { Field, GraphQLISODateTime, ID, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsDate, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { trim } from '../../common/transforms';

@InputType({ description: 'Payload for booking a consultation.' })
export class CreateScheduleInput {
  @Field({ description: 'Purpose of the consultation (1-500 characters).' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  objective: string;

  @Field(() => ID, { description: 'ID of an existing customer.' })
  @IsUUID()
  customerId: string;

  @Field(() => ID, { description: 'ID of an existing doctor.' })
  @IsUUID()
  doctorId: string;

  @Field(() => GraphQLISODateTime, {
    description:
      'Start time in ISO 8601 (e.g. "2030-01-15T09:00:00.000Z"). Must be in the future and must ' +
      'not overlap another consultation of the same doctor.',
  })
  @IsDate()
  scheduledAt: Date;
}
