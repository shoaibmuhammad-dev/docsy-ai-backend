import type { Request, Response } from "express";
import * as authService from "./auth.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import type {
  LoginInput,
  SignupInput,
} from "../../validators/auth.validator.js";
import User from "./user.model.js";

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
