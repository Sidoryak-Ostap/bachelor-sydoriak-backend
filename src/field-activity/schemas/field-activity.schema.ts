import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type ActivityDocument = HydratedDocument<FieldActivity>;

@Schema({ timestamps: true })
export class FieldActivity {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true })
  fieldId: mongoose.Types.ObjectId;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  userId: mongoose.Types.ObjectId;
}

export const FieldActivitySchema = SchemaFactory.createForClass(FieldActivity);
