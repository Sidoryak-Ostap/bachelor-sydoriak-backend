import {
  Body,
  Controller,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './DTO/updateProfileDTO';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { type UserDocument } from './schemas/user.schema';
import { UpdateSettingsDto } from './DTO/updateSettingsDTO';

@Controller('user')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @Patch('profile')
  async updateProfile(
    @GetUser() user: UserDocument,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = user.id;
    return this.usersService.updateWithFile(userId, dto, file);
  }

  @Patch('settings')
  async updateSettings(
    @GetUser() user: UserDocument,
    @Body() dto: UpdateSettingsDto,
  ) {
    const userId = user.id;

    return this.usersService.updateSettings(userId, dto);
  }
}
