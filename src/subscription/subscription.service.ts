import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Subscription } from './schemas/subscription.schema';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { PLAN_PRICES } from './constants';
import axios from 'axios';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
  ) {}

  async getSubscription(userId: string) {
    const subscription = await this.subscriptionModel.findOne({
      userId,
    });

    if (!subscription) {
      return {
        plan: 'starter',
        status: 'active',
        nextPaymentDate: null,
        price: PLAN_PRICES.starter,
      };
    }

    return {
      plan: subscription.plan,
      status: subscription.status,
      nextPaymentDate: subscription.nextPaymentDate,
      price: PLAN_PRICES[subscription.plan],
    };
  }

  async createSubscriptionLink(userId: string, plan: 'basic' | 'pro') {
    const price = PLAN_PRICES[plan];

    if (!price) {
      throw new HttpException(
        'Некоректний тарифний план',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existingSubscription = await this.subscriptionModel.findOne({
      userId,
    });

    if (existingSubscription && existingSubscription.status === 'active') {
      throw new HttpException(
        'У вас вже є активна підписка. Будь ласка, скасуйте її перед створенням нової.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const requestData = {
      amount: price * 100,
      ccy: 980,
      redirectUrl: `${process.env.FRONTEND_URL}/dashboard/profile`,
      webHookUrls: {
        chargeUrl: `${process.env.BACKEND_URL}/subscription/webhook/charge`,
        statusUrl: `${process.env.BACKEND_URL}/subscription/webhook/status`,
      },
      reference: userId.toString(),
      interval: '1m',
      validity: 3600,
    };

    try {
      const response = await axios.post(
        'https://api.monobank.ua/api/merchant/subscription/create',
        requestData,
        {
          headers: { 'X-Token': process.env.MONO_TOKEN },
          timeout: 10000,
        },
      );

      await this.subscriptionModel.findOneAndUpdate(
        { userId },
        { subscriptionId: response.data.subscriptionId, plan },
        { upsert: true },
      );

      return response.data;
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async processCharge(data: any) {
    const { status, amount, invoiceId, subscriptionId } = data;

    if (!subscriptionId) {
      throw new HttpException('No subscriptionId', HttpStatus.BAD_REQUEST);
    }

    const existingWithSameInvoice = await this.subscriptionModel.findOne({
      invoiceId,
    });
    if (existingWithSameInvoice && status === 'success') {
      return { status: 'already_done' };
    }

    const subscription = await this.subscriptionModel.findOne({
      subscriptionId,
    });
    if (!subscription) {
      throw new HttpException(
        'Subscription record not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (status !== 'success' && status !== 'processing') {
      await this.subscriptionModel.updateOne(
        { subscriptionId },
        { $set: { status: 'past_due' } },
      );
      return { status: 'recorded_failure' };
    }

    if (status === 'processing') return { status: 'waiting' };

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 30);

    try {
      await this.subscriptionModel.updateOne(
        { subscriptionId },
        {
          $set: {
            status: 'active',
            nextPaymentDate: nextDate,
            lastAmount: amount / 100,
            invoiceId: invoiceId,
          },
        },
      );

      return { status: 'ok' };
    } catch (error) {
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async processStatusUpdate(data: any) {
    const { status, subscriptionId } = data;

    if (!subscriptionId) {
      return { status: 'error' };
    }

    if (status === 'cancelled') {
      await this.subscriptionModel.updateOne(
        { subscriptionId },
        { $set: { status: 'cancelled' } },
      );
    }

    if (status === 'expired') {
      await this.subscriptionModel.updateOne(
        { subscriptionId },
        { $set: { status: 'expired' } },
      );
    }

    return { status: 'ok' };
  }

  async cancelSubscription(userId: string) {
    const subscription = await this.subscriptionModel.findOne({
      userId,
    });

    if (
      !subscription ||
      !subscription.subscriptionId ||
      subscription.status === 'cancelled'
    ) {
      throw new HttpException(
        'Активної підписки не знайдено',
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      await axios.post(
        'https://api.monobank.ua/api/merchant/subscription/edit',
        { subscriptionId: subscription.subscriptionId, action: 'cancel' },
        {
          headers: { 'X-Token': process.env.MONO_TOKEN },
        },
      );

      subscription.status = 'cancelled';
      await subscription.save();

      return {
        message:
          'Підписку успішно скасовано. Вона діятиме до кінця оплаченого періоду.',
        nextPaymentDate: subscription.nextPaymentDate,
      };
    } catch (error: any) {
      if (error.response?.data?.errCode === 'INTERNAL_ERROR') {
        subscription.status = 'cancelled';
        await subscription.save();
        return { message: 'Підписку вже було скасовано раніше.' };
      }

      throw new HttpException(
        'Не вдалося скасувати підписку через банківський сервіс',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private handleAxiosError(error: any) {
    if (error.response) {
      throw new HttpException(
        error.response.data?.errText || 'Помилка банку',
        error.response.status,
      );
    }
    throw new HttpException(
      'Сервіс оплати недоступний',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
