import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { Request } from 'express';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { formatGraphQLError } from './common/format-graphql-error';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { CustomersModule } from './customers/customers.module';
import { DoctorsModule } from './doctors/doctors.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SchedulesModule } from './schedules/schedules.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => {
        const playground = config.get('GRAPHQL_PLAYGROUND', { infer: true });
        return {
          autoSchemaFile: true,
          sortSchema: true,
          playground,
          introspection: playground,
          context: ({ req }: { req: Request }) => ({ req }),
          formatError: formatGraphQLError,
        };
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        redis: {
          host: config.get('REDIS_HOST', { infer: true }),
          port: config.get('REDIS_PORT', { infer: true }),
          password: config.get('REDIS_PASSWORD', { infer: true }) || undefined,
        },
      }),
    }),
    PrismaModule,
    CacheModule,
    AuthModule,
    CustomersModule,
    DoctorsModule,
    SchedulesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
