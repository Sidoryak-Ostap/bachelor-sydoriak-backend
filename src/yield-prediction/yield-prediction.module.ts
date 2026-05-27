import { Module } from '@nestjs/common';
import { YieldPredictionService } from './yield-prediction.service';
import { YieldPredictionController } from './yield-prediction.controller';
import { WeatherModule } from '@app/weather/weather.module';
import { FieldsModule } from '@app/fields/fields.module';
import { Indices, IndicesSchema } from '@app/sentinel/schemas/indices.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  providers: [YieldPredictionService],
  controllers: [YieldPredictionController],
  imports: [
    FieldsModule,
    WeatherModule,
    MongooseModule.forFeature([{ name: Indices.name, schema: IndicesSchema }]),
  ],
})
export class YieldPredictionModule {}
