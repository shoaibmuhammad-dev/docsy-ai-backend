import type { Request, Response } from "express";
import ApiError from "../../utils/ApiError.js";
import asyncHandler from "../../utils/asyncHandler.js";
import * as documentService from "./document.service.js";

// Adjust this one function if your authMiddleware stores the user differently
const getUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError("Unauthorized", 401);
  }
  return userId;
};

const parsePositiveInt = (
  value: unknown,
  fallback: number,
  max: number,
): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

export const uploadDocument = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError('Please upload a PDF file in the "file" field', 400);
    }

    const document = await documentService.createDocument(
      getUserId(req),
      req.file,
    );

    res.status(201).json({
      success: true,
      message: "PDF uploaded successfully",
      data: { document },
    });
  },
);

export const getDocuments = asyncHandler(
  async (req: Request, res: Response) => {
    const page = parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInt(req.query.limit, 10, 50);

    const result = await documentService.listDocuments(getUserId(req), {
      page,
      limit,
    });

    res.status(200).json({ success: true, data: result });
  },
);

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await documentService.getDocumentById(
    getUserId(req),
    String(req.params.id),
  );

  res.status(200).json({ success: true, data: { document } });
});

export const getDocumentUrl = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await documentService.getDocumentFileUrl(
      getUserId(req),
      String(req.params.id),
    );

    res.status(200).json({ success: true, data: result });
  },
);

export const deleteDocument = asyncHandler(
  async (req: Request, res: Response) => {
    await documentService.removeDocument(getUserId(req), String(req.params.id));

    res
      .status(200)
      .json({ success: true, message: "Document deleted successfully" });
  },
);
