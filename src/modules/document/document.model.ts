import mongoose, { Schema, type Model, type Types } from "mongoose";

export const DOCUMENT_STATUSES = ["processing", "ready", "failed"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface IDocument {
  userId: Types.ObjectId;
  title: string;
  fileUrl: string;
  fileKey: string; // storage key (S3/R2), needed to delete the file later
  pageCount: number;
  status: DocumentStatus;
  errorMessage?: string; // set when status is "failed"
}

const documentSchema = new Schema<IDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },

    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },

    fileUrl: {
      type: String,
      required: [true, "File URL is required"],
    },

    fileKey: {
      type: String,
      required: [true, "File key is required"],
    },

    pageCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: DOCUMENT_STATUSES,
      default: "processing",
    },

    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Listing a user's documents, newest first
documentSchema.index({ userId: 1, createdAt: -1 });

const DocumentModel: Model<IDocument> = mongoose.model<IDocument>(
  "Document",
  documentSchema,
);

export default DocumentModel;
