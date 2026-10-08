import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { EMAIL_QUEUE } from './notification.contract';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
