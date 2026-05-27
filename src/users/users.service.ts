import { Injectable, NotFoundException } from '@nestjs/common';
import { User, UserDocument } from './schemas/user.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { UpdateProfileDto } from './DTO/updateProfileDTO';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateSettingsDto } from './DTO/updateSettingsDTO';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(data: Partial<User>): Promise<UserDocument> {
    const newUser = new this.userModel(data);
    return newUser.save();
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email })
      .select('+resetCode +resetCodeExpires +password')
      .exec();
  }

  async deleteById(id: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndDelete(id).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, data: Partial<User>): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, data).exec();
  }

  // Profile update with file handling

  async updateWithFile(
    userId: string,
    dto: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    let updateData = { ...dto };

    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        updateData[`profile.${key}`] = value;
      }
    }

    if (file) {
      const uploadResult = await this.cloudinaryService.uploadImage(file);
      updateData['profile.avatarUrl'] = uploadResult.secure_url;
    } else if (dto.avatarUrl === 'null' || dto.avatarUrl === null) {
      updateData['profile.avatarUrl'] = null;
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }

  async updateSettings(userId: string, settings: UpdateSettingsDto) {
    const updateData = {};

    Object.entries(settings).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[`settings.${key}`] = value;
      }
    });

    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, { $set: updateData }, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('Користувача не знайдено');
    }

    return updatedUser;
  }

  async updateRefreshToken(userId: string, token: string | null) {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { refreshToken: token } },
    );
  }
}
