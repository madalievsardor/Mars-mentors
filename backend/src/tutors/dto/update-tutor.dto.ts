import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Edit a tutor's profile. All fields are optional so the unified edit form can
 * send only what changed: name (first/last) and/or branch (filial rotate).
 */
export class UpdateTutorDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  /** New branch (filial) id — moves the tutor to another branch. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  branchId?: number;
}
