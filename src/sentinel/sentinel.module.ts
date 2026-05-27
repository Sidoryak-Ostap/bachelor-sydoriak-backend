import { forwardRef, Module } from '@nestjs/common';
import { SentinelController } from './sentinel.controller';
import { SentinelService } from './sentinel.service';
import { CacheModule } from '@nestjs/cache-manager';
import { FieldsModule } from '@app/fields/fields.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Indices, IndicesSchema } from './schemas/indices.schema';
import { FieldMap, FieldMapSchema } from './schemas/fieldMap.schema';
import { CloudinaryModule } from '@app/cloudinary/cloudinary.module';

@Module({
  controllers: [SentinelController],
  exports: [SentinelService],
  providers: [SentinelService],
  imports: [
    MongooseModule.forFeature([
      { name: Indices.name, schema: IndicesSchema },
      { name: FieldMap.name, schema: FieldMapSchema },
    ]),
    forwardRef(() => FieldsModule),
    CloudinaryModule,
    CacheModule.register({
      ttl: 3600,
      max: 10,
    }),
  ],
})
export class SentinelModule {}
