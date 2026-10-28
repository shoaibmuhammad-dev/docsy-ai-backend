import type { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import type {
  LoginInput,
  SignupInput,
} from "../../validators/auth.validator.js";

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.signup(req.body as SignupInput);

  res.status(201).json({
    success: true,
    message: "Account created successfully",
    data: result,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body as LoginInput);

  res.status(200).json({
    success: true,
    message: "Logged in successfully",
    data: result,
  });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;

  const userData = {
    id: user?._id,
    name: user.name,
    email: user.email,
  };

  res.status(200).json({ success: true, data: userData });
});

const GENERIC_RESET_MESSAGE =
  "If an account exists with this email, we've sent a password reset link.";

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const email = req.body?.email;

  if (typeof email !== "string" || !email.trim()) {
    res.status(200).json({
      success: true,
      message: GENERIC_RESET_MESSAGE,
    });
    return;
  }

  try {
    await authService.requestPasswordReset(email);
  } catch {
    // Do not expose account existence or email-provider errors.
    console.error("Password reset request could not be completed.");
  }

  res.status(200).json({
    success: true,
    message: GENERIC_RESET_MESSAGE,
  });
}

export async function handleResetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { token, password } = req.body ?? {};

  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/i.test(token) ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    res.status(400).json({
      success: false,
      error:
        "Please provide a valid reset link and a password between 8 and 128 characters.",
    });
    return;
  }

  try {
    await authService.resetPassword(token, password);

    res.status(200).json({
      success: true,
      message:
        "Your password has been reset successfully. Please sign in with your new password.",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INVALID_OR_EXPIRED_RESET_TOKEN"
    ) {
      res.status(400).json({
        success: false,
        error:
          "This password reset link is invalid or has expired. Please request a new one.",
      });
      return;
    }

    next(error);
  }
}
