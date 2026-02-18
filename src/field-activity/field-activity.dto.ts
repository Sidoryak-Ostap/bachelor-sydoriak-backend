import { IsDateString, IsString } from 'class-validator';

export class CreateFieldActivityDto {
  @IsString()
  fieldId: string;

  @IsString()
  type: string;

  @IsString()
  description: string;

  @IsDateString()
  date: Date;
}
