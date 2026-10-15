import mongoose, { Schema, type Model, type Types } from "mongoose";

export const MESSAGE_ROLES = ["user", "assistant"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export interface ICitation {
  page: number;
  chunkId: Types.ObjectId;
}

export interface IMessage {
  chatId: Types.ObjectId;
  role: MessageRole;
  content: string;
  citations: ICitation[];
}

const citationSchema = new Schema<ICitation>(
  {
    page: {
      type: Number,
      required: true,
      min: 1,
    },
    chunkId: {
      type: Schema.Types.ObjectId,
      ref: "Chunk",
      required: true,
    },
  },
  { _id: false },
);

const messageSchema = new Schema<IMessage>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: [true, "Chat is required"],
    },

    role: {
      type: String,
      enum: MESSAGE_ROLES,
      required: [true, "Role is required"],
    },

    content: {
      type: String,
      required: [true, "Content is required"],
    },

    citations: {
      type: [citationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Loading a chat's messages in order
messageSchema.index({ chatId: 1, createdAt: 1 });

const Message: Model<IMessage> = mongoose.model<IMessage>(
  "Message",
  messageSchema,
);

export default Message;
