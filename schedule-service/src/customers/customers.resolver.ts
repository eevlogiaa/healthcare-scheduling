import { ParseUUIDPipe } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PaginationArgs } from '../common/dto/pagination.args';
import { Page } from '../common/models/paginated.model';
import { CustomersService } from './customers.service';
import { CreateCustomerInput } from './dto/create-customer.input';
import { UpdateCustomerInput } from './dto/update-customer.input';
import { Customer, PaginatedCustomers } from './models/customer.model';

@Resolver(() => Customer)
export class CustomersResolver {
  constructor(private readonly customersService: CustomersService) {}

  @Mutation(() => Customer, {
    description: 'Create a customer. Fails with CONFLICT if the email is already used.',
  })
  createCustomer(@Args('input') input: CreateCustomerInput): Promise<Customer> {
    return this.customersService.create(input);
  }

  @Mutation(() => Customer, { description: 'Update a customer. Only provided fields change.' })
  updateCustomer(
    @Args('id', { type: () => ID, description: 'Customer ID.' }, ParseUUIDPipe) id: string,
    @Args('input') input: UpdateCustomerInput,
  ): Promise<Customer> {
    return this.customersService.update(id, input);
  }

  @Query(() => PaginatedCustomers, { description: 'List customers, newest first.' })
  customers(@Args() pagination: PaginationArgs): Promise<Page<Customer>> {
    return this.customersService.findAll(pagination);
  }

  @Query(() => Customer, { description: 'Get a customer by ID. Fails with NOT_FOUND.' })
  customer(
    @Args('id', { type: () => ID, description: 'Customer ID.' }, ParseUUIDPipe) id: string,
  ): Promise<Customer> {
    return this.customersService.findOne(id);
  }

  @Mutation(() => Customer, {
    description:
      'Delete a customer and return it. Fails with CONFLICT while the customer still has schedules.',
  })
  deleteCustomer(
    @Args('id', { type: () => ID, description: 'Customer ID.' }, ParseUUIDPipe) id: string,
  ): Promise<Customer> {
    return this.customersService.remove(id);
  }
}
