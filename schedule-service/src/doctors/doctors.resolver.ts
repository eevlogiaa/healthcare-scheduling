import { ParseUUIDPipe } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PaginationArgs } from '../common/dto/pagination.args';
import { Page } from '../common/models/paginated.model';
import { DoctorsService } from './doctors.service';
import { CreateDoctorInput } from './dto/create-doctor.input';
import { UpdateDoctorInput } from './dto/update-doctor.input';
import { Doctor, PaginatedDoctors } from './models/doctor.model';

@Resolver(() => Doctor)
export class DoctorsResolver {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Mutation(() => Doctor, { description: 'Create a doctor.' })
  createDoctor(@Args('input') input: CreateDoctorInput): Promise<Doctor> {
    return this.doctorsService.create(input);
  }

  @Mutation(() => Doctor, { description: 'Update a doctor. Only provided fields change.' })
  updateDoctor(
    @Args('id', { type: () => ID, description: 'Doctor ID.' }, ParseUUIDPipe) id: string,
    @Args('input') input: UpdateDoctorInput,
  ): Promise<Doctor> {
    return this.doctorsService.update(id, input);
  }

  @Query(() => PaginatedDoctors, { description: 'List doctors, newest first.' })
  doctors(@Args() pagination: PaginationArgs): Promise<Page<Doctor>> {
    return this.doctorsService.findAll(pagination);
  }

  @Query(() => Doctor, { description: 'Get a doctor by ID. Fails with NOT_FOUND.' })
  doctor(
    @Args('id', { type: () => ID, description: 'Doctor ID.' }, ParseUUIDPipe) id: string,
  ): Promise<Doctor> {
    return this.doctorsService.findOne(id);
  }

  @Mutation(() => Doctor, {
    description:
      'Delete a doctor and return it. Fails with CONFLICT while the doctor still has schedules.',
  })
  deleteDoctor(
    @Args('id', { type: () => ID, description: 'Doctor ID.' }, ParseUUIDPipe) id: string,
  ): Promise<Doctor> {
    return this.doctorsService.remove(id);
  }
}
