import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { Paginated } from '../../common/models/paginated.model';

@ObjectType({ description: 'A doctor who can be booked for consultations.' })
export class Doctor {
  @Field(() => ID, { description: 'Doctor ID (UUID).' })
  id: string;

  @Field({ description: 'Full name.' })
  name: string;

  @Field(() => GraphQLISODateTime, { description: 'When the doctor was created.' })
  createdAt: Date;

  @Field(() => GraphQLISODateTime, { description: 'When the doctor was last updated.' })
  updatedAt: Date;
}

@ObjectType({ description: 'A page of doctors.' })
export class PaginatedDoctors extends Paginated(Doctor) {}
