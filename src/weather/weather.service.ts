import { Field, FieldDocument } from '@app/fields/schemas/field.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  BadRequestException,
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

@Injectable()
export class WeatherService {
  private readonly apiKey = process.env.OPENWEATHERMAP_API_KEY || '';
  private readonly baseUrl = process.env.OPENWEATHER_API_URL || '';
  private readonly daySummaryApiUrl =
    process.env.OPENWEATHER_DAY_SUMMARY_API_URL || '';

  constructor(
    @InjectModel(Field.name) private readonly fieldModel: Model<FieldDocument>,
    @InjectModel(WeatherHistory.name)
    private readonly weatherHistoryModel: Model<WeatherHistoryDocument>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyWeatherSync() {
    console.log('--- Старт фонової синхронізації погоди ---');

    const fieldsCursor = this.fieldModel.find({}, { _id: 1 }).cursor();
    const allFieldIds: string[] = [];

    for (
      let field = await fieldsCursor.next();
      field != null;
      field = await fieldsCursor.next()
    ) {
      allFieldIds.push(field._id.toString());
    }

    this.processFieldsQueueInMemory(allFieldIds).catch((err) =>
      console.error('Помилка у фоновому процесі синхронізації:', err),
    );

    console.log('--- Фонова синхронізація погоди завершена ---');
  }

  private async processFieldsQueueInMemory(fieldIds: string[]) {
    const chunkSize = 15;

    for (let i = 0; i < fieldIds.length; i += chunkSize) {
      const chunk = fieldIds.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map((id) => this.syncSingleFieldWithRetry(id, 3)),
      );

      if (i + chunkSize < fieldIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 61000));
      }
    }
    console.log('--- Фонова синхронізація повністю завершена ---');
  }

  private async syncSingleFieldWithRetry(
    fieldId: string,
    attemptsLeft: number,
  ): Promise<void> {
    try {
      const field = await this.fieldModel.findById(fieldId).exec();
      if (!field) return;

      await this.getWeatherData(field);
    } catch (error: any) {
      if (attemptsLeft > 1) {
        console.warn(
          `Помилка для поля ${fieldId}. Лишилось спроб: ${attemptsLeft - 1}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return this.syncSingleFieldWithRetry(fieldId, attemptsLeft - 1);
      }
      console.error(
        `[Критична Помилка] Не вдалося оновити поле ${fieldId} після 3 спроб: ${error.message}`,
      );
    }
  }

  async getWeatherData(field: FieldDocument, lang: 'en' | 'uk' = 'uk') {
    if (!field) throw new NotFoundException('Поле не знайдено');

    const { lat, lon } = this.getFieldCoords(field);

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units: 'metric',
          lang,
          exclude: 'minutely,hourly,alerts',
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
          clouds: data?.current?.clouds || 0,

          humidity: data.current.humidity,
          wind_speed: data.current.wind_speed,
          description: data.current.weather[0].description,
          icon: data.current.weather[0].icon,
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

  //

  async syncHistoricalWeather(fieldId: string, startDate: Date) {
    const field = await this.fieldModel.findById(fieldId).exec();
    if (!field) throw new NotFoundException('Поле не знайдено');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate >= today) {
      throw new BadRequestException('Початкова дата повинна бути в минулому');
    }

    const datesToSync: Date[] = [];
    const currentDatePointer = new Date(startDate);
    currentDatePointer.setHours(14, 20, 0, 0);

    while (currentDatePointer < today) {
      datesToSync.push(new Date(currentDatePointer.getTime()));

      currentDatePointer.setDate(currentDatePointer.getDate() + 1);
    }

    console.log(
      `Початок синхронізації історії для поля ${fieldId}. Всього днів: ${datesToSync.length}`,
    );

    const batchSize = 5;
    const { lat, lon } = this.getFieldCoords(field);

    // 2. ОБРОБКА ПАЧКАМИ
    for (let i = 0; i < datesToSync.length; i += batchSize) {
      const batch = datesToSync.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (uniqueDate) => {
          try {
            await this.fetchAndSaveHistoricalDay(
              field.id,
              lat,
              lon,
              uniqueDate,
            );
          } catch (error: any) {
            console.error(
              `Не вдалося завантажити історію за ${uniqueDate.toISOString().split('T')[0]} для поля ${fieldId}:`,
              error.message,
            );
          }
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`Історичну синхронізацію для поля ${fieldId} завершено.`);
  }

  private async fetchAndSaveHistoricalDay(
    fieldId: string,
    lat: number,
    lon: number,
    date: Date,
  ) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    const response = await axios.get(this.daySummaryApiUrl, {
      params: {
        lat,
        lon,
        date: dateString,
        appid: this.apiKey,
        units: 'metric',
        lang: 'eng',
      },
    });

    const summaryData = response.data;

    if (!summaryData) {
      throw new Error(
        `Відсутні дані у відповіді Day Summary API за дату ${dateString}`,
      );
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    await this.weatherHistoryModel.findOneAndUpdate(
      {
        fieldId: fieldId,
        date: { $gte: startOfDay, $lte: endOfDay },
      },
      {
        fieldId: fieldId,
        date: startOfDay,

        temp: {
          day:
            summaryData.temperature?.afternoon ||
            summaryData.temperature?.morning,
          min: summaryData.temperature?.min,
          max: summaryData.temperature?.max,
        },

        pressure:
          summaryData.pressure?.afternoon || summaryData.pressure?.morning,
        humidity: summaryData.humidity?.afternoon,
        dew_point: summaryData.dew_point || 0,
        wind_speed: summaryData.wind?.max?.speed || 0,
        wind_deg: summaryData.wind?.max?.direction || 0,
        wind_gust: 0,
        clouds: summaryData.cloud_cover?.afternoon || 0,
        rain: summaryData.precipitation?.total || 0,
        pop: 0,
      },
      {
        upsert: true,
        new: true,
      },
    );
  }
}
