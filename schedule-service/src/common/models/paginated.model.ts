import { Type } from '@nestjs/common';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PaginationArgs } from '../dto/pagination.args';

@ObjectType({ description: 'Offset pagination metadata.' })
export class PageInfo {
  @Field(() => Int, { description: 'Total number of items matching the query.' })
  total: number;

  @Field(() => Int, { description: 'Current page number (1-based).' })
  page: number;

  @Field(() => Int, { description: 'Maximum number of items per page.' })
  limit: number;

  @Field(() => Int, { description: 'Total number of pages.' })
  totalPages: number;

  @Field({ description: 'Whether a page after this one exists.' })
  hasNextPage: boolean;

  @Field({ description: 'Whether a page before this one exists.' })
  hasPreviousPage: boolean;
}

export interface Page<T> {
  items: T[];
  pageInfo: PageInfo;
}

/** Bikin object type GraphQL `{ items, pageInfo }` buat tipe item yang dikasih. */
export function Paginated<T>(itemType: Type<T>): Type<Page<T>> {
  @ObjectType({ isAbstract: true })
  class PaginatedType implements Page<T> {
    @Field(() => [itemType], { description: 'Items on the current page.' })
    items: T[];

    @Field(() => PageInfo, { description: 'Pagination metadata.' })
    pageInfo: PageInfo;
  }
  return PaginatedType;
}

export function toPage<T>(items: T[], total: number, { page, limit }: PaginationArgs): Page<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    items,
    pageInfo: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export function toSkip({ page, limit }: PaginationArgs): number {
  return (page - 1) * limit;
}
