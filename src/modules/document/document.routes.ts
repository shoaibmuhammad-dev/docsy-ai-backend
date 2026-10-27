import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import upload from "../../middleware/upload.middleware.js";
import {
  deleteDocument,
  getDocument,
  getDocuments,
  getDocumentUrl,
  uploadDocument,
} from "./document.controller.js";
import {
  apiLimiter,
  uploadLimiter,
} from "../../middleware/rateLimit.middleware.js";

const router = express.Router();

// Every document route requires a logged-in user
router.use(authMiddleware, apiLimiter);

router.post("/", uploadLimiter, upload.single("file"), uploadDocument);
router.get("/", getDocuments);
router.get("/:id", getDocument);
router.get("/:id/url", getDocumentUrl);
router.delete("/:id", deleteDocument);

export default router;
