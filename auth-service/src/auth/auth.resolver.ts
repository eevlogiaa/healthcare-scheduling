import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User } from '../users/models/user.model';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import { AuthPayload } from './models/auth-payload.model';

@Resolver()
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @Mutation(() => User, {
    description: 'Register a new user. Fails with CONFLICT if the email is already registered.',
  })
  register(@Args('input') input: RegisterInput): Promise<User> {
    return this.auth.register(input);
  }

  @Mutation(() => AuthPayload, {
    description: 'Log in with email and password and receive a JWT access token.',
  })
  login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    return this.auth.login(input);
  }

  @Query(() => User, {
    description:
      'Validate an access token and return its owner. Fails with UNAUTHENTICATED when the token ' +
      'is invalid, expired or belongs to a user that no longer exists. Used by other services.',
  })
  validateToken(
    @Args('token', { description: 'The raw JWT, without the "Bearer " prefix.' }) token: string,
  ): Promise<User> {
    return this.auth.validateToken(token);
  }
}
