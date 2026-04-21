import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Field, FieldDocument } from '../fields/schemas/field.schema';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(Field.name) private fieldModel: Model<FieldDocument>,
  ) {}

  async getFieldStatistics(userId: string) {
    const allFields = await this.fieldModel.find({ userId }).exec();

    const totalFields = allFields.length;
    const totalArea = allFields.reduce((sum, field) => sum + field.area, 0);
    const averageArea = totalFields > 0 ? totalArea / totalFields : 0;

    const cropTypeDistribution = allFields.reduce((distribution, field) => {
      const cropType = field.cropType || 'Unknown';
      distribution[cropType] = (distribution[cropType] || 0) + 1;
      return distribution;
    }, {});

    const cropAreaDistribution = this.calculateCropAreaDistribution(allFields);

    return {
      totalFields,
      totalArea,
      averageArea,
      cropTypeDistribution,
      cropAreaDistribution,
    };
  }

  private calculateCropAreaDistribution = (allFields: FieldDocument[]) => {
    const totalArea = allFields.reduce(
      (sum, field) => sum + (field.area || 0),
      0,
    );

    if (totalArea === 0) return [];

    const areaByCrop: { [key: string]: number } = allFields.reduce(
      (acc, field) => {
        const cropType = field.cropType || 'Unknown';
        acc[cropType] = (acc[cropType] || 0) + (field.area || 0);
        return acc;
      },
      {},
    );

    return Object.entries(areaByCrop).map(([name, area]) => ({
      name,
      value: Number(((area / totalArea) * 100).toFixed(1)),
    }));
  };
}
