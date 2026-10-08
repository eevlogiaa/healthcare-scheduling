import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A registered user. The password hash is never exposed.' })
export class User {
  @Field(() => ID, { description: 'User ID (UUID v4).' })
  id: string;

  @Field({ description: 'Unique, lower-cased email address.' })
  email: string;

  @Field(() => GraphQLISODateTime, { description: 'When the user registered.' })
  createdAt: Date;

  @Field(() => GraphQLISODateTime, { description: 'When the user was last updated.' })
  updatedAt: Date;
}
