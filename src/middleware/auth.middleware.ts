import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import User from "../modules/auth/user.model.js";
import { env } from "../config/env.js";

const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Unauthorized: Bearer token required",
      });
      return;
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      res.status(401).json({
        success: false,
        error: "Unauthorized: Token not found",
      });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (typeof decoded === "string" || typeof decoded.id !== "string") {
      res.status(401).json({
        success: false,
        error: "Invalid token payload",
      });
      return;
    }

    const payload = decoded as JwtPayload;
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      res.status(401).json({
        success: false,
        error: "User associated with this token no longer exists",
      });
      return;
    }

    if (typeof payload.iat !== "number") {
      res.status(401).json({
        success: false,
        error: "Invalid authentication token",
      });
      return;
    }

    if (
      user.passwordChangedAt &&
      payload.iat <= Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      res.status(401).json({
        success: false,
        error: "Your password has changed. Please sign in again.",
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: "Session has expired. Please log in again.",
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: "Invalid authentication token",
      });
      return;
    }

    next(error);
  }
};

export default authMiddleware;
