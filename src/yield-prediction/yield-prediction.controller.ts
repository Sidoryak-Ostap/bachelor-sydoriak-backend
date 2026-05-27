import { JwtAuthGuard } from '@app/auth/guards/jwt-auth.guard';
import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { YieldPredictionService } from './yield-prediction.service';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('yield-prediction')
export class YieldPredictionController {
  constructor(
    private readonly yieldPredictionService: YieldPredictionService,
  ) {}
  @Post('/predict/:fieldId')
  async predictYield(@Param('fieldId') fieldId: string) {
    return this.yieldPredictionService.predictYield(fieldId);
  }
}
