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
import { User } from 'src/users/decorators/user.decorator';
import type { ActiveUser } from 'src/users/decorators/active-user.interface';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('field-activity')
export class FieldActivityController {
  constructor(private readonly fieldActivityService: FieldActivityService) {}

  @Post()
  async createActivity(
    @Body() dto: CreateFieldActivityDto,
    @User() user: ActiveUser,
  ) {
    return this.fieldActivityService.createActivity(dto, user.userId);
  }

  @Get('/:fieldId')
  async getActivitiesByField(
    @Param('fieldId') fieldId: string,
    @User() user: ActiveUser,
  ) {
    return this.fieldActivityService.getActivitiesByField(fieldId, user.userId);
  }

  @Delete()
  async deleteActivitiesByIds(
    @Body('activityIds') activityIds: string[],
    @User() user: ActiveUser,
  ) {
    return this.fieldActivityService.deleteActivitiesByIds(
      activityIds,
      user.userId,
    );
  }
}
