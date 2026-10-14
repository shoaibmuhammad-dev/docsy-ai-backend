import { Router } from "express";
import { login, signup } from "./auth.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import { loginSchema, signupSchema } from "../../validators/auth.validator.js";

const router = Router();

router.post("/signup", validate(signupSchema), signup);
router.post("/login", validate(loginSchema), login);

export default router;
