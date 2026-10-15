import { extractText, getDocumentProxy } from "unpdf";
import { env } from "../../config/env.js";
import ApiError from "../../utils/ApiError.js";

export interface PageText {
  page: number; // 1-based
  text: string;
}

export interface ExtractedPdf {
  pageCount: number;
  pages: PageText[];
}

export const extractPages = async (buffer: Buffer): Promise<ExtractedPdf> => {
  let pdf;

  try {
    // pdf.js takes ownership of the array, so give it a copy
    pdf = await getDocumentProxy(new Uint8Array(buffer));
  } catch {
    throw new ApiError(
      "Could not read this PDF. It may be corrupted or password-protected",
      422,
    );
  }

  // Check the size before doing the expensive extraction
  if (pdf.numPages > env.MAX_PDF_PAGES) {
    throw new ApiError(
      `This PDF has ${pdf.numPages} pages. The maximum is ${env.MAX_PDF_PAGES}`,
      422,
    );
  }

  const { totalPages, text } = await extractText(pdf, { mergePages: false });

  return {
    pageCount: totalPages,
    pages: text.map((pageText, index) => ({ page: index + 1, text: pageText })),
  };
};
