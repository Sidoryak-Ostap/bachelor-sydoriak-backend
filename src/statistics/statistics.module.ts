import { Module } from '@nestjs/common';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { FieldsModule } from '../fields/fields.module';
import { Indices, IndicesSchema } from '@app/sentinel/schemas/indices.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  controllers: [StatisticsController],
  providers: [StatisticsService],
  imports: [
    FieldsModule,
    MongooseModule.forFeature([{ name: Indices.name, schema: IndicesSchema }]),
  ],
})
export class StatisticsModule {}
