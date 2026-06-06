import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateNotificationSettingDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  threshold?: number;
}
