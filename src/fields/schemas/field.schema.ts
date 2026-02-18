import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type FieldDocument = HydratedDocument<Field>;

@Schema({ timestamps: true })
export class Field {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: mongoose.Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  area: number;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  owner: string;

  @Prop({ required: false })
  cropType: string;

  @Prop({ required: false })
  soilType: string;

  @Prop({ requred: false })
  previewUrl: string;

  @Prop({
    type: {
      type: String,
      enum: ['Polygon'],
      required: true,
      default: 'Polygon',
    },
    coordinates: {
      type: [[[Number]]],
      required: true,
    },
  })
  boundary: {
    type: string;
    coordinates: number[][][];
  };
}

export const FieldSchema = SchemaFactory.createForClass(Field);
