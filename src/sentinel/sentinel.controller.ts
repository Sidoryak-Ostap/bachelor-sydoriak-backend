import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SentinelService } from './sentinel.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sentinel')
export class SentinelController {
  constructor(private readonly sentinelService: SentinelService) {}

  @Get('field-indices/:fieldId')
  async getFieldIndices(
    @Param('fieldId') fieldId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.sentinelService.getFieldIndices(fieldId, dateFrom, dateTo);
  }

  @Get('field-map/:fieldId')
  async getFieldImages(@Param('fieldId') fieldId: string) {
    return this.sentinelService.getFieldImages(fieldId);
  }
}
