import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'weather_history' })
export class WeatherHistory extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Field', required: true })
  fieldId: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({
    type: {
      day: Number,
      min: Number,
      max: Number,
      night: Number,
      eve: Number,
      morn: Number,
    },
  })
  temp: {
    day: number;
    min: number;
    max: number;
    night: number;
    eve: number;
    morn: number;
  };

  @Prop()
  pressure: number;

  @Prop()
  humidity: number;

  @Prop()
  dew_point: number;

  @Prop()
  wind_speed: number;

  @Prop()
  wind_deg: number;

  @Prop()
  wind_gust: number;

  @Prop()
  clouds: number;

  @Prop()
  rain?: number;

  @Prop()
  pop: number;
}

export type WeatherHistoryDocument = HydratedDocument<
  WeatherHistory & { _id: Types.ObjectId }
>;

export const WeatherHistorySchema =
  SchemaFactory.createForClass(WeatherHistory);

WeatherHistorySchema.virtual('id').get(function (this: WeatherHistoryDocument) {
  return this._id.toHexString();
});

WeatherHistorySchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.password;
    return ret;
  },
} as any);
