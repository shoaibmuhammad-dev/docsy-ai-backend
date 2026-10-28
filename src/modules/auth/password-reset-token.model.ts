import mongoose, { Schema, type Model, Types } from "mongoose";

export interface IPasswordResetToken {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
}

const passwordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: {
        expires: 0,
      },
    },
  },
  {
    timestamps: true,
  },
);

const PasswordResetToken: Model<IPasswordResetToken> =
  mongoose.models.PasswordResetToken ||
  mongoose.model<IPasswordResetToken>(
    "PasswordResetToken",
    passwordResetTokenSchema,
  );

export default PasswordResetToken;
