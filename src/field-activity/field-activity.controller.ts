import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FieldActivityService } from './field-activity.service';
import { CreateFieldActivityDto } from './field-activity.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { type UserDocument } from '../users/schemas/user.schema';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('field-activity')
export class FieldActivityController {
  constructor(private readonly fieldActivityService: FieldActivityService) {}

  @Post()
  async createActivity(
    @Body() dto: CreateFieldActivityDto,
    @GetUser() user: UserDocument,
  ) {
    return this.fieldActivityService.createActivity(dto, user.id);
  }

  @Get('/:fieldId')
  async getActivitiesByField(
    @Param('fieldId') fieldId: string,
    @GetUser() user: UserDocument,
  ) {
    return this.fieldActivityService.getActivitiesByField(fieldId, user.id);
  }

  @Delete()
  async deleteActivitiesByIds(
    @Body('activityIds') activityIds: string[],
    @GetUser() user: UserDocument,
  ) {
    return this.fieldActivityService.deleteActivitiesByIds(
      activityIds,
      user.id,
    );
  }
}
