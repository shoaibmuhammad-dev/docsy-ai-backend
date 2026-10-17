import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { env } from "../../config/env.js";
import {
  deleteFile,
  getSignedFileUrl,
  uploadFile,
} from "../../services/storage.service.js";
import ApiError from "../../utils/ApiError.js";
import Chunk from "../chunk/chunk.model.js";
import DocumentModel, { type IDocument } from "./document.model.js";
import { ingestDocument } from "./ingestion.service.js";
import Chat from "../chat/chat.model.js";
import Message from "../message/message.model.js";

type DocumentRecord = IDocument & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

// What the API returns (fileKey / fileUrl are internal and never exposed)
export interface DocumentResponse {
  id: string;
  title: string;
  status: IDocument["status"];
  pageCount: number;
  errorMessage?: string;
  createdAt?: Date;
}

export interface Pagination {
  page: number;
  limit: number;
}

const PDF_SIGNATURE = "%PDF-";
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const toDocumentResponse = (document: DocumentRecord): DocumentResponse => ({
  id: document._id.toString(),
  title: document.title,
  status: document.status,
  pageCount: document.pageCount,
  errorMessage: document.errorMessage,
  createdAt: document.createdAt,
});

// Always scoped to the owner. A document that belongs to someone else gets
// the same 404 as one that doesn't exist, so ids can't be probed.
const findOwnedDocument = async (userId: string, documentId: string) => {
  if (!OBJECT_ID_REGEX.test(documentId)) {
    throw new ApiError("Invalid document id", 400);
  }

  const document = await DocumentModel.findOne({ _id: documentId, userId });
  if (!document) {
    throw new ApiError("Document not found", 404);
  }

  return document;
};

export const createDocument = async (
  userId: string,
  file: Express.Multer.File,
): Promise<DocumentResponse> => {
  // The mimetype comes from the client and can be faked; check the real bytes
  const signature = file.buffer
    .subarray(0, PDF_SIGNATURE.length)
    .toString("latin1");
  if (signature !== PDF_SIGNATURE) {
    throw new ApiError("The uploaded file is not a valid PDF", 400);
  }

  const documentCount = await DocumentModel.countDocuments({ userId });
  if (documentCount >= env.MAX_DOCUMENTS_PER_USER) {
    throw new ApiError(
      `Document limit reached (${env.MAX_DOCUMENTS_PER_USER}). Delete a document to upload a new one`,
      403,
    );
  }

  // Never use the original filename in the key (unsafe characters, collisions)
  const fileKey = `documents/${userId}/${randomUUID()}.pdf`;
  await uploadFile(fileKey, file.buffer, "application/pdf");

  try {
    const document = await DocumentModel.create({
      userId: new Types.ObjectId(userId),
      title:
        file.originalname.replace(/\.pdf$/i, "").trim() || "Untitled document",
      fileUrl: `s3://${env.S3_BUCKET}/${fileKey}`,
      fileKey,
      status: "processing",
    });

    // NEXT STEP: start ingestion here (extract text -> chunk -> embed -> save
    // chunks), then set status to "ready" or "failed". It can use file.buffer
    // directly, so there is no need to download the PDF again.

    void ingestDocument(document._id, document.userId, file.buffer).catch(
      (error) => console.error("[ingestion] unexpected error:", error),
    );

    return toDocumentResponse(document);
  } catch (error) {
    // Don't leave an orphaned file in the bucket if the DB write fails
    await deleteFile(fileKey).catch(() => undefined);
    throw error;
  }
};

export const listDocuments = async (
  userId: string,
  { page, limit }: Pagination,
) => {
  const [documents, total] = await Promise.all([
    DocumentModel.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<DocumentRecord[]>(),
    DocumentModel.countDocuments({ userId }),
  ]);

  return {
    documents: documents.map(toDocumentResponse),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getDocumentById = async (
  userId: string,
  documentId: string,
): Promise<DocumentResponse> => {
  const document = await findOwnedDocument(userId, documentId);
  return toDocumentResponse(document);
};

export const getDocumentFileUrl = async (
  userId: string,
  documentId: string,
) => {
  const document = await findOwnedDocument(userId, documentId);
  const expiresIn = env.SIGNED_URL_EXPIRES_IN;
  const url = await getSignedFileUrl(document.fileKey, expiresIn);

  return { url, expiresIn };
};

export const removeDocument = async (
  userId: string,
  documentId: string,
): Promise<void> => {
  const document = await findOwnedDocument(userId, documentId);

  // Chunks first, then the file, then the record. If a step fails the record
  // still exists, so the user can simply retry the delete.
  await Chunk.deleteMany({ docId: document._id });
  await deleteFile(document.fileKey);
  await document.deleteOne();

  // TODO (when chats exist): delete chats that reference this document, and
  // their messages.
  await detachDocumentFromChats(userId, document._id);
};

export const detachDocumentFromChats = async (
  userId: string,
  documentId: Types.ObjectId,
): Promise<void> => {
  const owner = new Types.ObjectId(userId);

  await Chat.updateMany(
    { userId: owner, docIds: documentId },
    { $pull: { docIds: documentId } },
  );

  const emptyChats = await Chat.find({ userId: owner, docIds: { $size: 0 } })
    .select("_id")
    .lean();
  if (emptyChats.length === 0) return;

  const chatIds = emptyChats.map((chat) => chat._id);
  await Message.deleteMany({ chatId: { $in: chatIds } });
  await Chat.deleteMany({ _id: { $in: chatIds } });
};
