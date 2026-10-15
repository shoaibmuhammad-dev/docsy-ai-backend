import { Router } from "express";
import { getMe, login, signup } from "./auth.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import { loginSchema, signupSchema } from "../../validators/auth.validator.js";
import authMiddleware from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/signup", validate(signupSchema), signup);
router.post("/login", validate(loginSchema), login);

router.get("/me", authMiddleware, getMe);

export default router;
