import { Field, Int, ObjectType } from '@nestjs/graphql';
import { User } from '../../users/models/user.model';

@ObjectType({ description: 'Result of a successful login.' })
export class AuthPayload {
  @Field({ description: 'JWT to send as `Authorization: Bearer <accessToken>`.' })
  accessToken: string;

  @Field({ description: 'Always "Bearer".' })
  tokenType: string;

  @Field(() => Int, { description: 'Token lifetime in seconds.' })
  expiresIn: number;

  @Field(() => User, { description: 'The authenticated user.' })
  user: User;
}
