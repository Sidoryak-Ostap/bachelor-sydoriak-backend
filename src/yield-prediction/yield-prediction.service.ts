import { Field, FieldDocument } from '@app/fields/schemas/field.schema';
import { Indices, IndicesDocument } from '@app/sentinel/schemas/indices.schema';
import {
  WeatherHistory,
  WeatherHistoryDocument,
} from '@app/weather/schemas/weather.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Model } from 'mongoose';

const CROP_SEASON_MONTHS: Record<
  string,
  {
    early: number[];
    mid: number[];
    late: number[];
  }
> = {
  wheat: { early: [3, 4], mid: [5, 6], late: [7, 8] },
  barley: { early: [3, 4], mid: [5, 6], late: [7, 8] },
  corn: { early: [4, 5], mid: [6, 7], late: [8, 9] },
  sunflower: { early: [4, 5], mid: [6, 7], late: [8, 9] },
  soyBeans: { early: [5, 6], mid: [7, 8], late: [9, 10] },
  rapeseed: { early: [3, 4], mid: [5, 6], late: [7, 8] },
  rye: { early: [3, 4], mid: [5, 6], late: [7, 8] },
  oats: { early: [4, 5], mid: [6, 7], late: [7, 8] },
};

@Injectable()
export class YieldPredictionService {
  constructor(
    @InjectModel(Field.name) private fieldModel: Model<FieldDocument>,
    @InjectModel(Indices.name) private indicesModel: Model<IndicesDocument>,
    @InjectModel(WeatherHistory.name)
    private readonly weatherHistoryModel: Model<WeatherHistoryDocument>,
  ) {}
  async predictYield(fieldId: string) {
    const currentYear = new Date().getFullYear();

    const ndviRecords = await this.indicesModel.find({
      fieldId,
      date: {
        $gte: new Date(`${currentYear}-01-01`),
        $lte: new Date(`${currentYear}-12-31`),
      },
    });

    const field = await this.fieldModel.findById(fieldId);

    if (!field) {
      throw new Error('Field not found');
    }

    const seasons = CROP_SEASON_MONTHS[field.cropType] ?? {
      early: [4, 5],
      mid: [6, 7],
      late: [8, 9],
    };

    const ndvi_early = this.getAvgNDVI(ndviRecords, seasons.early);
    const ndvi_mid = this.getAvgNDVI(ndviRecords, seasons.mid);
    const ndvi_late = this.getAvgNDVI(ndviRecords, seasons.late);

    const weatherRecords = await this.weatherHistoryModel.find({
      fieldId,
      date: {
        $gte: new Date(`${currentYear}-01-01`),
        $lte: new Date(`${currentYear}-12-31`),
      },
    });

    const rain_sum_early = this.getSumRain(weatherRecords, seasons.early);
    const rain_sum_mid = this.getSumRain(weatherRecords, seasons.mid);
    const rain_sum_late = this.getSumRain(weatherRecords, seasons.late);

    const temp_sum_early = this.getSumTemp(weatherRecords, seasons.early);
    const temp_sum_mid = this.getSumTemp(weatherRecords, seasons.mid);
    const temp_sum_late = this.getSumTemp(weatherRecords, seasons.late);

    try {
      const predicetedYield = await axios.post(
        `${process.env.FASTAPI_URL}/predict-yield`,
        {
          soil_type: field.soilType.toLowerCase(),
          crop_type: field.cropType.toLowerCase(),
          ndvi_early: ndvi_early || null,
          ndvi_mid: ndvi_mid || null,
          ndvi_late: ndvi_late || null,
          rain_sum_early: rain_sum_early || null,
          rain_sum_mid: rain_sum_mid || null,
          rain_sum_late: rain_sum_late || null,
          temp_sum_early: temp_sum_early || null,
          temp_sum_mid: temp_sum_mid || null,
          temp_sum_late: temp_sum_late || null,
        },
      );

      return {
        success: predicetedYield.data.success,
        predicted_yield: predicetedYield.data.predicted_yield,
        unit: predicetedYield.data.unit,
        meta: {
          status: predicetedYield.data.meta.status,
          message: predicetedYield.data.meta.message,
          confidence: predicetedYield.data.meta.confidence,
        },
      };
    } catch (error) {
      throw new Error('Failed to predict yield');
    }
  }

  private getAvgNDVI = (ndviRecords: IndicesDocument[], months: number[]) => {
    const filtered = ndviRecords.filter((r) =>
      months.includes(new Date(r.date).getMonth() + 1),
    );
    if (!filtered.length) return 0;
    const sum = filtered.reduce((acc, r) => acc + r.ndvi.mean, 0);
    return sum / filtered.length;
  };

  private getSumRain = (
    weatherRecords: WeatherHistoryDocument[],
    months: number[],
  ) => {
    return weatherRecords
      .filter((r) => months.includes(new Date(r.date).getMonth() + 1))
      .reduce((acc, r) => acc + (r.rain || 0), 0);
  };

  private getSumTemp = (
    weatherRecords: WeatherHistoryDocument[],
    months: number[],
  ) => {
    return weatherRecords
      .filter((r) => months.includes(new Date(r.date).getMonth() + 1))
      .reduce((acc, r) => acc + (r.temp?.day || 0), 0);
  };
}
