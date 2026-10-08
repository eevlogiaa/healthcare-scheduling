import { Field, GraphQLISODateTime, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

@InputType({ description: 'Filters for listing schedules. All filters are combined with AND.' })
export class ScheduleFilterInput {
  @Field(() => ID, { nullable: true, description: 'Only schedules of this customer.' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @Field(() => ID, { nullable: true, description: 'Only schedules with this doctor.' })
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Only schedules starting at or after this time.',
  })
  @IsOptional()
  @IsDate()
  from?: Date;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Only schedules starting at or before this time.',
  })
  @IsOptional()
  @IsDate()
  to?: Date;
}
