import type { Request, Response } from "express";
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
