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
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { type UserDocument } from '../users/schemas/user.schema';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fields')
export class FieldsController {
  constructor(private readonly fieldService: FieldsService) {}

  @Post()
  async createField(
    @Body() dto: CreateFieldDto,
    @GetUser() user: UserDocument,
  ) {
    return this.fieldService.createField(dto, user.id);
  }

  @Get()
  async getMyFields(@GetUser() user: UserDocument) {
    return this.fieldService.getFieldsByUser(user.id);
  }

  @Get('field/:id')
  async getFieldById(@Param('id') id: string, @GetUser() user: UserDocument) {
    return this.fieldService.getFieldById(id, user.id);
  }

  @Patch('field/:id')
  async updateField(
    @Param('id') id: string,
    @Body() dto: UpdateFieldDto,
    @GetUser() user: UserDocument,
  ) {
    return this.fieldService.updateField(id, user.id, dto);
  }

  @Delete('field/:id')
  async deleteField(@Param('id') id: string, @GetUser() user: UserDocument) {
    return this.fieldService.deleteFieldById(id, user.id);
  }
}
