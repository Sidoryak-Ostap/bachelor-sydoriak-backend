import { Module } from '@nestjs/common';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { FieldsModule } from 'src/fields/fields.module';

@Module({
  controllers: [StatisticsController],
  providers: [StatisticsService],
  imports: [FieldsModule],
})
export class StatisticsModule {}
