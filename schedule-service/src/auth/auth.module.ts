import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthClientService } from './auth-client.service';
import { GqlAuthGuard } from './gql-auth.guard';

@Module({
  providers: [AuthClientService, { provide: APP_GUARD, useClass: GqlAuthGuard }],
})
export class AuthModule {}
