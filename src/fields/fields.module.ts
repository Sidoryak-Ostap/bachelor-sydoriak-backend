import { forwardRef, Module } from '@nestjs/common';
import { FieldsService } from './fields.service';
import { FieldsController } from './fields.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Field, FieldSchema } from './schemas/field.schema';
import { SentinelModule } from '@app/sentinel/sentinel.module';
import { WeatherModule } from '@app/weather/weather.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Field.name, schema: FieldSchema }]),
    forwardRef(() => SentinelModule),
    forwardRef(() => WeatherModule),
  ],
  controllers: [FieldsController],
  providers: [FieldsService],
  exports: [FieldsService, MongooseModule],
})
export class FieldsModule {}
