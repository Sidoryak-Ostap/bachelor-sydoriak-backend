import { Injectable, NotFoundException } from '@nestjs/common';
import { Field, FieldDocument } from './schemas/field.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CreateFieldDto, UpdateFieldDto } from './field.dto';

@Injectable()
export class FieldsService {
  constructor(
    @InjectModel(Field.name) private fieldModel: Model<FieldDocument>,
  ) {}

  async createField(dto: CreateFieldDto, userId: string): Promise<Field> {
    const previewUrl = this.generatePreviewUrl(dto.boundary);
    const createdField = new this.fieldModel({
      ...dto,
      userId,
      previewUrl,
    });

    return createdField.save();
  }

  async getFieldsByUser(userId: string): Promise<Field[]> {
    return this.fieldModel.find({ userId }).exec();
  }

  async getFieldById(id: string): Promise<Field> {
    const field = await this.fieldModel.findById(id).exec();

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
