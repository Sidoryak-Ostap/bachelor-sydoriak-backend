import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFieldActivityDto } from './field-activity.dto';
import {
  ActivityDocument,
  FieldActivity,
} from './schemas/field-activity.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Field, FieldDocument } from 'src/fields/schemas/field.schema';

@Injectable()
export class FieldActivityService {
  constructor(
    @InjectModel(FieldActivity.name)
    private fieldActivityModel: Model<ActivityDocument>,
    @InjectModel(Field.name) private fieldModel: Model<FieldDocument>,
  ) {}

  async createActivity(
    dto: CreateFieldActivityDto,
    userId: string,
  ): Promise<FieldActivity> {
    const field = await this.fieldModel
      .findOne({ _id: dto.fieldId, userId })
      .exec();

    if (!field) {
      throw new NotFoundException(
        `Field not found or you don't have access to it`,
      );
    }
    const createdActivity = new this.fieldActivityModel({
      ...dto,
      userId,
    });

    return createdActivity.save();
  }

  async getActivitiesByField(
    fieldId: string,
    userId: string,
  ): Promise<FieldActivity[]> {
    return this.fieldActivityModel
      .find({ fieldId, userId })
      .sort({ date: -1 })
      .exec();
  }

  async deleteActivitiesByIds(
    activityIds: string[],
    userId: string,
  ): Promise<void> {
    const result = await this.fieldActivityModel
      .deleteMany({ _id: { $in: activityIds }, userId })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException(`No activities found for deletion`);
    }

    return;
  }
}
