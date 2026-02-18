import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';

class BoundaryDto {
  @IsEnum(['Polygon'])
  @IsNotEmpty()
  type: string;

  @IsArray()
  @IsNotEmpty()
  coordinates: number[][][];
}

export class CreateFieldDto {
  @IsString()
  @IsNotEmpty()
  name: string;
  @IsNotEmpty()
  @IsNumber()
  area: number;
  @IsNotEmpty()
  @IsString()
  address: string;
  @IsNotEmpty()
  @IsString()
  owner: string;
  @IsNotEmpty()
  @IsString()
  cropType: string;
  @IsNotEmpty()
  @IsString()
  soilType: string;

  @IsObject()
  @ValidateNested()
  @Type(() => BoundaryDto)
  boundary: BoundaryDto;
}

export class UpdateFieldDto extends PartialType(CreateFieldDto) {}
