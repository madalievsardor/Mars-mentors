import { IsInt, IsIn, Matches, Min } from 'class-validator';

/** Mark one (student, lesson-day) cell present (1) or absent (0). */
export class MarkAttendanceDto {
  @IsInt()
  @Min(1)
  groupId!: number;

  @IsInt()
  @Min(1)
  studentId!: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date YYYY-MM-DD formatida boʻlsin' })
  date!: string;

  @IsIn([0, 1], { message: 'status 0 (yoʻq) yoki 1 (bor) boʻlsin' })
  status!: 0 | 1;
}
