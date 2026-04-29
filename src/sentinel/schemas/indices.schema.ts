import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type IndicesDocument = HydratedDocument<Indices>;

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
export class Indices extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Field', required: true, index: true })
  fieldId: Types.ObjectId;

  @Prop({ required: true, index: true })
  date: Date;

  @Prop({ type: Object })
  ndvi: {
    min: number;
    max: number;
    mean: number;
    stDev: number;
  };

  @Prop({ type: Object })
  ndmi: {
    min: number;
    max: number;
    mean: number;
    stDev: number;
  };

  @Prop({ type: Object })
  savi: {
    min: number;
    max: number;
    mean: number;
    stDev: number;
  };

  @Prop({ type: Object })
  evi: {
    min: number;
    max: number;
    mean: number;
    stDev: number;
  };
}

export const IndicesSchema = SchemaFactory.createForClass(Indices);
IndicesSchema.index({ fieldId: 1, date: 1 }, { unique: true });

IndicesSchema.virtual('id').get(function (this: IndicesDocument) {
  return (this._id as Types.ObjectId).toHexString();
});
