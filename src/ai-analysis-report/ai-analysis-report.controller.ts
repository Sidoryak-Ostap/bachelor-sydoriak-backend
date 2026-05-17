import { JwtAuthGuard } from '@app/auth/guards/jwt-auth.guard';
import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AiAnalysisReportService } from './ai-analysis-report.service';
import { GetUser } from '@app/auth/decorators/get-user.decorator';
import { type UserDocument } from '@app/users/schemas/user.schema';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-analysis-report')
export class AiAnalysisReportController {
  constructor(
    private readonly aiAnalysisReportService: AiAnalysisReportService,
  ) {}

  @Post('/:fieldId')
  async getFieldAnalysis(
    @Param('fieldId') fieldId: string,
    @GetUser() user: UserDocument,
    @Body('language') language: 'English' | 'Ukrainian',
  ) {
    return this.aiAnalysisReportService.generateReport(
      fieldId,
      user.id,
      language,
    );
  }
}
