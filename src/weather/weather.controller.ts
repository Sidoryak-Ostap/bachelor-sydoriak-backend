import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { WeatherService } from './weather.service';
import { InjectModel } from '@nestjs/mongoose';
import { Field, FieldDocument } from '@app/fields/schemas/field.schema';
import { Model } from 'mongoose';

@Controller('weather')
export class WeatherController {
  constructor(
    private readonly weatherService: WeatherService,
    @InjectModel(Field.name) private readonly fieldModel: Model<FieldDocument>,
  ) {}

  @Get('field/:id')
  async getWeatherForField(
    @Param('id') fieldId: string,
    @Query('lang') lang: 'en' | 'uk' = 'uk',
  ) {
    const field = await this.fieldModel.findById(fieldId);

    if (!field) {
      throw new NotFoundException('Поле не знайдено');
    }

    return this.weatherService.getWeatherData(field, lang);
  }
}
