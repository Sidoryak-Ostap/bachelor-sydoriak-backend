import { Module } from '@nestjs/common';
import { AiAnalysisReportController } from './ai-analysis-report.controller';
import { AiAnalysisReportService } from './ai-analysis-report.service';
import { FieldsModule } from '@app/fields/fields.module';
import { SentinelModule } from '@app/sentinel/sentinel.module';

@Module({
  controllers: [AiAnalysisReportController],
  providers: [AiAnalysisReportService],
  imports: [FieldsModule, SentinelModule],
})
export class AiAnalysisReportModule {}
