import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface IChunk {
  userId: Types.ObjectId;
  docId: Types.ObjectId;
  page: number;
  chunkIndex: number; // position of the chunk within the document
  text: string;
  embedding: number[];
}

const chunkSchema = new Schema<IChunk>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },

    docId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: [true, "Document is required"],
      index: true,
    },

    page: {
      type: Number,
      required: [true, "Page number is required"],
      min: 1,
    },

    chunkIndex: {
      type: Number,
      required: [true, "Chunk index is required"],
      min: 0,
    },

    text: {
      type: String,
      required: [true, "Text is required"],
    },

    // Large array: excluded from normal queries unless you .select("+embedding")
    embedding: {
      type: [Number],
      required: [true, "Embedding is required"],
      select: false,
    },
  },
  {
    // Saves space on the free Atlas tier (512 MB)
    timestamps: false,
  },
);

const Chunk: Model<IChunk> = mongoose.model<IChunk>("Chunk", chunkSchema);

export default Chunk;
