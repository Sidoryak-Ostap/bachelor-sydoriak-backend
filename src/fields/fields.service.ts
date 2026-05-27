import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Field, FieldDocument } from './schemas/field.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CreateFieldDto, UpdateFieldDto } from './field.dto';
import { SentinelService } from '@app/sentinel/sentinel.service';
import { WeatherService } from '@app/weather/weather.service';

@Injectable()
export class FieldsService {
  constructor(
    @InjectModel(Field.name) private fieldModel: Model<FieldDocument>,
    @Inject(forwardRef(() => SentinelService))
    private readonly sentinelService: SentinelService,
    @Inject(forwardRef(() => WeatherService))
    private readonly weatherService: WeatherService,
  ) {}

  async createField(dto: CreateFieldDto, userId: string): Promise<Field> {
    const previewUrl = this.generatePreviewUrl(dto.boundary);

    const createdField = new this.fieldModel({
      ...dto,
      userId,
      previewUrl,
      seedingDate: dto.seedingDate || null,
    });

    const savedField = await createdField.save();

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 60);

    this.sentinelService
      .syncFieldIndices(savedField, savedField.id, dateFrom.toISOString())
      .catch((err) => {
        console.error('Background Sync Failed:', err);
      });

    this.weatherService
      .syncHistoricalWeather(savedField.id, dateFrom)
      .catch((err) => {
        console.error('Historical Weather Sync Failed:', err);
      });

    return savedField;
  }

  async getFieldsByUser(userId: string): Promise<Field[]> {
    return this.fieldModel.find({ userId }).exec();
  }

  async getFieldById(id: string, userId: string): Promise<Field> {
    const field = await this.fieldModel.findOne({ _id: id, userId }).exec();

    if (!field) {
      throw new NotFoundException(`Field with ID ${id} not found`);
    }

    return field;
  }

  async updateField(
    fieldId: string,
    userId: string,
    dto: UpdateFieldDto,
  ): Promise<Field> {
    const updateData: any = { ...dto };

    if (dto.boundary) {
      updateData.previewUrl = this.generatePreviewUrl(dto.boundary);
    }

    const updatedField = await this.fieldModel.findOneAndUpdate(
      { _id: fieldId, userId },
      updateData,
      { new: true },
    );

    if (!updatedField) {
      throw new NotFoundException(`Field with ID ${fieldId} not found`);
    }

    return updatedField;
  }

  async updateFieldInterpretation(
    fieldId: string,
    userId: string,
    interpretation: Field['interpretation'],
  ): Promise<Field> {
    const updatedField = await this.fieldModel.findOneAndUpdate(
      { _id: fieldId, userId },
      { interpretation },
      { new: true },
    );

    if (!updatedField) {
      throw new NotFoundException(`Field with ID ${fieldId} not found`);
    }

    return updatedField;
  }

  async deleteFieldById(fieldId: string, userId: string): Promise<void> {
    const result = await this.fieldModel
      .findOneAndDelete({ _id: fieldId, userId })
      .exec();

    if (!result) {
      throw new NotFoundException(`Field with ID ${fieldId} not found`);
    }

    return;
  }

  private generatePreviewUrl(boundary: any): string {
    const token = process.env.MAPBOX_TOKEN || '';
    const style = 'mapbox/satellite-v9';
    const width = 600;
    const height = 400;

    const feature = {
      type: 'Feature',
      properties: {
        stroke: '#00f2ff',
        'stroke-width': 3,
        'stroke-opacity': 1,
        fill: '#00f2ff',
        'fill-opacity': 0.4,
      },
      geometry: boundary,
    };

    const geojsonStr = JSON.stringify(feature);
    const encodedGeojson = encodeURIComponent(geojsonStr);

    return `https://api.mapbox.com/styles/v1/${style}/static/geojson(${encodedGeojson})/auto/${width}x${height}@2x?access_token=${token}`;
  }
}
