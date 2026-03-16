import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';
import * as bcrypt from 'bcrypt';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: false })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: false, select: false })
  password: string;

  @Prop({ required: false, select: false })
  resetCode: string;

  @Prop({ type: Date, required: false, select: false })
  resetCodeExpires: Date | null;

  @Prop({ required: false })
  isResetCodeVerified: boolean;

  @Prop({ enum: ['local', 'google'], default: 'local' })
  provider: 'local' | 'google';

  @Prop({ default: 'user' })
  role: string;

  @Prop({ default: true })
  isActive: boolean;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', async function (next) {
  if (this.provider !== 'local') return next();
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(parseInt(process.env.SALT_ROUNDS || '10'));
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.virtual('id').get(function () {
  return this._id.toHexString();
} as any);

UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.password;
    return ret;
  },
} as any);
