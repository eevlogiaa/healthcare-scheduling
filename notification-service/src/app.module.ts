import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { MailModule } from './mail/mail.module';
import { EMAIL_QUEUE } from './notifications/notification.contract';
import { ScheduleNotificationProcessor } from './notifications/schedule-notification.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
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
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
    MailModule,
  ],
  providers: [ScheduleNotificationProcessor],
})
export class AppModule {}
