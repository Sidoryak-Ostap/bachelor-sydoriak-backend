import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type FieldDocument = HydratedDocument<Field>;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
      delete (ret as any)._id;
      return ret;
    },
  },
})
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

  @Prop({ required: false })
  previewUrl: string;

  @Prop({
    required: false,
    type: {
      status: { type: String },
      stressLevel: { type: String },
      analysis: { type: String },
      risks: [{ type: String }],
      recommendations: [{ type: String }],
      generatedAt: { type: Date, default: Date.now },
    },
  })
  interpretation?: {
    status: string;
    stressLevel: string;
    analysis: string;
    risks: string[];
    recommendations: string[];
    generatedAt: Date;
  };

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

FieldSchema.virtual('id').get(function (this: FieldDocument) {
  return this._id.toHexString();
});
