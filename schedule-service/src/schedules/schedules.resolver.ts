import { ParseUUIDPipe } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PaginationArgs } from '../common/dto/pagination.args';
import { Page } from '../common/models/paginated.model';
import { CreateScheduleInput } from './dto/create-schedule.input';
import { ScheduleFilterInput } from './dto/schedule-filter.input';
import { PaginatedSchedules, Schedule } from './models/schedule.model';
import { ScheduleWithRelations } from './schedule-with-relations';
import { SchedulesService } from './schedules.service';

@Resolver(() => Schedule)
export class SchedulesResolver {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Mutation(() => Schedule, {
    description:
      'Book a consultation. Fails with NOT_FOUND for an unknown customer/doctor and with ' +
      'CONFLICT when the doctor already has an overlapping consultation. Emails the customer.',
  })
  createSchedule(@Args('input') input: CreateScheduleInput): Promise<ScheduleWithRelations> {
    return this.schedulesService.create(input);
  }

  @Query(() => PaginatedSchedules, {
    description: 'List schedules ordered by start time, optionally filtered.',
  })
  schedules(
    @Args('filter', { type: () => ScheduleFilterInput, nullable: true })
    filter: ScheduleFilterInput | undefined,
    @Args() pagination: PaginationArgs,
  ): Promise<Page<ScheduleWithRelations>> {
    return this.schedulesService.findAll(filter ?? {}, pagination);
  }

  @Query(() => Schedule, { description: 'Get a schedule by ID. Fails with NOT_FOUND.' })
  schedule(
    @Args('id', { type: () => ID, description: 'Schedule ID.' }, ParseUUIDPipe) id: string,
  ): Promise<ScheduleWithRelations> {
    return this.schedulesService.findOne(id);
  }

  @Mutation(() => Schedule, {
    description: 'Cancel (delete) a schedule and return it. Emails the customer.',
  })
  deleteSchedule(
    @Args('id', { type: () => ID, description: 'Schedule ID.' }, ParseUUIDPipe) id: string,
  ): Promise<ScheduleWithRelations> {
    return this.schedulesService.remove(id);
  }
}
