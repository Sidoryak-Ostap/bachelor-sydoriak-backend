import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type FieldMapDocument = HydratedDocument<FieldMap>;

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
export class FieldMap extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Field', required: true, index: true })
  fieldId: Types.ObjectId;

  @Prop({ required: true, index: true })
  date: Date;

  @Prop({ required: true })
  indexType: string;

  @Prop({ required: true })
  cloudinaryUrl: string;

  @Prop({
    type: {
      sentinelBbox: { type: [Number], required: true },
      mapboxCoords: { type: [[Number]], required: true },
    },
    _id: false,
    required: true,
  })
  bbox: {
    sentinelBbox: number[];
    mapboxCoords: number[][];
  };

  @Prop({
    required: true,
    _id: false,
    type: {
      excellent: { type: Number, required: true },
      good: { type: Number, required: true },
      moderate: { type: Number, required: true },
      poor: { type: Number, required: true },
    },
  })
  distribution: {
    excellent: number;
    good: number;
    moderate: number;
    poor: number;
  };
}

export const FieldMapSchema = SchemaFactory.createForClass(FieldMap);
FieldMapSchema.index({ fieldId: 1, date: 1, indexType: 1 }, { unique: true });

FieldMapSchema.virtual('id').get(function (this: FieldMapDocument) {
  return (this._id as Types.ObjectId).toHexString();
});
