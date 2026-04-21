import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { type UserDocument } from '../users/schemas/user.schema';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('webhook/charge')
  @HttpCode(HttpStatus.OK)
  async handleChargeWebhook(@Body() body: any) {
    return this.subscriptionService.processCharge(body);
  }

  @Post('webhook/status')
  @HttpCode(HttpStatus.OK)
  async handleStatusWebhook(@Body() body: any) {
    return await this.subscriptionService.processStatusUpdate(body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async getSubscription(@GetUser() user: UserDocument) {
    return this.subscriptionService.getSubscription(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createSubscription(
    @GetUser() user: UserDocument,
    @Body('plan') plan: 'basic' | 'pro',
  ) {
    return this.subscriptionService.createSubscriptionLink(user.id, plan);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  async cancel(@GetUser() user: UserDocument) {
    return await this.subscriptionService.cancelSubscription(user.id);
  }
}
