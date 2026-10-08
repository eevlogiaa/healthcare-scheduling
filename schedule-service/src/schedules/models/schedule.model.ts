import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { Paginated } from '../../common/models/paginated.model';
import { Customer } from '../../customers/models/customer.model';
import { Doctor } from '../../doctors/models/doctor.model';

@ObjectType({ description: 'A consultation between a customer and a doctor.' })
export class Schedule {
  @Field(() => ID, { description: 'Schedule ID (UUID).' })
  id: string;

  @Field({ description: 'Purpose of the consultation.' })
  objective: string;

  @Field(() => ID, { description: 'ID of the customer (patient).' })
  customerId: string;

  @Field(() => ID, { description: 'ID of the doctor.' })
  doctorId: string;

  @Field(() => GraphQLISODateTime, { description: 'Start time of the consultation.' })
  scheduledAt: Date;

  @Field(() => GraphQLISODateTime, { description: 'When the schedule was created.' })
  createdAt: Date;

  @Field(() => GraphQLISODateTime, { description: 'When the schedule was last updated.' })
  updatedAt: Date;

  @Field(() => Customer, { description: 'The customer (patient).' })
  customer: Customer;

  @Field(() => Doctor, { description: 'The doctor.' })
  doctor: Doctor;
}

@ObjectType({ description: 'A page of schedules.' })
export class PaginatedSchedules extends Paginated(Schedule) {}
