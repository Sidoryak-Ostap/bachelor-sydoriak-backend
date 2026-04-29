import { Field, FieldDocument } from '@app/fields/schemas/field.schema';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { fromArrayBuffer } from 'geotiff';
import sharp from 'sharp';
import axios from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { FieldMap } from './schemas/fieldMap.schema';
import { Indices } from './schemas/indices.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { sleep } from '@app/utils/sleep';
import { CloudinaryService } from '@app/cloudinary/cloudinary.service';

@Injectable()
export class SentinelService {
  private readonly sentinelProcessURL =
    process.env.SENTINEL_PROCESSING_API_URL || '';
  private readonly sentinelStatisticsURL =
    process.env.SENTINEL_STATISTICS_API_URL || '';
  private readonly sentinelTokenURL = process.env.SENTINEL_TOKEN_URL || '';

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectModel(Indices.name) private indicesModel,
    @InjectModel(FieldMap.name) private fieldMapModel,
    @InjectModel(Field.name) private fieldModel,
    private cloudinaryService: CloudinaryService,
  ) {}

  async getAccessToken() {
    const cacheKey = 'sentinel_hub_token';

    const cachedToken = await this.cacheManager.get<string>(cacheKey);
    if (cachedToken) {
      return cachedToken;
    }

    const params = new URLSearchParams();

    params.append('grant_type', 'client_credentials');
    params.append('client_id', process.env.SENTINEL_HUB_CLIENT_ID || '');
    params.append(
      'client_secret',
      process.env.SENTINEL_HUB_CLIENT_SECRET || '',
    );

    try {
      const response = await axios.post(this.sentinelTokenURL, params);
      const newToken = response.data.access_token;
      const expiresIn = response.data.expires_in;

      await this.cacheManager.set(cacheKey, newToken, (expiresIn - 60) * 1000);

      return newToken;
    } catch (error) {
      console.log(error);

      throw new Error('Failed to retrieve access token');
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async handleGetVegetetaionIndices() {
    console.log(' --- Початок синхронізації даних для індексів ---');

    const allFields = await this.fieldModel.find().exec();

    const chunkSize = 15;
    for (let i = 0; i < allFields.length; i += chunkSize) {
      const chunk = allFields.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map((field: FieldDocument) =>
          this.syncFieldIndices(field, field.id),
        ),
      );

      if (i + chunkSize < allFields.length) {
        console.log('Чекаємо 60 секунд для скидання ліміту API...');
        await new Promise((resolve) => setTimeout(resolve, 61000));
      }
    }

    console.log('--- Отримання даних індексів вегететації заверешено ---');
  }

  async getIndices(
    coordinates: number[][][],
    dateFrom: string,
    dateTo: string,
    retryCount = 0,
  ) {
    const maxRetries = 5;

    const token = await this.getAccessToken();

    const evalscript = `
      //VERSION=3
      function setup() {
        return {
          input: ["B02", "B04", "B08", "B11", "dataMask"],
          output: [
            { id: "ndvi", bands: 1 },
            { id: "ndmi", bands: 1 },
            { id: "savi", bands: 1 },
            { id: "evi", bands: 1 },
            { id: "dataMask", bands: 1 }
          ]
        };
      }

      function evaluatePixel(sample) {
        if (sample.dataMask === 0) {
          return { ndvi: [NaN], ndmi: [NaN], savi: [NaN], evi: [NaN], dataMask: [0] };
        }
        let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
        let ndmi = (sample.B08 - sample.B11) / (sample.B08 + sample.B11);
        let L = 0.5;
        let savi = ((sample.B08 - sample.B04) / (sample.B08 + sample.B04 + L)) * (1 + L);
        let evi = 2.5 * ((sample.B08 - sample.B04) / (sample.B08 + 6 * sample.B04 - 7.5 * sample.B02 + 1));

        return {
          ndvi: [ndvi],
          ndmi: [ndmi],
          savi: [savi],
          evi: [evi],
          dataMask: [sample.dataMask]
        };
      }
    `;

    const body = {
      input: {
        bounds: {
          properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
          geometry: {
            type: 'Polygon',
            coordinates,
          },
        },
        data: [
          {
            type: 'sentinel-2-l2a',
            dataFilter: { maxCloudCoverage: 20 },
          },
        ],
      },
      aggregation: {
        timeRange: { from: dateFrom, to: dateTo },
        aggregationInterval: { of: 'P1D' },
        evalscript: evalscript,
      },
    };

    try {
      const response = await axios.post(this.sentinelStatisticsURL, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      return this.formatStatsResponse(response.data);
    } catch (error: any) {
      const status = error.response?.status;

      if (status === 429 && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 2000 + Math.random() * 1000;

        console.warn(
          `Rate limit hit (429). Спроба ${retryCount + 1}. Чекаємо ${Math.round(delay)}мс...`,
        );

        await sleep(delay);
        return this.getIndices(coordinates, dateFrom, dateTo, retryCount + 1);
      }
      console.error(
        'Sentinel Stats Error:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  private async syncFieldIndices(field: Field, fieldId: string) {
    // Формування дат для запиту до Sentinel API (останній тиждень)
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 7);
    const dateTo = new Date();

    // Отримання індексів вегетації для поля
    const stats = await this.getIndices(
      field.boundary.coordinates,
      dateFrom.toISOString(),
      dateTo.toISOString(),
    );

    const savePromises = stats.map(async (dayStat) => {
      try {
        const record = await this.indicesModel.findOneAndUpdate(
          {
            fieldId,
            date: new Date(dayStat.date),
          },
          {
            fieldId,
            date: new Date(dayStat.date),
            ndvi: dayStat.ndvi,
            ndmi: dayStat.ndmi,
            savi: dayStat.savi,
            evi: dayStat.evi,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        );

        await this.generateAndUploadMap(field, dayStat.date, fieldId);

        return record;
      } catch (error) {
        console.error(
          `Помилка збереження статистики за ${dayStat.date}:`,
          error,
        );
      }
    });

    await Promise.all(savePromises);

    return stats;
  }

  private async generateAndUploadMap(
    field: Field,
    date: string,
    fieldId: string,
  ) {
    const tiffBuffer = await this.getFieldMapBuffer(
      field.boundary.coordinates,
      date,
    );

    const pngBuffer = await this.processTiffToHeatmap(tiffBuffer);

    const cloudinaryResult = await this.cloudinaryService.uploadBuffer(
      pngBuffer,
      'agromap_maps',
    );
    const bbox = this.calculateFieldBounds(field.boundary.coordinates);

    await this.fieldMapModel.findOneAndUpdate(
      { fieldId, date },
      {
        indexType: 'NDVI',
        fieldId,
        date,
        cloudinaryUrl: cloudinaryResult.secure_url,
        bbox,
      },
      { upsert: true },
    );
  }

  async getFieldMapBuffer(coordinates: any, date: string) {
    const token = await this.getAccessToken();

    const targetDate = new Date(date);

    const from = new Date(targetDate);
    from.setUTCHours(0, 0, 0, 0);

    const to = new Date(targetDate);
    to.setUTCHours(23, 59, 59, 999);

    const evalscript = `
      //VERSION=3
      function setup() {
        return {
          input: ["B04", "B08", "dataMask"],
          output: { bands: 1, sampleType: "FLOAT32" }
        };
      }

      function evaluatePixel(sample) {
        if (sample.dataMask === 0) return [NaN];
        // Рахуємо NDVI
        let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
        return [ndvi];
      }
    `;

    const body = {
      input: {
        bounds: {
          properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
          geometry: {
            type: 'Polygon',
            coordinates,
          },
        },
        data: [
          {
            type: 'sentinel-2-l2a',
            dataFilter: {
              timeRange: { from, to },
              maxCloudCoverage: 20,
            },
          },
        ],
      },
      output: {
        responses: [
          {
            identifier: 'default',
            format: { type: 'image/tiff' },
          },
        ],
      },
      evalscript: evalscript,
    };

    try {
      const response = await axios.post(this.sentinelProcessURL, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'image/tiff',
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error: any) {
      console.error(
        'Sentinel Process Error:',
        error.response?.data?.toString() || error.message,
      );
      throw error;
    }
  }

  async processTiffToHeatmap(buffer: Buffer): Promise<Buffer> {
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;

    const tiff = await fromArrayBuffer(arrayBuffer);
    // 1. Читаємо GeoTIFF дані
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();

    const rasters = await image.readRasters();
    const values = rasters[0] as Float32Array;

    const rgba = Buffer.alloc(width * height * 4);

    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      const pos = i * 4;

      if (isNaN(val) || val <= 0) {
        rgba[pos] = 0;
        rgba[pos + 1] = 0;
        rgba[pos + 2] = 0;
        rgba[pos + 3] = 0;
      } else {
        let r, g, b;

        if (val < 0.5) {
          r = 255;
          g = Math.floor(255 * (val / 0.5));
          b = 0;
        } else {
          // Від Жовтого (0.5) до Зеленого (1.0)
          r = Math.floor(255 * (1 - (val - 0.5) / 0.5));
          g = 255;
          b = 0;
        }

        rgba[pos] = r;
        rgba[pos + 1] = g;
        rgba[pos + 2] = b;
        rgba[pos + 3] = 255;
      }
    }

    return await sharp(rgba, { raw: { width, height, channels: 4 } })
      .resize(width * 10, height * 10, {
        kernel: sharp.kernel.cubic,
      })
      .blur(0.8)
      .png()
      .toBuffer();
  }

  private calculateFieldBounds(coordinates: number[][][]) {
    const allPoints = coordinates.flat();

    const lons = allPoints.map((p) => p[0]);
    const lats = allPoints.map((p) => p[1]);

    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    return {
      sentinelBbox: [minLon, minLat, maxLon, maxLat],

      mapboxCoords: [
        [minLon, maxLat],
        [maxLon, maxLat],
        [maxLon, minLat],
        [minLon, minLat],
      ],
    };
  }

  private formatStatsResponse(statsResponse: any) {
    if (statsResponse.data.length === 0) return [];

    return statsResponse.data
      .map((day: any) => ({
        date: day.interval.from,
        ndvi: day.outputs.ndvi.bands.B0.stats,
        ndmi: day.outputs.ndmi.bands.B0.stats,
        savi: day.outputs.savi.bands.B0.stats,
        evi: day.outputs.evi.bands.B0.stats,
      }))
      .filter((d: any) => d.ndvi !== null);
  }

  // API functions for controller

  async getFieldIndices(fieldId: string, dateFrom?: string, dateTo?: string) {
    const defaultDateTo = dateTo ? new Date(dateTo) : new Date();

    const defaultDateFrom = dateFrom
      ? new Date(dateFrom)
      : new Date().setDate(defaultDateTo.getDate() - 30);

    const query: any = { fieldId };

    if (dateFrom && dateTo) {
      query.date = {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo),
      };
    }

    const indices = await this.indicesModel.find(query);

    return indices;
  }

  async getFieldImages(fieldId: string) {
    const maps = await this.fieldMapModel.find({ fieldId });

    return maps;
  }
}
