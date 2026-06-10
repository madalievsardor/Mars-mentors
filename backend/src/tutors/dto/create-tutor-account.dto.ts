import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { TutorScheduleType } from '../tutors.types';

/**
 * Create a brand-new Mars account and promote it to tutor.
 *
 * Mars `POST /api/v2/users/create` requires: first_name, last_name, phone,
 * branch_id, department (int), schedule ('full-time' | 'part-time'). Password is
 * optional on Mars's side; we accept it and forward it when provided.
 */
export class CreateTutorAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  /** International phone, e.g. +998901234567. */
  @IsString()
  @Matches(/^\+?\d{9,15}$/, {
    message: 'phone +998XXXXXXXXX formatida boʻlsin',
  })
  phone!: string;

  /** Optional login password (Mars does not require it). */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  branchId!: number;

  /** Mars department id; defaults to the teacher department (5) when omitted. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  department?: number;

  @IsOptional()
  @IsIn(['full-time', 'part-time'])
  schedule?: TutorScheduleType;
}
