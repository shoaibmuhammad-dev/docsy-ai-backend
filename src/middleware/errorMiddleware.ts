import type { ErrorRequestHandler } from "express";
import ApiError from "../utils/ApiError.js";

const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;

  const message =
    err instanceof ApiError ? err.message : "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: message,
  });
};

export default errorMiddleware;
