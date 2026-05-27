import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose'; // Імпортуємо Schema як аліас

export type SubscriptionDocument = HydratedDocument<Subscription>;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_, ret) => {
      delete (ret as any)._id;
      return ret;
    },
  },
})
export class Subscription {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({
    required: true,
    enum: ['starter', 'basic', 'pro'],
    default: 'starter',
  })
  plan: string;

  @Prop({
    required: false,
    enum: ['starter', 'basic', 'pro'],
    default: 'starter',
  })
  pendingPlan: string;

  @Prop({
    required: true,
    enum: ['active', 'cancelled', 'expired', 'past_due'],
    default: 'active',
  })
  status: string;

  @Prop()
  nextPaymentDate: Date;

  @Prop()
  lastAmount: number;

  @Prop()
  invoiceId: string;

  @Prop()
  subscriptionId: string;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

SubscriptionSchema.virtual('id').get(function (this: SubscriptionDocument) {
  return this._id.toHexString();
});
