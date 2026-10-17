import type { Types } from "mongoose";
import { chunkPages } from "./chunk.service.js";
import { embedTexts } from "../../services/embed.service.js";
import { extractPages } from "./pdf.service.js";
import ApiError from "../../utils/ApiError.js";
import Chunk from "../chunk/chunk.model.js";
import DocumentModel from "./document.model.js";

// Runs the whole pipeline for one document and records the outcome on it.
// It never throws for processing problems: failures are saved on the document
// as status "failed", so it is safe to start without awaiting it.
export const ingestDocument = async (
  documentId: Types.ObjectId,
  userId: Types.ObjectId,
  pdfBuffer: Buffer,
): Promise<void> => {
  const startedAt = Date.now();

  try {
    const { pageCount, pages } = await extractPages(pdfBuffer);

    const chunks = chunkPages(pages);
    if (chunks.length === 0) {
      throw new ApiError(
        "No readable text found. Scanned PDFs (images of text) are not supported yet",
        422,
      );
    }

    const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));

    await Chunk.insertMany(
      chunks.map((chunk, index) => ({
        userId,
        docId: documentId,
        page: chunk.page,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        embedding: embeddings[index],
      })),
    );

    const result = await DocumentModel.updateOne(
      { _id: documentId },
      { status: "ready", pageCount, $unset: { errorMessage: "" } },
    );

    // The user deleted the document while it was processing: remove the chunks
    if (result.matchedCount === 0) {
      await Chunk.deleteMany({ docId: documentId });
      return;
    }

    console.log(
      `[ingestion] ${documentId}: ${pageCount} pages, ${chunks.length} chunks, ready in ${Date.now() - startedAt}ms`,
    );
  } catch (error) {
    console.error(`[ingestion] ${documentId} failed:`, error);

    // Roll back partial work, then record the failure
    await Chunk.deleteMany({ docId: documentId });
    await DocumentModel.updateOne(
      { _id: documentId },
      {
        status: "failed",
        // Only show messages we wrote ourselves; hide internal/API details
        errorMessage:
          error instanceof ApiError
            ? error.message
            : "Something went wrong while processing this document",
      },
    );
  }
};
