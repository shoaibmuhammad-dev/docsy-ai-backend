import mongoose, { Schema, type Model, type Types } from "mongoose";

export const MESSAGE_ROLES = ["user", "assistant"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export interface ICitation {
  index: number; // the [n] marker used inside the answer text
  docId: Types.ObjectId;
  chunkId: Types.ObjectId;
  page: number;
}

export interface IMessage {
  chatId: Types.ObjectId;
  role: MessageRole;
  content: string;
  citations: ICitation[];
}

const citationSchema = new Schema<ICitation>(
  {
    index: {
      type: Number,
      required: true,
      min: 1,
    },
    docId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    chunkId: {
      type: Schema.Types.ObjectId,
      ref: "Chunk",
      required: true,
    },
    page: {
      type: Number,
      required: true,
      min: 1,
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
