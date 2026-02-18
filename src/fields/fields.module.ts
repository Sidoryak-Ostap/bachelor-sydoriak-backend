import { Module } from '@nestjs/common';
import { FieldsService } from './fields.service';
import { FieldsController } from './fields.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Field, FieldSchema } from './schemas/field.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Field.name, schema: FieldSchema }]),
  ],
  controllers: [FieldsController],
  providers: [FieldsService],
  exports: [MongooseModule],
})
export class FieldsModule {}
