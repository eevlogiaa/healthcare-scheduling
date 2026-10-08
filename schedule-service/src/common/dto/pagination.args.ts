import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsInt, Max, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;

@ArgsType()
export class PaginationArgs {
  @Field(() => Int, { defaultValue: 1, description: 'Page number, starting at 1.' })
  @IsInt()
  @Min(1)
  page: number = 1;

  @Field(() => Int, {
    defaultValue: 10,
    description: `Number of items per page (1-${MAX_PAGE_SIZE}).`,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = 10;
}
