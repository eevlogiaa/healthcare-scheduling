import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulesResolver } from './schedules.resolver';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [NotificationsModule],
  providers: [SchedulesService, SchedulesResolver],
})
export class SchedulesModule {}
