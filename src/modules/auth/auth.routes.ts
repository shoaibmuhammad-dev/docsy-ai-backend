import { Router } from "express";
import {
  forgotPassword,
  getMe,
  handleResetPassword,
  login,
  signup,
} from "./auth.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import { loginSchema, signupSchema } from "../../validators/auth.validator.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import {
  apiLimiter,
  loginLimiter,
  passwordResetEmailLimiter,
  passwordResetIpLimiter,
  signupLimiter,
} from "../../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/signup", validate(signupSchema), signupLimiter, signup);
router.post("/login", validate(loginSchema), loginLimiter, login);
router.post(
  "/forgot-password",
  passwordResetIpLimiter,
  passwordResetEmailLimiter,
  forgotPassword,
);
router.post("/reset-password", passwordResetIpLimiter, handleResetPassword);

router.get("/me", authMiddleware, apiLimiter, getMe);

export default router;
