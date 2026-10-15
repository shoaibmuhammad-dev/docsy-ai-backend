import type { ErrorRequestHandler } from "express";
import ApiError from "../utils/ApiError.js";
import multer from "multer";

const errorMiddlewareOld: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;

  const message =
    err instanceof ApiError ? err.message : "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: message,
  });
};

const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  // Errors you throw on purpose
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Errors thrown by multer itself (file too large, wrong field name, ...)
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        success: false,
        error: "File is too large (max 10 MB)",
      });
      return;
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      res.status(400).json({
        success: false,
        error: 'Unexpected file field. Send the PDF in a field named "file"',
      });
      return;
    }

    res.status(400).json({ success: false, error: err.message });
    return;
  }

  // Anything else is a bug: log it, but don't leak details to the client
  console.error(err);

  res.status(500).json({
    success: false,
    error: "Internal Server Error",
  });
};

export default errorMiddleware;
