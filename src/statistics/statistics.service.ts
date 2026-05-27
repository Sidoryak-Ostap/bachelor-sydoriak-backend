import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Field, FieldDocument } from '../fields/schemas/field.schema';
import { Indices, IndicesDocument } from '@app/sentinel/schemas/indices.schema';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(Field.name) private fieldModel: Model<FieldDocument>,
    @InjectModel(Indices.name) private indicesModel: Model<IndicesDocument>,
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
    const { meanNDVI, lastIndices } = await this.getMeanNDVI(allFields);

    return {
      totalFields,
      totalArea,
      averageArea,
      cropTypeDistribution,
      cropAreaDistribution,
      meanNDVI,
      lastIndices,
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

  private getMeanNDVI = async (allFields: FieldDocument[]) => {
    const fieldIds = allFields.map((field) => field.id);

    const lastIndices = await this.indicesModel.aggregate([
      { $match: { fieldId: { $in: fieldIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$fieldId',
          ndvi: { $first: '$ndvi' },
          date: { $first: '$date' },
        },
      },
    ]);

    const totalNDVI = lastIndices.reduce(
      (sum, item) => sum + item.ndvi.mean,
      0,
    );
    const meanNDVI =
      lastIndices.length > 0 ? totalNDVI / lastIndices.length : 0;

    return { meanNDVI, lastIndices };
  };
}
