import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { type UserDocument } from '../users/schemas/user.schema';
import { StatisticsService } from './statistics.service';

@Controller('statistics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}
  @Get()
  async getFieldStatistics(@GetUser() user: UserDocument) {
    return this.statisticsService.getFieldStatistics(user.id);
  }
}
