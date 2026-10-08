import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { Paginated } from '../../common/models/paginated.model';

@ObjectType({ description: 'A patient of the clinic.' })
export class Customer {
  @Field(() => ID, { description: 'Customer ID (UUID).' })
  id: string;

  @Field({ description: 'Full name.' })
  name: string;

  @Field({ description: 'Unique, lower-cased email address. Notifications are sent here.' })
  email: string;

  @Field(() => GraphQLISODateTime, { description: 'When the customer was created.' })
  createdAt: Date;

  @Field(() => GraphQLISODateTime, { description: 'When the customer was last updated.' })
  updatedAt: Date;
}

@ObjectType({ description: 'A page of customers.' })
export class PaginatedCustomers extends Paginated(Customer) {}
