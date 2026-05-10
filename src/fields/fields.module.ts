import { forwardRef, Module } from '@nestjs/common';
import { FieldsService } from './fields.service';
import { FieldsController } from './fields.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Field, FieldSchema } from './schemas/field.schema';
import { SentinelModule } from '@app/sentinel/sentinel.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Field.name, schema: FieldSchema }]),
    forwardRef(() => SentinelModule),
  ],
  controllers: [FieldsController],
  providers: [FieldsService],
  exports: [FieldsService, MongooseModule],
})
export class FieldsModule {}
