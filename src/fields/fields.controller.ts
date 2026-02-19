import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FieldsService } from './fields.service';
import { CreateFieldDto, UpdateFieldDto } from './field.dto';
import { AuthGuard } from '@nestjs/passport';
import { User } from 'src/users/decorators/user.decorator';
import type { ActiveUser } from 'src/users/decorators/active-user.interface';

@UseGuards(AuthGuard('jwt'))
@Controller('fields')
export class FieldsController {
  constructor(private readonly fieldService: FieldsService) {}

  @Post()
  async createField(@Body() dto: CreateFieldDto, @User() user: ActiveUser) {
    return this.fieldService.createField(dto, user.userId);
  }

  @Get()
  async getMyFields(@User() user: ActiveUser) {
    return this.fieldService.getFieldsByUser(user.userId);
  }

  @Get('field/:id')
  async getFieldById(@Param('id') id: string, @User() user: ActiveUser) {
    return this.fieldService.getFieldById(id, user.userId);
  }

  @Patch('field/:id')
  async updateField(
    @Param('id') id: string,
    @Body() dto: UpdateFieldDto,
    @User() user: ActiveUser,
  ) {
    return this.fieldService.updateField(id, user.userId, dto);
  }

  @Delete('field/:id')
  async deleteField(@Param('id') id: string, @User() user: ActiveUser) {
    return this.fieldService.deleteFieldById(id, user.userId);
  }
}
