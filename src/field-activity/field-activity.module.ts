import { Module } from '@nestjs/common';
import { FieldActivityService } from './field-activity.service';
import { FieldActivityController } from './field-activity.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  FieldActivity,
  FieldActivitySchema,
} from './schemas/field-activity.schema';
import { FieldsModule } from 'src/fields/fields.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FieldActivity.name, schema: FieldActivitySchema },
    ]),
    FieldsModule,
  ],
  providers: [FieldActivityService],
  controllers: [FieldActivityController],
})
export class FieldActivityModule {}
