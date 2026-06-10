import { IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

/** Promote a user to the tutor role (is_tutor=true). */
export class AddTutorDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  userId!: number;
}
