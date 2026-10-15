import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface IChat {
  userId: Types.ObjectId;
  docIds: Types.ObjectId[]; // one document now, several for multi-document chat
  title: string;
}

const chatSchema = new Schema<IChat>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },

    docIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Document" }],
      validate: {
        validator: (value: Types.ObjectId[]) => value.length > 0,
        message: "A chat needs at least one document",
      },
    },

    title: {
      type: String,
      trim: true,
      default: "New chat",
    },
  },
  {
    timestamps: true,
  },
);

// Listing a user's chats, most recently active first
chatSchema.index({ userId: 1, updatedAt: -1 });

const Chat: Model<IChat> = mongoose.model<IChat>("Chat", chatSchema);

export default Chat;
