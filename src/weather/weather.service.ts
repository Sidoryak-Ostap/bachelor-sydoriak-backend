import { Field, FieldDocument } from '@app/fields/schemas/field.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Model } from 'mongoose';
import {
  WeatherHistory,
  WeatherHistoryDocument,
} from './schemas/weather.schema';

import promiseRetry from 'promise-retry';

@Injectable()
export class WeatherService {
  private readonly apiKey = process.env.OPENWEATHERMAP_API_KEY || '';
  private readonly baseUrl = process.env.OPENWEATHER_API_URL || '';

  constructor(
    @InjectModel(Field.name) private readonly fieldModel: Model<FieldDocument>,
    @InjectModel(WeatherHistory.name)
    private readonly weatherHistoryModel: Model<WeatherHistoryDocument>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async handleDailyWeatherSync() {
    const allFields = await this.fieldModel.find().exec();

    const chunkSize = 15;
    for (let i = 0; i < allFields.length; i += chunkSize) {
      const chunk = allFields.slice(i, i + chunkSize);

      await Promise.all(chunk.map((field) => this.syncFieldWithRetry(field)));

      if (i + chunkSize < allFields.length) {
        console.log('Чекаємо 60 секунд для скидання ліміту API...');
        await new Promise((resolve) => setTimeout(resolve, 61000));
      }
    }

    console.log('--- Синхронізацію завершено ---');
  }

  private async syncFieldWithRetry(field: any) {
    return promiseRetry(
      async (retry, number) => {
        try {
          await this.getWeatherData(field);
        } catch (error: any) {
          if (error.response?.status === 429 || error.response?.status >= 500) {
            console.warn(
              `Помилка для поля ${field.name}. Спроба №${number}...`,
            );
            return retry(error);
          }
          console.error(
            `Критична помилка для поля ${field.id}: ${error.message}`,
          );
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        factor: 2,
      },
    );
  }

  async getWeatherData(field: FieldDocument) {
    if (!field) throw new NotFoundException('Поле не знайдено');

    const { lat, lon } = this.getFieldCoords(field);

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units: 'metric',
          lang: 'eng',
          exclude: 'minutely,alerts',
        },
      });

      const data = response.data;
      const todayData = data.daily[0];

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      await this.weatherHistoryModel.findOneAndUpdate(
        {
          fieldId: field.id,
          date: { $gte: startOfDay, $lte: endOfDay },
        },
        {
          fieldId: field.id,
          date: new Date(todayData.dt * 1000),
          temp: todayData.temp,
          pressure: todayData.pressure,
          humidity: todayData.humidity,
          dew_point: todayData.dew_point,
          wind_speed: todayData.wind_speed,
          wind_deg: todayData.wind_deg,
          wind_gust: todayData.wind_gust,
          clouds: todayData.clouds,
          rain: todayData.rain || 0,
          pop: todayData.pop,
        },
        {
          upsert: true,
          new: true,
        },
      );

      return {
        current: {
          temp: data.current.temp,
          pressure: data.current.pressure,
          humidity: data.current.humidity,
          wind_speed: data.current.wind_speed,
          description: data.current.weather[0].description,
        },
        daily: data.daily.slice(0, 7),
      };
    } catch (error: any) {
      throw new InternalServerErrorException('Помилка погоди');
    }
  }

  private getFieldCoords(field: FieldDocument) {
    const coords = field.boundary.coordinates[0];

    let totalLat = 0;
    let totalLon = 0;

    coords.forEach(([lon, lat]) => {
      totalLon += lon;
      totalLat += lat;
    });

    const centerLat = totalLat / coords.length;
    const centerLon = totalLon / coords.length;

    return { lat: centerLat, lon: centerLon };
  }
}
