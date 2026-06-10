import { IsIn, IsString, Matches } from 'class-validator';
import type { Weekday } from '../tutors.types';

const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** Replace one weekday's working interval (HH:MM..HH:MM) for a tutor. */
export class UpdateTutorSlotsDto {
  @IsIn(WEEKDAYS)
  day!: Weekday;

  @IsString()
  @Matches(/^([01]\d|2[0-4]):[0-5]\d$/, { message: 'fromHour HH:MM formatida boʻlsin' })
  fromHour!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-4]):[0-5]\d$/, { message: 'tillHour HH:MM formatida boʻlsin' })
  tillHour!: string;
}
