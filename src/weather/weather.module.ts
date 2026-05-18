import { forwardRef, Module } from '@nestjs/common';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { FieldsModule } from '@app/fields/fields.module';
import { MongooseModule } from '@nestjs/mongoose';
import { WeatherHistory, WeatherHistorySchema } from './schemas/weather.schema';

@Module({
  controllers: [WeatherController],
  exports: [WeatherService],
  providers: [WeatherService],
  imports: [
    MongooseModule.forFeature([
      { name: WeatherHistory.name, schema: WeatherHistorySchema },
    ]),
    forwardRef(() => FieldsModule),
  ],
})
export class WeatherModule {}
